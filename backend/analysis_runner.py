"""
Background analysis runner — single-process replacement for the Celery worker.

`run_analysis` is scheduled via FastAPI BackgroundTasks from the upload
endpoint. It runs in the same process as the API server:

  1. Downloads the file from storage (R2 or local FS fallback)
  2. Runs EDAAnalyzer (Polars) in a worker thread
  3. Generates the AI narrative (Claude) if ANTHROPIC_API_KEY is set
  4. Stores the Analysis row via the app's async SQLAlchemy session
     (works with both Postgres and the SQLite demo fallback)
  5. Publishes job progress/completion through cache (Redis or in-process),
     which the SSE endpoint in routers/jobs.py forwards to the browser

CPU-heavy steps run in threads (asyncio.to_thread) so the event loop stays
responsive for other requests while an analysis is in flight.
"""

import asyncio
import hashlib
import math
import time
import uuid
from typing import Any, Optional

from loguru import logger
from sqlalchemy import select

from analyzer import EDAAnalyzer
from cache import cache
from storage import storage


def sanitize_json(obj: Any) -> Any:
    """Return JSON-safe data: NaN/Inf → None, numpy scalars → Python scalars."""
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    if isinstance(obj, dict):
        return {k: sanitize_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize_json(v) for v in obj]
    if hasattr(obj, "item"):
        try:
            return sanitize_json(obj.item())
        except Exception:
            return str(obj)
    return obj


def _analyze_bytes(file_bytes: bytes, file_format: str) -> tuple[dict, int, int]:
    """Parse + analyze in a plain (thread-safe) function. Returns (report, rows, cols)."""
    from polars_loader import parse_to_polars

    df = parse_to_polars(file_bytes, file_format)
    report = EDAAnalyzer(df).generate_full_report()
    report["preview"] = df.head(50).to_pandas().fillna("").to_dict(orient="records")
    return sanitize_json(report), df.height, df.width


async def _save_analysis(
    dataset_id: str,
    org_id: str,
    report: dict,
    file_hash: str,
    duration: float,
    rows: Optional[int],
    cols: Optional[int],
    narrative: Optional[str],
) -> str:
    """Insert the Analysis row and mark the Dataset ready. Own session — safe in background."""
    from db.connection import AsyncSessionLocal
    from db.models import Analysis, Dataset

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Analysis.version)
            .where(Analysis.dataset_id == uuid.UUID(dataset_id))
            .order_by(Analysis.version.desc())
            .limit(1)
        )
        latest = result.scalar_one_or_none()
        analysis = Analysis(
            dataset_id=uuid.UUID(dataset_id),
            org_id=uuid.UUID(org_id),
            version=(latest or 0) + 1,
            report=report,
            ai_narrative=narrative,
            job_id=file_hash,
            duration_seconds=duration,
        )
        db.add(analysis)

        ds_result = await db.execute(
            select(Dataset).where(Dataset.id == uuid.UUID(dataset_id))
        )
        dataset = ds_result.scalar_one_or_none()
        if dataset is not None:
            dataset.status = "ready"
            dataset.row_count = rows
            dataset.column_count = cols
            dataset.error_message = None

        await db.commit()
        return str(analysis.id)


async def _mark_failed(dataset_id: str, error: str) -> None:
    from db.connection import AsyncSessionLocal
    from db.models import Dataset

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Dataset).where(Dataset.id == uuid.UUID(dataset_id))
            )
            dataset = result.scalar_one_or_none()
            if dataset is not None:
                dataset.status = "failed"
                dataset.error_message = error[:500]
                await db.commit()
    except Exception as e:
        logger.error(f"Failed to mark dataset {dataset_id} as failed: {e}")


async def run_analysis(
    dataset_id: str,
    org_id: str,
    file_key: str,
    file_format: str,
) -> None:
    """Full analysis pipeline for one uploaded dataset. Never raises."""
    start_time = time.time()
    logger.info(f"[Runner] Starting analysis: dataset={dataset_id}")
    cache.set_job_status(dataset_id, "processing", {"progress": 10, "stage": "loading"})

    try:
        file_bytes = await asyncio.to_thread(storage.download, file_key)

        # Cache hit: reuse a prior report + narrative for identical file content
        file_hash = hashlib.md5(file_bytes).hexdigest()
        cached = cache.get_analysis(file_hash)
        if cached and isinstance(cached, dict) and "report" in cached:
            report = cached["report"]
            narrative = cached.get("narrative")
            bi = report.get("basic_info", {})
            rows, cols = bi.get("rows"), bi.get("columns")
            logger.info(f"[Runner] Cache hit for dataset={dataset_id}")
        else:
            cache.set_job_status(
                dataset_id, "processing", {"progress": 30, "stage": "analyzing"}
            )
            report, rows, cols = await asyncio.to_thread(
                _analyze_bytes, file_bytes, file_format
            )

            cache.set_job_status(
                dataset_id,
                "processing",
                {"progress": 70, "stage": "generating_narrative"},
            )
            from ai_limits import ai_budget_exhausted, consume_ai_budget
            from ai_narrative import generate_narrative

            if ai_budget_exhausted():
                logger.warning("Global AI budget exhausted — skipping auto-narrative")
                narrative = None
            else:
                narrative = await asyncio.to_thread(
                    generate_narrative, report, dataset_id
                )
                if narrative is not None:
                    consume_ai_budget()
            cache.set_analysis(file_hash, {"report": report, "narrative": narrative})

        cache.set_job_status(dataset_id, "processing", {"progress": 85, "stage": "saving"})
        duration = round(time.time() - start_time, 2)
        analysis_id = await _save_analysis(
            dataset_id, org_id, report, file_hash, duration, rows, cols, narrative
        )

        cache.set_job_status(
            dataset_id,
            "done",
            {
                "analysis_id": analysis_id,
                "duration_seconds": duration,
                "progress": 100,
                "stage": "complete",
            },
        )
        cache.publish_job_done(org_id, dataset_id, analysis_id)
        logger.info(f"[Runner] Completed dataset={dataset_id} in {duration:.2f}s")

    except Exception as exc:
        logger.exception(f"[Runner] Failed dataset={dataset_id}: {exc}")
        cache.set_job_status(dataset_id, "failed", {"error": str(exc)})
        cache.publish_job_failed(org_id, dataset_id, str(exc))
        await _mark_failed(dataset_id, str(exc))
