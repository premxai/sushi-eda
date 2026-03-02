"""
Celery worker — async analysis tasks.

Start the worker with:
    celery -A worker worker --loglevel=info --concurrency=4

Each task:
  1. Downloads the file from R2
  2. Runs EDAAnalyzer (pandas)
  3. Stores the EDAReport in Postgres (analyses table) and Redis (cache)
  4. Publishes a job_done event via Redis pub/sub
  5. Updates the Dataset.status in Postgres
"""
import hashlib
import io
import os
import time
from datetime import datetime, timezone

from celery import Celery
from loguru import logger

from analyzer import EDAAnalyzer
from cache import cache
from storage import storage

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# ── Celery app ─────────────────────────────────────────────────────────────────

celery_app = Celery(
    "sushi",
    broker=REDIS_URL,
    backend=REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,          # re-queue on worker crash
    worker_prefetch_multiplier=1, # one task at a time per worker (heavy CPU tasks)
    result_expires=60 * 60 * 24,  # keep Celery results for 1 day
)


# ── Tasks ──────────────────────────────────────────────────────────────────────

@celery_app.task(
    bind=True,
    name="analyze_dataset",
    max_retries=2,
    default_retry_delay=30,
    soft_time_limit=300,   # 5 min soft limit — task gets SoftTimeLimitExceeded
    time_limit=360,        # 6 min hard kill
)
def analyze_dataset(
    self,
    dataset_id: str,
    org_id: str,
    file_key: str,
    file_format: str,
    database_url: str,
) -> dict:
    """
    Main analysis task. Runs in a Celery worker process.

    Args:
        dataset_id:   UUID string for the Dataset row
        org_id:       UUID string for the Organization
        file_key:     R2 object key to download
        file_format:  csv | tsv | xlsx | json | parquet | sqlite
        database_url: Postgres URL for writing the Analysis row

    Returns:
        {"analysis_id": str, "duration_seconds": float}
    """
    start_time = time.time()
    logger.info(f"[Task] Starting analysis: dataset={dataset_id}")

    # Mark as processing in Redis
    cache.set_job_status(dataset_id, "processing", {"started_at": datetime.now(timezone.utc).isoformat()})

    try:
        # ── 1. Download file from R2 ───────────────────────────────────────────
        logger.info(f"[Task] Downloading from R2: {file_key}")
        file_bytes = storage.download(file_key)

        # ── 2. Check analysis cache (by file hash) ─────────────────────────────
        file_hash = hashlib.md5(file_bytes).hexdigest()
        cached = cache.get_analysis(file_hash)
        if cached:
            logger.info(f"[Task] Cache hit for dataset={dataset_id}, hash={file_hash[:8]}")
            _save_analysis_to_db(database_url, dataset_id, org_id, cached, file_hash, 0.0)
            cache.set_job_status(dataset_id, "done")
            cache.publish_job_done(org_id, dataset_id, "cached")
            return {"analysis_id": "cached", "duration_seconds": 0.0}

        # ── 3. Parse into DataFrame ────────────────────────────────────────────
        import pandas as pd
        df = _parse_bytes(file_bytes, file_format)
        logger.info(f"[Task] Parsed dataset={dataset_id}: {df.shape[0]}r x {df.shape[1]}c")

        # Update job progress
        cache.set_job_status(dataset_id, "processing", {"progress": 30, "stage": "analyzing"})

        # ── 4. Run EDA analysis ────────────────────────────────────────────────
        analyzer = EDAAnalyzer(df)
        report = analyzer.generate_full_report()
        preview = df.head(50).fillna("").to_dict(orient="records")
        report["preview"] = preview

        cache.set_job_status(dataset_id, "processing", {"progress": 80, "stage": "saving"})

        # ── 5. Persist to Postgres + cache ────────────────────────────────────
        duration = time.time() - start_time
        analysis_id = _save_analysis_to_db(database_url, dataset_id, org_id, report, file_hash, duration)
        cache.set_analysis(file_hash, report)

        # ── 6. Notify frontend via Redis pub/sub ──────────────────────────────
        cache.set_job_status(dataset_id, "done", {"analysis_id": str(analysis_id), "duration_seconds": duration})
        cache.publish_job_done(org_id, dataset_id, str(analysis_id))

        logger.info(f"[Task] Completed dataset={dataset_id} in {duration:.2f}s")
        return {"analysis_id": str(analysis_id), "duration_seconds": duration}

    except Exception as exc:
        logger.error(f"[Task] Failed dataset={dataset_id}: {exc}")
        cache.set_job_status(dataset_id, "failed", {"error": str(exc)})
        cache.publish_job_failed(org_id, dataset_id, str(exc))
        _mark_dataset_failed(database_url, dataset_id, str(exc))
        raise self.retry(exc=exc)


# ── DB helpers (synchronous — no asyncio in Celery workers) ────────────────────

def _parse_bytes(data: bytes, file_format: str):
    """Parse raw bytes into a pandas DataFrame based on file format."""
    import json as _json
    import pandas as pd

    buf = io.BytesIO(data)

    if file_format == "csv":
        return pd.read_csv(buf)
    elif file_format == "tsv":
        return pd.read_csv(buf, sep="\t")
    elif file_format in ("xls", "xlsx"):
        return pd.read_excel(buf, engine="openpyxl")
    elif file_format == "parquet":
        return pd.read_parquet(buf)
    elif file_format == "json":
        raw = _json.loads(data.decode("utf-8"))
        if isinstance(raw, list):
            df = pd.json_normalize(raw, max_level=1) if raw else pd.DataFrame()
        else:
            df = pd.json_normalize([raw], max_level=1)
        for col in df.columns:
            if df[col].apply(lambda x: isinstance(x, (dict, list))).any():
                df[col] = df[col].apply(lambda x: _json.dumps(x) if isinstance(x, (dict, list)) else x)
        return df
    elif file_format in ("db", "sqlite", "sqlite3"):
        import sqlite3, tempfile, os as _os
        with tempfile.NamedTemporaryFile(delete=False, suffix=".db") as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        conn = sqlite3.connect(tmp_path)
        tables = pd.read_sql_query("SELECT name FROM sqlite_master WHERE type='table'", conn)
        if tables.empty:
            raise ValueError("No tables found in SQLite database")
        df = pd.read_sql_query(f"SELECT * FROM {tables.iloc[0]['name']}", conn)
        conn.close()
        _os.unlink(tmp_path)
        return df
    else:
        raise ValueError(f"Unsupported format: {file_format}")


def _save_analysis_to_db(
    database_url: str,
    dataset_id: str,
    org_id: str,
    report: dict,
    file_hash: str,
    duration: float,
) -> str:
    """Synchronously write the Analysis row and update Dataset.status using psycopg2."""
    import uuid
    import json
    import psycopg2
    from psycopg2.extras import Json

    # Convert asyncpg URL to psycopg2 URL
    db_url = database_url.replace("postgresql+asyncpg://", "postgresql://").replace("postgres://", "postgresql://")

    analysis_id = str(uuid.uuid4())
    try:
        conn = psycopg2.connect(db_url)
        with conn:
            with conn.cursor() as cur:
                # Get next version number
                cur.execute(
                    "SELECT COALESCE(MAX(version), 0) + 1 FROM analyses WHERE dataset_id = %s",
                    (dataset_id,),
                )
                version = cur.fetchone()[0]

                # Insert analysis
                cur.execute(
                    """
                    INSERT INTO analyses (id, dataset_id, org_id, version, report, job_id, duration_seconds)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (analysis_id, dataset_id, org_id, version, Json(report), file_hash, duration),
                )

                # Update dataset status + row/col counts
                bi = report.get("basic_info", {})
                cur.execute(
                    """
                    UPDATE datasets
                    SET status = 'ready', row_count = %s, column_count = %s, updated_at = NOW()
                    WHERE id = %s
                    """,
                    (bi.get("rows"), bi.get("columns"), dataset_id),
                )
        conn.close()
        logger.info(f"Saved Analysis id={analysis_id} v{version} for dataset={dataset_id}")
    except Exception as e:
        logger.error(f"DB write failed for dataset={dataset_id}: {e}")
        raise

    return analysis_id


def _mark_dataset_failed(database_url: str, dataset_id: str, error: str) -> None:
    """Mark a dataset as failed in Postgres."""
    import psycopg2
    db_url = database_url.replace("postgresql+asyncpg://", "postgresql://").replace("postgres://", "postgresql://")
    try:
        conn = psycopg2.connect(db_url)
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE datasets SET status = 'failed', error_message = %s, updated_at = NOW() WHERE id = %s",
                    (error[:500], dataset_id),
                )
        conn.close()
    except Exception as e:
        logger.error(f"Failed to mark dataset {dataset_id} as failed: {e}")
