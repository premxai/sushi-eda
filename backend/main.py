import io
import json
import os
import uuid
from typing import Optional, Any

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.redis import RedisIntegration
import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from loguru import logger

from analyzer import EDAAnalyzer
from visualizer import Visualizer
from advanced_stats import AdvancedStatistics
from export_utils import DataExporter
from cache import cache
from storage import storage
from worker import analyze_dataset
from routers import webhooks, jobs as jobs_router
from routers.billing import router as billing_router
from routers.comments import router as comments_router
from routers.connectors import router as connectors_router
from routers.datasets import router as datasets_router, analyses_router, credits_router
from routers.integrations import router as integrations_router
from routers.monitors import router as monitors_router
from routers.pipelines import router as pipelines_router
from routers.shares import router as shares_router
from routers.slack_bot import router as slack_router

# ── Sentry ─────────────────────────────────────────────────────────────────────
_SENTRY_DSN = os.getenv("SENTRY_DSN", "")
if _SENTRY_DSN:
    sentry_sdk.init(
        dsn=_SENTRY_DSN,
        environment=os.getenv("ENVIRONMENT", "production"),
        release=os.getenv("SENTRY_RELEASE", "sushi@1.0.0"),
        traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
        integrations=[
            StarletteIntegration(transaction_style="endpoint"),
            FastApiIntegration(transaction_style="endpoint"),
            CeleryIntegration(monitor_beat_tasks=False),
            RedisIntegration(),
        ],
        # Don't send PII (user emails, IPs) by default
        send_default_pii=False,
    )
    logger.info("Sentry initialized")
else:
    logger.info("SENTRY_DSN not set — Sentry disabled")

# Configure logging
logger.add("logs/app.log", rotation="500 MB", retention="10 days", level="INFO")

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Sushi EDA API", version="1.0.0")

# CORS configuration - allow all origins for development and preview deployments
# In production, consider restricting to specific domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins including Vercel preview URLs
    allow_credentials=False,  # Must be False when allow_origins=["*"]
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],  # Allow frontend to read all response headers
    max_age=3600,  # Cache preflight requests for 1 hour
)

# Add rate limiter to app
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Mount routers
app.include_router(webhooks.router)
app.include_router(jobs_router.router)
app.include_router(billing_router)
app.include_router(shares_router)
app.include_router(connectors_router)
app.include_router(integrations_router)
app.include_router(monitors_router)
app.include_router(comments_router)
app.include_router(pipelines_router)
app.include_router(datasets_router)
app.include_router(analyses_router)
app.include_router(credits_router)
app.include_router(slack_router)

# In-memory store for the last uploaded DataFrame (single-user dev tool)
_current_df: Optional[pd.DataFrame] = None

# Simple in-memory cache for analysis results (file hash -> report)
_analysis_cache: dict[str, Any] = {}

def get_file_hash(contents: bytes) -> str:
    """Generate hash for file contents for caching."""
    import hashlib
    return hashlib.md5(contents).hexdigest()


def read_upload(file: UploadFile) -> pd.DataFrame:
    """Parse an uploaded file into a pandas DataFrame."""
    contents = file.file.read()
    filename = file.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "csv":
        return pd.read_csv(io.BytesIO(contents))
    elif ext == "tsv":
        return pd.read_csv(io.BytesIO(contents), sep="\t")
    elif ext in ("xls", "xlsx"):
        return pd.read_excel(io.BytesIO(contents), engine="openpyxl")
    elif ext == "parquet":
        return pd.read_parquet(io.BytesIO(contents))
    elif ext in ("db", "sqlite", "sqlite3"):
        # For SQLite, we need to save to a temp file
        import tempfile
        import sqlite3
        with tempfile.NamedTemporaryFile(delete=False, suffix=".db") as tmp:
            tmp.write(contents)
            tmp_path = tmp.name
        
        try:
            conn = sqlite3.connect(tmp_path)
            # Get list of tables
            tables = pd.read_sql_query("SELECT name FROM sqlite_master WHERE type='table'", conn)
            if len(tables) == 0:
                raise HTTPException(status_code=400, detail="No tables found in SQLite database")
            
            # Use the first table (or we could let user select)
            table_name = tables.iloc[0]['name']
            df = pd.read_sql_query(f"SELECT * FROM {table_name}", conn)
            conn.close()
            
            # Clean up temp file
            import os
            os.unlink(tmp_path)
            
            return df
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to read SQLite database: {str(e)}")
    elif ext == "json":
        data = json.loads(contents.decode('utf-8'))
        if isinstance(data, list):
            df = pd.json_normalize(data, max_level=1) if data else pd.DataFrame()
        elif isinstance(data, dict):
            df = pd.json_normalize([data], max_level=1)
        else:
            raise HTTPException(status_code=400, detail="JSON must be an array or object")
        
        # Convert any remaining dict/list columns to strings to avoid unhashable type errors
        for col in df.columns:
            if df[col].apply(lambda x: isinstance(x, (dict, list))).any():
                df[col] = df[col].apply(lambda x: json.dumps(x) if isinstance(x, (dict, list)) else x)
        
        return df
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: .{ext}. Accepted: csv, tsv, xlsx, xls, parquet, sqlite, json",
        )


@app.post("/upload")
@limiter.limit("10/minute")
async def upload_file(request: Request, file: UploadFile = File(...)):
    global _current_df
    
    logger.info(f"File upload request: {file.filename}")
    
    try:
        # Read file contents for hashing
        contents = file.file.read()
        file_hash = get_file_hash(contents)
        
        # Check cache
        if file_hash in _analysis_cache:
            logger.info(f"Cache hit for file: {file.filename}")
            _current_df = _analysis_cache[file_hash]["df"]
            return _analysis_cache[file_hash]["report"]
        
        # Reset file pointer for parsing
        file.file.seek(0)
        
        # Parse file
        df = read_upload(file)
        logger.info(f"Successfully parsed file: {file.filename}, shape: {df.shape}")
        
        _current_df = df

        # Run analysis
        logger.info(f"Starting analysis for {file.filename}")
        analyzer = EDAAnalyzer(df)
        report = analyzer.generate_full_report()
        logger.info(f"Analysis complete for {file.filename}")

        # Include a data preview (first 50 rows)
        preview = df.head(50).fillna("").to_dict(orient="records")  # type: ignore[attr-defined]
        report["preview"] = preview
        
        # Cache the result
        _analysis_cache[file_hash] = {"df": df, "report": report}
        logger.info(f"Cached result for {file.filename} with hash {file_hash[:8]}")

        return report
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing file {file.filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@app.post("/analyze")
async def analyze_file(file: UploadFile = File(...)):
    """Upload + full analysis + all Plotly visualizations in one response."""
    global _current_df
    try:
        df = read_upload(file)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {str(e)}")

    _current_df = df

    analyzer = EDAAnalyzer(df)
    report = analyzer.generate_full_report()
    preview = df.head(50).fillna("").to_dict(orient="records")
    report["preview"] = preview

    viz = Visualizer(df)
    visualizations = viz.generate_all_visualizations()

    return {"analysis": report, "visualizations": visualizations}


@app.get("/visualize/{column_name}")
async def visualize_column(column_name: str, chart_type: str = "auto"):
    """On-demand chart generation for a single column."""
    if _current_df is None:
        raise HTTPException(status_code=400, detail="No dataset loaded. Upload a file first.")

    if column_name not in _current_df.columns:
        raise HTTPException(status_code=404, detail=f"Column '{column_name}' not found")

    viz = Visualizer(_current_df)
    is_numeric = pd.api.types.is_numeric_dtype(_current_df[column_name])

    if chart_type == "auto":
        chart_type = "distribution" if is_numeric else "categorical_bar"

    if chart_type == "distribution":
        return viz.create_distribution_plot(column_name)
    elif chart_type == "box_plot":
        return viz.create_box_plot(column_name)
    elif chart_type == "categorical_bar":
        return viz.create_categorical_bar(column_name)
    else:
        raise HTTPException(status_code=400,
                            detail=f"Unknown chart_type '{chart_type}'. Use: distribution, box_plot, categorical_bar")


@app.get("/visualize")
async def visualize_all():
    """Generate all visualizations for the currently loaded dataset."""
    if _current_df is None:
        raise HTTPException(status_code=400, detail="No dataset loaded. Upload a file first.")

    viz = Visualizer(_current_df)
    return viz.generate_all_visualizations()


@app.post("/compare")
async def compare_datasets(file1: UploadFile = File(...), file2: UploadFile = File(...)):
    """Compare two datasets side-by-side."""
    try:
        df1 = read_upload(file1)
        df2 = read_upload(file2)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse files: {str(e)}")

    analyzer1 = EDAAnalyzer(df1)
    analyzer2 = EDAAnalyzer(df2)
    
    report1 = analyzer1.generate_full_report()
    report2 = analyzer2.generate_full_report()
    
    preview1 = df1.head(50).fillna("").to_dict(orient="records")
    preview2 = df2.head(50).fillna("").to_dict(orient="records")
    
    report1["preview"] = preview1
    report2["preview"] = preview2
    
    # Generate comparison insights
    comparison = {
        "schema_diff": {
            "file1_only": list(set(df1.columns) - set(df2.columns)),
            "file2_only": list(set(df2.columns) - set(df1.columns)),
            "common": list(set(df1.columns) & set(df2.columns)),
        },
        "row_count_diff": int(df1.shape[0]) - int(df2.shape[0]),
        "column_count_diff": int(df1.shape[1]) - int(df2.shape[1]),
    }
    
    return {
        "file1": {"name": file1.filename, "report": report1},
        "file2": {"name": file2.filename, "report": report2},
        "comparison": comparison,
    }


@app.get("/stats/advanced")
async def get_advanced_stats():
    """Get advanced statistical tests for the current dataset."""
    if _current_df is None:
        raise HTTPException(status_code=400, detail="No dataset loaded. Upload a file first.")
    
    stats_analyzer = AdvancedStatistics(_current_df)
    return stats_analyzer.generate_all_tests()


@app.post("/stats/regression")
async def perform_regression(x_col: str, y_col: str):
    """Perform linear regression between two columns."""
    if _current_df is None:
        raise HTTPException(status_code=400, detail="No dataset loaded. Upload a file first.")
    
    stats_analyzer = AdvancedStatistics(_current_df)
    return stats_analyzer.linear_regression(x_col, y_col)


@app.post("/stats/ttest")
async def perform_ttest(col1: str, col2: str):
    """Perform independent t-test between two columns."""
    if _current_df is None:
        raise HTTPException(status_code=400, detail="No dataset loaded. Upload a file first.")
    
    stats_analyzer = AdvancedStatistics(_current_df)
    return stats_analyzer.t_test_independent(col1, col2)


@app.get("/export/excel")
async def export_to_excel():
    """Export current dataset and analysis to Excel."""
    if _current_df is None:
        raise HTTPException(status_code=400, detail="No dataset loaded. Upload a file first.")
    
    # Get the cached report
    file_hash = None
    report = None
    for hash_key, cache_data in _analysis_cache.items():
        if cache_data["df"].equals(_current_df):
            file_hash = hash_key
            report = cache_data["report"]
            break
    
    if report is None:
        # Generate report if not cached
        analyzer = EDAAnalyzer(_current_df)
        report = analyzer.generate_full_report()
    
    exporter = DataExporter(_current_df, report)
    excel_data = exporter.to_excel()
    
    from fastapi.responses import Response
    return Response(
        content=excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=sushi_analysis.xlsx"}
    )


@app.get("/export/markdown")
async def export_to_markdown():
    """Export analysis report as markdown."""
    if _current_df is None:
        raise HTTPException(status_code=400, detail="No dataset loaded. Upload a file first.")
    
    # Get the cached report
    report = None
    for cache_data in _analysis_cache.values():
        if cache_data["df"].equals(_current_df):
            report = cache_data["report"]
            break
    
    if report is None:
        analyzer = EDAAnalyzer(_current_df)
        report = analyzer.generate_full_report()
    
    exporter = DataExporter(_current_df, report)
    markdown_content = exporter.generate_markdown_report()
    
    from fastapi.responses import Response
    return Response(
        content=markdown_content,
        media_type="text/markdown",
        headers={"Content-Disposition": "attachment; filename=sushi_report.md"}
    )


@app.post("/clean")
async def clean_dataset(operations: dict):
    """
    Apply cleaning operations to the current dataset.

    Body example:
    {
      "drop_missing_rows": false,
      "drop_missing_cols_threshold": 0.5,
      "impute_numeric": "mean",       // "mean" | "median" | "constant" | "ffill" | null
      "impute_numeric_value": 0,      // used when impute_numeric == "constant"
      "impute_categorical": "mode",   // "mode" | "constant" | "ffill" | null
      "impute_categorical_value": "unknown",
      "remove_duplicates": true,
      "cap_outliers": false,
      "remove_outliers": false,
      "outlier_columns": [],          // empty = all numeric
      "cast_datetime": [],
      "cast_numeric": [],
      "cast_categorical": [],
      "strip_whitespace": false,
      "lowercase_strings": false,
      "drop_constant_columns": false,
      "rename_snake_case": false
    }
    """
    global _current_df
    if _current_df is None:
        raise HTTPException(status_code=400, detail="No dataset loaded. Upload a file first.")

    try:
        cleaner = DataCleaner(_current_df)

        if operations.get("drop_missing_rows"):
            cleaner.drop_missing_rows(threshold=operations.get("drop_missing_rows_threshold", 0.0))

        threshold = operations.get("drop_missing_cols_threshold")
        if threshold is not None:
            cleaner.drop_missing_columns(threshold=float(threshold))

        impute_num = operations.get("impute_numeric")
        if impute_num == "mean":
            cleaner.impute_mean(columns=operations.get("impute_numeric_columns") or None)
        elif impute_num == "median":
            cleaner.impute_median(columns=operations.get("impute_numeric_columns") or None)
        elif impute_num == "constant":
            cleaner.impute_constant(
                value=operations.get("impute_numeric_value", 0),
                columns=operations.get("impute_numeric_columns") or None
            )
        elif impute_num == "ffill":
            cleaner.impute_forward_fill(columns=operations.get("impute_numeric_columns") or None)

        impute_cat = operations.get("impute_categorical")
        if impute_cat == "mode":
            cleaner.impute_mode(columns=operations.get("impute_categorical_columns") or None)
        elif impute_cat == "constant":
            cleaner.impute_constant(
                value=operations.get("impute_categorical_value", "unknown"),
                columns=operations.get("impute_categorical_columns") or None
            )
        elif impute_cat == "ffill":
            cleaner.impute_forward_fill(columns=operations.get("impute_categorical_columns") or None)

        if operations.get("remove_duplicates"):
            cleaner.remove_duplicates(
                subset=operations.get("duplicate_subset") or None,
                keep=operations.get("duplicate_keep", "first")
            )

        outlier_cols = operations.get("outlier_columns") or None
        if operations.get("cap_outliers"):
            cleaner.cap_outliers_iqr(columns=outlier_cols)
        elif operations.get("remove_outliers"):
            cleaner.remove_outliers_iqr(columns=outlier_cols)

        if operations.get("cast_datetime"):
            cleaner.cast_to_datetime(operations["cast_datetime"])
        if operations.get("cast_numeric"):
            cleaner.cast_to_numeric(operations["cast_numeric"])
        if operations.get("cast_categorical"):
            cleaner.cast_to_categorical(operations["cast_categorical"])

        if operations.get("strip_whitespace"):
            cleaner.strip_whitespace()
        if operations.get("lowercase_strings"):
            cleaner.to_lowercase()
        if operations.get("drop_constant_columns"):
            cleaner.drop_constant_columns()
        if operations.get("rename_snake_case"):
            cleaner.rename_columns_snake_case()

        result = cleaner.result()
        # Update the in-memory dataframe with the cleaned version
        _current_df = cleaner.df
        logger.info(f"Cleaning complete: {result['rows_removed']} rows removed, {result['cols_removed']} cols removed")
        return result

    except Exception as e:
        logger.error(f"Cleaning error: {e}")
        raise HTTPException(status_code=500, detail=f"Cleaning failed: {str(e)}")


@app.post("/transform")
async def transform_dataset(operations: dict):
    """
    Apply feature engineering transformations to the current dataset.

    Body example:
    {
      "log_transform": ["price", "revenue"],
      "normalize": ["quantity"],
      "standardize": ["price"],
      "bin_equal_width": {"column": "age", "n_bins": 5},
      "bin_equal_freq": {"column": "age", "n_bins": 5},
      "one_hot_encode": ["category", "region"],
      "label_encode": ["customer_type"],
      "extract_datetime": ["order_date"]
    }
    """
    global _current_df
    if _current_df is None:
        raise HTTPException(status_code=400, detail="No dataset loaded. Upload a file first.")

    try:
        transformer = DataTransformer(_current_df)

        if operations.get("log_transform"):
            transformer.log_transform(operations["log_transform"])
        if operations.get("normalize"):
            transformer.normalize_minmax(operations["normalize"])
        if operations.get("standardize"):
            transformer.standardize_zscore(operations["standardize"])
        if operations.get("bin_equal_width"):
            cfg = operations["bin_equal_width"]
            transformer.bin_equal_width(cfg["column"], n_bins=cfg.get("n_bins", 5))
        if operations.get("bin_equal_freq"):
            cfg = operations["bin_equal_freq"]
            transformer.bin_equal_frequency(cfg["column"], n_bins=cfg.get("n_bins", 5))
        if operations.get("one_hot_encode"):
            transformer.one_hot_encode(operations["one_hot_encode"])
        if operations.get("label_encode"):
            transformer.label_encode(operations["label_encode"])
        if operations.get("extract_datetime"):
            transformer.extract_datetime_features(operations["extract_datetime"])
        if operations.get("interaction_product"):
            cfg = operations["interaction_product"]
            transformer.interaction_product(cfg["col1"], cfg["col2"])
        if operations.get("interaction_ratio"):
            cfg = operations["interaction_ratio"]
            transformer.interaction_ratio(cfg["col1"], cfg["col2"])
        if operations.get("rolling_stats"):
            cfg = operations["rolling_stats"]
            transformer.rolling_stats(cfg["column"], window=cfg.get("window", 3))
        if operations.get("lag_features"):
            cfg = operations["lag_features"]
            transformer.lag_features(cfg["column"], lags=cfg.get("lags", [1, 2, 3]))

        result = transformer.result()
        _current_df = transformer.df
        logger.info(f"Transform complete: {len(result['transform_log'])} operations applied")
        return result

    except Exception as e:
        logger.error(f"Transform error: {e}")
        raise HTTPException(status_code=500, detail=f"Transform failed: {str(e)}")


@app.get("/health")
async def health():
    """Health check endpoint for monitoring."""
    return {
        "status": "ok",
        "version": "1.0.0",
        "cache_size": cache.cache_size(),
        "redis_ok": cache.ping(),
        "current_df_loaded": _current_df is not None,
    }


# ── Async upload endpoint (Celery-backed) ─────────────────────────────────────

@app.post("/datasets/upload")
@limiter.limit("10/minute")
async def upload_dataset_async(
    request: Request,
    file: UploadFile = File(...),
    org_id: str = "default",      # Will be replaced by Clerk auth in Task 7
):
    """
    Production upload endpoint.
    Saves file to R2, enqueues a Celery analysis job, returns immediately.

    Poll GET /jobs/{dataset_id} for status, or connect to the SSE stream
    at GET /jobs/{dataset_id}/stream for real-time push.
    """
    contents = file.file.read()
    filename = file.filename or "upload"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "csv"

    # Validate size
    if len(contents) > 100 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File exceeds 100 MB limit")

    # Upload to R2
    dataset_id = str(uuid.uuid4())
    file_key = f"uploads/{org_id}/{dataset_id}/{filename}"
    try:
        storage.upload(org_id, dataset_id, filename, contents)
    except Exception as e:
        logger.error(f"R2 upload failed: {e}")
        raise HTTPException(status_code=500, detail="File storage failed")

    # Persist Dataset row to Postgres
    database_url = os.getenv("DATABASE_URL", "")
    if database_url:
        try:
            import psycopg2
            db_url = database_url.replace("postgresql+asyncpg://", "postgresql://")
            conn = psycopg2.connect(db_url)
            with conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO datasets
                          (id, org_id, created_by, name, original_filename,
                           file_key, file_size_bytes, file_format, status)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'pending')
                        """,
                        (dataset_id, org_id, org_id, filename, filename,
                         file_key, len(contents), ext),
                    )
            conn.close()
        except Exception as e:
            logger.warning(f"Dataset row insert failed (non-fatal): {e}")

    # Enqueue Celery job
    cache.set_job_status(dataset_id, "pending")
    analyze_dataset.delay(
        dataset_id=dataset_id,
        org_id=org_id,
        file_key=file_key,
        file_format=ext,
        database_url=database_url,
    )

    logger.info(f"Enqueued analysis job for dataset={dataset_id}")
    return {
        "dataset_id": dataset_id,
        "status": "pending",
        "message": "Analysis queued. Poll /jobs/{dataset_id} for progress.",
    }


@app.get("/jobs/{dataset_id}")
async def get_job_status(dataset_id: str):
    """
    Return the current status of an analysis job.

    Status values: pending | processing | done | failed
    When done, the response includes analysis_id which can be used to
    fetch the full report from GET /analyses/{analysis_id}.
    """
    status_data = cache.get_job_status(dataset_id)
    if status_data is None:
        raise HTTPException(status_code=404, detail="Job not found or expired")
    return {"dataset_id": dataset_id, **status_data}
