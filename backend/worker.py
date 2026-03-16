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
import os
import time
from datetime import datetime, timezone
from typing import Any

from analyzer import EDAAnalyzer
from cache import cache
from celery import Celery
from loguru import logger
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
    task_acks_late=True,  # re-queue on worker crash
    worker_prefetch_multiplier=1,  # one task at a time per worker (heavy CPU tasks)
    result_expires=60 * 60 * 24,  # keep Celery results for 1 day
    # Celery Beat schedule — run all active monitors every hour on the 5-minute mark
    beat_schedule={
        "run-all-monitors": {
            "task": "run_all_monitors",
            "schedule": 60
            * 60,  # every hour (monitors gate themselves by their own cron)
        },
        "run-all-pipelines": {
            "task": "run_all_pipelines",
            "schedule": 60 * 60,  # every hour (pipelines gate by their cron)
        },
    },
)


# ── Tasks ──────────────────────────────────────────────────────────────────────


@celery_app.task(
    bind=True,
    name="analyze_dataset",
    max_retries=2,
    default_retry_delay=30,
    soft_time_limit=300,  # 5 min soft limit — task gets SoftTimeLimitExceeded
    time_limit=360,  # 6 min hard kill
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
    cache.set_job_status(
        dataset_id, "processing", {"started_at": datetime.now(timezone.utc).isoformat()}
    )

    try:
        # ── 1. Download file from R2 ───────────────────────────────────────────
        logger.info(f"[Task] Downloading from R2: {file_key}")
        file_bytes = storage.download(file_key)

        # ── 2. Check analysis cache (by file hash) ─────────────────────────────
        file_hash = hashlib.md5(file_bytes).hexdigest()
        cached = cache.get_analysis(file_hash)
        if cached:
            logger.info(
                f"[Task] Cache hit for dataset={dataset_id}, hash={file_hash[:8]}"
            )
            _save_analysis_to_db(
                database_url, dataset_id, org_id, cached, file_hash, 0.0
            )
            cache.set_job_status(dataset_id, "done")
            cache.publish_job_done(org_id, dataset_id, "cached")
            return {"analysis_id": "cached", "duration_seconds": 0.0}

        # ── 3. Parse into Polars DataFrame (no row cap) ───────────────────────
        df = _parse_bytes(file_bytes, file_format)
        logger.info(f"[Task] Parsed dataset={dataset_id}: {df.height}r x {df.width}c")

        # Update job progress
        cache.set_job_status(
            dataset_id, "processing", {"progress": 30, "stage": "analyzing"}
        )

        # ── 4. Run EDA analysis ────────────────────────────────────────────────
        analyzer = EDAAnalyzer(df)
        report = analyzer.generate_full_report()
        # Preview: convert only first 50 rows to pandas for JSON serialisation
        preview = df.head(50).to_pandas().fillna("").to_dict(orient="records")
        report["preview"] = preview

        cache.set_job_status(
            dataset_id, "processing", {"progress": 70, "stage": "generating_narrative"}
        )

        # ── 4b. AI narrative (Claude) ─────────────────────────────────────────
        from ai_narrative import generate_narrative

        narrative = generate_narrative(report, dataset_name=dataset_id)

        cache.set_job_status(
            dataset_id, "processing", {"progress": 85, "stage": "saving"}
        )

        # ── 5. Persist to Postgres + cache ────────────────────────────────────
        duration = time.time() - start_time
        analysis_id = _save_analysis_to_db(
            database_url,
            dataset_id,
            org_id,
            report,
            file_hash,
            duration,
            narrative=narrative,
        )
        cache.set_analysis(file_hash, report)

        # ── 6. Notify frontend via Redis pub/sub ──────────────────────────────
        cache.set_job_status(
            dataset_id,
            "done",
            {"analysis_id": str(analysis_id), "duration_seconds": duration},
        )
        cache.publish_job_done(org_id, dataset_id, str(analysis_id))

        logger.info(f"[Task] Completed dataset={dataset_id} in {duration:.2f}s")
        return {"analysis_id": str(analysis_id), "duration_seconds": duration}

    except Exception as exc:
        logger.error(f"[Task] Failed dataset={dataset_id}: {exc}")
        cache.set_job_status(dataset_id, "failed", {"error": str(exc)})
        cache.publish_job_failed(org_id, dataset_id, str(exc))
        _mark_dataset_failed(database_url, dataset_id, str(exc))
        raise self.retry(exc=exc)


# ── Monitor tasks ──────────────────────────────────────────────────────────────


@celery_app.task(
    bind=True, name="run_monitor_check", max_retries=1, default_retry_delay=60
)
def run_monitor_check(self, monitor_id: str, database_url: str) -> dict:
    """
    Execute a single monitor check against the latest analysis and persist the result.
    Sends a Slack alert if the condition is triggered.
    """
    import psycopg2
    from psycopg2.extras import Json

    db_url = database_url.replace("postgresql+asyncpg://", "postgresql://").replace(
        "postgres://", "postgresql://"
    )
    if not db_url:
        logger.warning("run_monitor_check: DATABASE_URL not set, skipping")
        return {"skipped": True}

    try:
        conn = psycopg2.connect(db_url)
        with conn:
            with conn.cursor() as cur:
                # Load monitor
                cur.execute(
                    """
                    SELECT m.id, m.dataset_id, m.org_id, m.name, m.check_type,
                           m.column_name, m.condition, m.threshold
                    FROM monitors m
                    WHERE m.id = %s AND m.is_active = true
                    """,
                    (monitor_id,),
                )
                row = cur.fetchone()
                if row is None:
                    return {"skipped": True, "reason": "monitor not found or inactive"}

                (
                    _,
                    dataset_id,
                    org_id,
                    name,
                    check_type,
                    column_name,
                    condition,
                    threshold,
                ) = row

                # Load latest analysis
                cur.execute(
                    """
                    SELECT report FROM analyses
                    WHERE dataset_id = %s
                    ORDER BY version DESC LIMIT 1
                    """,
                    (str(dataset_id),),
                )
                analysis_row = cur.fetchone()
                if analysis_row is None:
                    _insert_monitor_run(
                        cur, monitor_id, "error", None, "No analysis found"
                    )
                    _update_monitor_status(cur, monitor_id, "error")
                    return {"status": "error", "reason": "no analysis"}

                report = analysis_row[0]
                actual_value, message = _evaluate_monitor(
                    report, check_type, column_name, condition, threshold
                )
                status = "triggered" if message.startswith("TRIGGERED") else "ok"

                _insert_monitor_run(cur, monitor_id, status, actual_value, message)
                _update_monitor_status(cur, monitor_id, status)

        conn.close()

        if status == "triggered":
            _send_slack_alert(
                name,
                check_type,
                column_name,
                condition,
                threshold,
                actual_value,
                message,
            )

        logger.info(
            f"Monitor {monitor_id} ({check_type}): {status} | value={actual_value}"
        )
        return {
            "monitor_id": monitor_id,
            "status": status,
            "actual_value": actual_value,
        }

    except Exception as exc:
        logger.error(f"run_monitor_check failed for {monitor_id}: {exc}")
        raise self.retry(exc=exc)


@celery_app.task(name="run_all_monitors")
def run_all_monitors() -> dict:
    """
    Hourly task: load all active monitors, evaluate their cron schedule,
    and dispatch individual run_monitor_check tasks for those that are due.
    """
    from datetime import datetime, timezone

    import psycopg2
    from croniter import croniter

    database_url = os.getenv("DATABASE_URL", "")
    db_url = database_url.replace("postgresql+asyncpg://", "postgresql://").replace(
        "postgres://", "postgresql://"
    )
    if not db_url:
        return {"skipped": True}

    now = datetime.now(timezone.utc)
    dispatched = 0

    try:
        conn = psycopg2.connect(db_url)
        with conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id, schedule FROM monitors WHERE is_active = true")
                for monitor_id, schedule in cur.fetchall():
                    try:
                        cron = croniter(schedule, now)
                        # Check if the monitor was due in the past hour
                        prev_run = cron.get_prev(datetime)
                        if (now - prev_run).total_seconds() < 3600:
                            run_monitor_check.delay(str(monitor_id), database_url)
                            dispatched += 1
                    except Exception as e:
                        logger.warning(f"Invalid cron for monitor {monitor_id}: {e}")
        conn.close()
    except Exception as e:
        logger.error(f"run_all_monitors failed: {e}")

    logger.info(f"run_all_monitors dispatched {dispatched} checks")
    return {"dispatched": dispatched}


# ── Pipeline tasks ─────────────────────────────────────────────────────────────


@celery_app.task(
    bind=True, name="run_pipeline_recipe", max_retries=1, default_retry_delay=60
)
def run_pipeline_recipe(
    self, pipeline_id: str, run_id: str | None, database_url: str
) -> dict:
    """
    Execute a pipeline recipe:
      1) Load source dataset
      2) Apply transform nodes
      3) Save transformed dataset as a new upload
      4) Trigger async analysis on output dataset
      5) Persist run status/logs/metrics
    """
    import uuid

    import pandas as pd
    import psycopg2
    from psycopg2.extras import Json

    db_url = database_url.replace("postgresql+asyncpg://", "postgresql://").replace(
        "postgres://", "postgresql://"
    )
    if not db_url:
        logger.warning("run_pipeline_recipe: DATABASE_URL not set, skipping")
        return {"skipped": True}

    log_lines: list[str] = []
    output_dataset_id: str | None = None

    def _log(message: str) -> None:
        log_lines.append(message)
        logger.info(message)

    try:
        conn = psycopg2.connect(db_url)
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, org_id, created_by, source_dataset_id, name, graph, version, schedule, is_active
                    FROM pipeline_recipes
                    WHERE id = %s
                    """,
                    (pipeline_id,),
                )
                row = cur.fetchone()
                if row is None:
                    return {"error": "pipeline not found"}

                (
                    recipe_id,
                    org_id,
                    created_by,
                    source_dataset_id,
                    recipe_name,
                    graph,
                    recipe_version,
                    _schedule,
                    _is_active,
                ) = row

                if run_id is None:
                    run_id = str(uuid.uuid4())
                    cur.execute(
                        """
                        INSERT INTO pipeline_runs
                          (id, pipeline_id, org_id, triggered_by, recipe_version, trigger_type, status, started_at)
                        VALUES (%s, %s, %s, %s, %s, 'schedule', 'running', NOW())
                        """,
                        (run_id, recipe_id, org_id, created_by, recipe_version),
                    )
                else:
                    cur.execute(
                        """
                        UPDATE pipeline_runs
                        SET status = 'running', started_at = NOW()
                        WHERE id = %s
                        """,
                        (run_id,),
                    )

                if source_dataset_id is None:
                    raise RuntimeError("Pipeline has no source_dataset_id configured")

                cur.execute(
                    """
                    SELECT id, file_key, file_format
                    FROM datasets
                    WHERE id = %s AND org_id = %s
                    """,
                    (str(source_dataset_id), str(org_id)),
                )
                source_row = cur.fetchone()
                if source_row is None:
                    raise RuntimeError("Source dataset not found")
                source_id, file_key, file_format = source_row

        _log(f"Pipeline {pipeline_id}: loading source dataset {source_id}")
        source_bytes = storage.download(file_key)
        source_df = _parse_bytes(source_bytes, file_format).to_pandas()
        input_rows = int(len(source_df))
        input_cols = int(len(source_df.columns))
        _log(f"Loaded source with {input_rows} rows and {input_cols} columns")

        transformed_df, transform_logs = _apply_pipeline_graph(source_df, graph or {})
        for line in transform_logs:
            _log(line)

        output_rows = int(len(transformed_df))
        output_cols = int(len(transformed_df.columns))
        _log(f"Transform output has {output_rows} rows and {output_cols} columns")

        output_dataset_id = str(uuid.uuid4())
        safe_name = "".join(
            ch if ch.isalnum() or ch in ("-", "_") else "_"
            for ch in str(recipe_name).lower()
        )[:40]
        output_filename = f"{safe_name or 'pipeline_output'}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
        output_bytes = transformed_df.to_csv(index=False).encode("utf-8")
        storage.upload(str(org_id), output_dataset_id, output_filename, output_bytes)
        _log(f"Uploaded output file to storage as {output_filename}")

        with psycopg2.connect(db_url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO datasets
                      (id, org_id, created_by, name, original_filename, file_key, file_size_bytes, file_format, status)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, 'csv', 'pending')
                    """,
                    (
                        output_dataset_id,
                        str(org_id),
                        str(created_by),
                        f"{recipe_name} output",
                        output_filename,
                        f"uploads/{org_id}/{output_dataset_id}/{output_filename}",
                        len(output_bytes),
                    ),
                )
        _log(f"Created output dataset row {output_dataset_id}")

        analysis_result = analyze_dataset.delay(
            dataset_id=output_dataset_id,
            org_id=str(org_id),
            file_key=f"uploads/{org_id}/{output_dataset_id}/{output_filename}",
            file_format="csv",
            database_url=database_url,
        )
        _log(f"Queued analysis job {analysis_result.id} for output dataset")

        metrics = {
            "input_rows": input_rows,
            "input_cols": input_cols,
            "output_rows": output_rows,
            "output_cols": output_cols,
            "output_dataset_id": output_dataset_id,
            "analysis_job_id": analysis_result.id,
            "steps_executed": len(transform_logs),
        }

        with psycopg2.connect(db_url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE pipeline_runs
                    SET status = 'success',
                        logs = %s,
                        metrics = %s,
                        output_dataset_id = %s,
                        finished_at = NOW()
                    WHERE id = %s
                    """,
                    ("\n".join(log_lines), Json(metrics), output_dataset_id, run_id),
                )
                cur.execute(
                    """
                    UPDATE pipeline_recipes
                    SET last_run_at = NOW(), last_run_status = 'success', updated_at = NOW()
                    WHERE id = %s
                    """,
                    (pipeline_id,),
                )
        return {
            "pipeline_id": pipeline_id,
            "run_id": run_id,
            "status": "success",
            **metrics,
        }

    except Exception as exc:
        logger.error(f"run_pipeline_recipe failed for {pipeline_id}: {exc}")
        try:
            with psycopg2.connect(db_url) as conn:
                with conn.cursor() as cur:
                    if run_id:
                        cur.execute(
                            """
                            UPDATE pipeline_runs
                            SET status = 'failed', logs = %s, metrics = %s, finished_at = NOW()
                            WHERE id = %s
                            """,
                            (
                                "\n".join(log_lines + [f"ERROR: {exc}"]),
                                Json(
                                    {
                                        "error": str(exc),
                                        "output_dataset_id": output_dataset_id,
                                    }
                                ),
                                run_id,
                            ),
                        )
                    cur.execute(
                        """
                        UPDATE pipeline_recipes
                        SET last_run_at = NOW(), last_run_status = 'failed', updated_at = NOW()
                        WHERE id = %s
                        """,
                        (pipeline_id,),
                    )
        except Exception:
            logger.exception("Failed to persist pipeline failure status")
        raise self.retry(exc=exc)


@celery_app.task(name="run_all_pipelines")
def run_all_pipelines() -> dict:
    """Dispatch due active pipelines based on cron schedules."""
    from datetime import datetime, timezone

    import psycopg2
    from croniter import croniter

    database_url = os.getenv("DATABASE_URL", "")
    db_url = database_url.replace("postgresql+asyncpg://", "postgresql://").replace(
        "postgres://", "postgresql://"
    )
    if not db_url:
        return {"skipped": True}

    now = datetime.now(timezone.utc)
    dispatched = 0

    try:
        conn = psycopg2.connect(db_url)
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, schedule FROM pipeline_recipes WHERE is_active = true"
                )
                for pipeline_id, schedule in cur.fetchall():
                    try:
                        cron = croniter(schedule, now)
                        prev_run = cron.get_prev(datetime)
                        if (now - prev_run).total_seconds() < 3600:
                            run_pipeline_recipe.delay(
                                str(pipeline_id), None, database_url
                            )
                            dispatched += 1
                    except Exception as e:
                        logger.warning(f"Invalid cron for pipeline {pipeline_id}: {e}")
        conn.close()
    except Exception as e:
        logger.error(f"run_all_pipelines failed: {e}")

    logger.info(f"run_all_pipelines dispatched {dispatched} runs")
    return {"dispatched": dispatched}


# ── Monitor evaluation ─────────────────────────────────────────────────────────


def _evaluate_monitor(
    report: dict,
    check_type: str,
    column_name: str | None,
    condition: str,
    threshold: float,
) -> tuple[float | None, str]:
    """Evaluate a monitor check against an EDA report. Returns (actual_value, message)."""
    try:
        if check_type == "row_count":
            actual = float(report.get("basic_info", {}).get("rows", 0))
        elif check_type == "quality_score":
            actual = float(report.get("quality_score", {}).get("overall_score", 0))
        elif check_type == "null_rate":
            cols = {c["name"]: c for c in report.get("column_analysis", [])}
            if column_name not in cols:
                return None, f"Column '{column_name}' not found in analysis"
            actual = float(cols[column_name].get("missing_percent", 0))
        elif check_type == "column_drift":
            cols = {c["name"]: c for c in report.get("column_analysis", [])}
            if column_name not in cols:
                return None, f"Column '{column_name}' not found in analysis"
            stats = cols[column_name].get("stats") or {}
            actual = float(stats.get("mean", 0))
        else:
            return None, f"Unknown check_type: {check_type}"

        triggered = _check_condition(actual, condition, threshold)
        if triggered:
            return (
                actual,
                f"TRIGGERED: {check_type} = {actual:.4g} {condition} {threshold}",
            )
        return actual, f"ok: {check_type} = {actual:.4g}"

    except Exception as e:
        return None, f"Evaluation error: {e}"


def _check_condition(actual: float, condition: str, threshold: float) -> bool:
    if condition == "lt":
        return actual < threshold
    if condition == "gt":
        return actual > threshold
    if condition == "eq":
        return abs(actual - threshold) < 1e-9
    if condition == "change_pct":
        return (
            abs(actual - threshold) / max(abs(threshold), 1e-9) * 100 > 20
        )  # >20% drift
    return False


def _insert_monitor_run(cur, monitor_id: str, status: str, actual_value, message: str):
    import uuid

    cur.execute(
        """
        INSERT INTO monitor_runs (id, monitor_id, status, actual_value, message)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (str(uuid.uuid4()), monitor_id, status, actual_value, message[:500]),
    )


def _update_monitor_status(cur, monitor_id: str, status: str):
    cur.execute(
        """
        UPDATE monitors
        SET last_status = %s, last_checked_at = NOW()
        WHERE id = %s
        """,
        (status, monitor_id),
    )


def _send_slack_alert(
    monitor_name: str,
    check_type: str,
    column_name: str | None,
    condition: str,
    threshold: float,
    actual_value: float | None,
    message: str,
) -> None:
    """POST a Slack webhook notification when a monitor is triggered."""
    import httpx

    webhook_url = os.getenv("SLACK_WEBHOOK_URL", "")
    if not webhook_url:
        logger.debug("SLACK_WEBHOOK_URL not set — skipping Slack alert")
        return

    col_info = f" (column: `{column_name}`)" if column_name else ""
    text = (
        f":red_circle: *Data Monitor Alert* — _{monitor_name}_\n"
        f"Check: `{check_type}`{col_info}\n"
        f"Condition: `{condition}` threshold `{threshold}`\n"
        f"Actual value: `{actual_value}`\n"
        f"_{message}_"
    )
    try:
        resp = httpx.post(webhook_url, json={"text": text}, timeout=5)
        resp.raise_for_status()
        logger.info(f"Slack alert sent for monitor '{monitor_name}'")
    except Exception as e:
        logger.warning(f"Failed to send Slack alert: {e}")


# ── Pipeline transformation helpers ───────────────────────────────────────────


def _apply_pipeline_graph(df, graph: dict) -> tuple[Any, list[str]]:
    """
    Execute transform nodes from a pipeline graph.
    Expected node format:
      {"type":"transform","data":{"operation":"select_columns","params":{...},"order":1}}
    """
    import pandas as pd

    working = df.copy()
    logs: list[str] = []
    nodes = graph.get("nodes", []) if isinstance(graph, dict) else []
    steps = []

    for idx, node in enumerate(nodes):
        if not isinstance(node, dict):
            continue
        data = node.get("data", {}) if isinstance(node.get("data"), dict) else {}
        node_type = node.get("type")
        operation = data.get("operation") or node.get("operation")
        params = (
            data.get("params")
            if isinstance(data.get("params"), dict)
            else node.get("params", {})
        )
        if node_type == "transform" or operation:
            steps.append(
                {
                    "order": data.get("order", idx),
                    "operation": operation,
                    "params": params if isinstance(params, dict) else {},
                }
            )

    for step in sorted(steps, key=lambda s: s["order"]):
        op = step.get("operation")
        params = step.get("params", {})
        if not op:
            continue

        if op == "select_columns":
            cols = [c for c in params.get("columns", []) if c in working.columns]
            if cols:
                working = working[cols]
                logs.append(f"select_columns: kept {len(cols)} columns")
            else:
                logs.append("select_columns: skipped (no valid columns)")
        elif op == "filter_rows":
            col = params.get("column")
            operator = params.get("operator", "eq")
            value = params.get("value")
            if col not in working.columns:
                logs.append(f"filter_rows: skipped (column '{col}' missing)")
                continue
            before = len(working)
            series = working[col]
            if operator == "eq":
                mask = series == value
            elif operator == "ne":
                mask = series != value
            elif operator == "gt":
                mask = pd.to_numeric(series, errors="coerce") > float(value)
            elif operator == "gte":
                mask = pd.to_numeric(series, errors="coerce") >= float(value)
            elif operator == "lt":
                mask = pd.to_numeric(series, errors="coerce") < float(value)
            elif operator == "lte":
                mask = pd.to_numeric(series, errors="coerce") <= float(value)
            elif operator == "contains":
                mask = series.astype(str).str.contains(str(value), case=False, na=False)
            else:
                mask = pd.Series([True] * len(working), index=working.index)
            working = working[mask]
            logs.append(f"filter_rows: {before - len(working)} rows filtered")
        elif op == "rename_columns":
            mapping = params.get("mapping", {})
            if isinstance(mapping, dict) and mapping:
                working = working.rename(columns=mapping)
                logs.append(f"rename_columns: renamed {len(mapping)} columns")
        elif op == "sort_rows":
            col = params.get("column")
            ascending = bool(params.get("ascending", True))
            if col in working.columns:
                working = working.sort_values(by=col, ascending=ascending)
                logs.append(
                    f"sort_rows: sorted by {col} ({'asc' if ascending else 'desc'})"
                )
        elif op == "limit_rows":
            limit = int(params.get("limit", 1000))
            working = working.head(max(0, limit))
            logs.append(f"limit_rows: limited to {limit} rows")
        elif op == "fill_missing":
            col = params.get("column")
            value = params.get("value", "")
            if col and col in working.columns:
                working[col] = working[col].fillna(value)
                logs.append(f"fill_missing: filled nulls in {col}")
            elif not col:
                working = working.fillna(value)
                logs.append("fill_missing: filled nulls in all columns")
        elif op == "drop_missing":
            subset = params.get("subset")
            if isinstance(subset, list) and subset:
                valid = [c for c in subset if c in working.columns]
                working = working.dropna(subset=valid)
                logs.append(
                    f"drop_missing: dropped rows with nulls in {len(valid)} columns"
                )
            else:
                working = working.dropna()
                logs.append("drop_missing: dropped rows with any null")
        elif op == "derive_column":
            target = params.get("target")
            expression = params.get("expression")
            if target and expression:
                try:
                    # Restrict eval to numexpr engine (arithmetic only, no Python code execution)
                    working[target] = pd.eval(
                        str(expression),
                        local_dict={col: working[col] for col in working.columns},
                        engine="numexpr",
                    )
                    logs.append(f"derive_column: computed {target}")
                except Exception as exc:
                    logger.warning(
                        f"derive_column: unsafe or invalid expression skipped "
                        f"for target '{target}': {exc}"
                    )
                    logs.append(
                        f"derive_column: skipped for target {target} (expression rejected)"
                    )
        else:
            logs.append(f"unknown_operation: {op} (skipped)")

    return working, logs


# ── DB helpers (synchronous — no asyncio in Celery workers) ────────────────────


def _parse_bytes(data: bytes, file_format: str):
    """Parse raw bytes into a Polars DataFrame using the fast I/O layer."""
    from polars_loader import parse_to_polars

    return parse_to_polars(data, file_format)


def _save_analysis_to_db(
    database_url: str,
    dataset_id: str,
    org_id: str,
    report: dict,
    file_hash: str,
    duration: float,
    narrative: str | None = None,
) -> str:
    """Synchronously write the Analysis row and update Dataset.status using psycopg2."""
    import uuid

    import psycopg2
    from psycopg2.extras import Json

    # Convert asyncpg URL to psycopg2 URL
    db_url = database_url.replace("postgresql+asyncpg://", "postgresql://").replace(
        "postgres://", "postgresql://"
    )

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

                # Insert analysis (with AI narrative)
                cur.execute(
                    """
                    INSERT INTO analyses
                      (id, dataset_id, org_id, version, report, ai_narrative, job_id, duration_seconds)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        analysis_id,
                        dataset_id,
                        org_id,
                        version,
                        Json(report),
                        narrative,
                        file_hash,
                        duration,
                    ),
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
        logger.info(
            f"Saved Analysis id={analysis_id} v{version} for dataset={dataset_id}"
        )
    except Exception as e:
        logger.error(f"DB write failed for dataset={dataset_id}: {e}")
        raise

    return analysis_id


def _mark_dataset_failed(database_url: str, dataset_id: str, error: str) -> None:
    """Mark a dataset as failed in Postgres."""
    import psycopg2

    db_url = database_url.replace("postgresql+asyncpg://", "postgresql://").replace(
        "postgres://", "postgresql://"
    )
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
