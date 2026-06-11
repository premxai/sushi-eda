import io
import json
import math
import os
import tempfile
import uuid
from typing import Any, Optional

import defaults
import pandas as pd
import sentry_sdk
from advanced_stats import AdvancedStatistics
from analyzer import EDAAnalyzer
from auth import get_optional_user, validate_org_access
from cache import cache
from cleaner import DataCleaner, DataTransformer
from db import get_db
from db.models import Analysis as _AnalysisModel
from db.models import Base as _DBBase
from db.models import Dataset as _DatasetModel
from db.models import User as _UserModel
from duckdb_query import run_query as _duckdb_run_query
from export_utils import DataExporter
from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from polars_loader import parse_to_polars
from routers import jobs as jobs_router
from routers import webhooks
from routers.admin import router as admin_router
from routers.billing import router as billing_router
from routers.comments import router as comments_router
from routers.connectors import router as connectors_router
from routers.datasets import analyses_router, credits_router
from routers.datasets import router as datasets_router
from routers.integrations import router as integrations_router
from routers.monitors import router as monitors_router
from routers.pipelines import router as pipelines_router
from routers.shares import router as shares_router
from routers.slack_bot import router as slack_router
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.redis import RedisIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession
from storage import storage
from visualizer import Visualizer
from worker import analyze_dataset

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

# Configure logging — use temp dir so it works on read-only filesystems (Render)
_LOG_PATH = os.path.join(tempfile.gettempdir(), "sushi", "app.log")
os.makedirs(os.path.dirname(_LOG_PATH), exist_ok=True)
logger.add(_LOG_PATH, rotation="500 MB", retention="10 days", level="INFO")


def _sanitize(obj: Any) -> Any:
    """Recursively replace NaN/Inf floats with None so JSON serialization never crashes."""
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize(v) for v in obj]
    return obj


def _use_inline_dataset_processing() -> bool:
    database_url = os.getenv("DATABASE_URL", "").strip()
    return not database_url or database_url.startswith("sqlite")


# Rate limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Sushi EDA API", version="1.0.0")

_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
if not _ALLOWED_ORIGINS and os.getenv("ENVIRONMENT", "development") != "production":
    _ALLOWED_ORIGINS = ["*"]

# CORS configuration. Development stays permissive; production must opt in
# with ALLOWED_ORIGINS=https://app.example.com,https://preview.example.com.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials="*" not in _ALLOWED_ORIGINS,
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
app.include_router(admin_router)
app.include_router(pipelines_router)
app.include_router(datasets_router)
app.include_router(analyses_router)
app.include_router(credits_router)
app.include_router(slack_router)

# ── Startup: ensure default org + system user exist in Postgres ───────────────


@app.on_event("startup")
async def _ensure_default_org() -> None:
    """
    Create the 'default' organisation and 'system' user in Postgres if they
    don't already exist.  Uses the app's async SQLAlchemy session so ORM-level
    column defaults (ai_credits_used, ai_credits_limit, is_starred, etc.) are
    applied automatically — raw psycopg2 would miss these and hit NOT NULL
    violations.
    """
    from db.connection import AsyncSessionLocal, engine as db_engine
    from auth import AUTH_ENABLED

    if os.getenv("ENVIRONMENT", "development") == "production" and not AUTH_ENABLED:
        logger.error(
            "ENVIRONMENT=production but CLERK_SECRET_KEY is not set — "
            "the API is running in OPEN demo mode with no authentication."
        )

    if AsyncSessionLocal is None:
        logger.info("DATABASE_URL not set — skipping default org creation")
        return
    try:
        if db_engine is not None:
            async with db_engine.begin() as conn:
                await conn.run_sync(_DBBase.metadata.create_all)

        from db.models import Organization
        from db.models import User as _User
        from sqlalchemy import select as sa_select

        async with AsyncSessionLocal() as db:
            # ── Default organisation ────────────────────────────────────────
            result = await db.execute(
                sa_select(Organization).where(Organization.slug == "default")
            )
            org = result.scalar_one_or_none()
            if org:
                defaults.DEFAULT_ORG_ID = str(org.id)
            else:
                org = Organization(name="Default", slug="default", plan="free")
                db.add(org)
                await db.flush()
                defaults.DEFAULT_ORG_ID = str(org.id)

            # ── System user ────────────────────────────────────────────────
            result = await db.execute(
                sa_select(_User).where(_User.clerk_id == "system")
            )
            sys_user = result.scalar_one_or_none()
            if sys_user:
                defaults.DEFAULT_USER_ID = str(sys_user.id)
            else:
                sys_user = _User(clerk_id="system", email="system@localhost")
                db.add(sys_user)
                await db.flush()
                defaults.DEFAULT_USER_ID = str(sys_user.id)

            await db.commit()

        logger.info(
            f"Default org={defaults.DEFAULT_ORG_ID}, "
            f"system user={defaults.DEFAULT_USER_ID}"
        )
    except Exception as exc:
        logger.warning(f"Could not ensure default org/user: {exc}")


# In-memory store for the last uploaded DataFrame (single-user dev tool)
_current_df: Optional[pd.DataFrame] = None

# Simple in-memory cache for analysis results (file hash -> report)
_MAX_CACHE_SIZE = 100
_analysis_cache: dict[str, Any] = {}

# Persistent temp file so the DataFrame survives backend restarts
# Use system temp dir so it works on read-only filesystems (e.g. Render)
_LAST_UPLOAD_DIR = os.path.join(tempfile.gettempdir(), ".sushi_upload")
_LAST_UPLOAD_DATA = os.path.join(_LAST_UPLOAD_DIR, "data")
_LAST_UPLOAD_META = os.path.join(_LAST_UPLOAD_DIR, "meta.json")


def _persist_upload(contents: bytes, filename: str) -> None:
    """Save uploaded file bytes + metadata to disk for recovery after restart."""
    try:
        os.makedirs(_LAST_UPLOAD_DIR, exist_ok=True)
        with open(_LAST_UPLOAD_DATA, "wb") as f:
            f.write(contents)
        with open(_LAST_UPLOAD_META, "w") as f:
            json.dump({"filename": filename}, f)
    except Exception as e:
        logger.warning(f"Could not persist upload to disk: {e}")


def _read_bytes_as_df(raw: bytes, filename: str) -> pd.DataFrame:
    """Parse raw bytes into a DataFrame using the filename extension."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext == "csv":
        return pd.read_csv(io.BytesIO(raw))
    elif ext == "tsv":
        return pd.read_csv(io.BytesIO(raw), sep="\t")
    elif ext in ("xls", "xlsx"):
        return pd.read_excel(io.BytesIO(raw), engine="openpyxl")
    elif ext == "parquet":
        return pd.read_parquet(io.BytesIO(raw))
    elif ext == "json":
        data = json.loads(raw.decode("utf-8"))
        if isinstance(data, list):
            df = pd.json_normalize(data, max_level=1) if data else pd.DataFrame()
        elif isinstance(data, dict):
            df = pd.json_normalize([data], max_level=1)
        else:
            return pd.DataFrame()
        for col in df.columns:
            if df[col].apply(lambda x: isinstance(x, (dict, list))).any():
                df[col] = df[col].apply(
                    lambda x: json.dumps(x) if isinstance(x, (dict, list)) else x
                )
        return df
    else:
        return pd.read_csv(io.BytesIO(raw))  # best-effort fallback


def _get_current_df() -> Optional[pd.DataFrame]:
    """Return the current DataFrame, reloading from disk if needed."""
    global _current_df
    if _current_df is not None:
        return _current_df
    # Try to recover from persistent temp file
    if os.path.exists(_LAST_UPLOAD_DATA) and os.path.exists(_LAST_UPLOAD_META):
        try:
            with open(_LAST_UPLOAD_META) as f:
                meta = json.load(f)
            with open(_LAST_UPLOAD_DATA, "rb") as f:
                raw = f.read()
            _current_df = _read_bytes_as_df(raw, meta.get("filename", "data.csv"))
            logger.info(
                f"Recovered DataFrame from disk: {meta.get('filename')}, shape: {_current_df.shape}"
            )
            return _current_df
        except Exception as e:
            logger.warning(f"Failed to recover DataFrame from disk: {e}")
    return None


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
        import sqlite3
        import tempfile

        with tempfile.NamedTemporaryFile(delete=False, suffix=".db") as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        try:
            conn = sqlite3.connect(tmp_path)
            # Get list of tables
            tables = pd.read_sql_query(
                "SELECT name FROM sqlite_master WHERE type='table'", conn
            )
            if len(tables) == 0:
                raise HTTPException(
                    status_code=400, detail="No tables found in SQLite database"
                )

            # Use the first table (or we could let user select)
            table_name = tables.iloc[0]["name"]
            safe_name = table_name.replace('"', '""')
            df = pd.read_sql_query(f'SELECT * FROM "{safe_name}"', conn)
            conn.close()

            # Clean up temp file
            import os

            os.unlink(tmp_path)

            return df
        except Exception as e:
            raise HTTPException(
                status_code=400, detail=f"Failed to read SQLite database: {str(e)}"
            )
    elif ext == "json":
        data = json.loads(contents.decode("utf-8"))
        if isinstance(data, list):
            df = pd.json_normalize(data, max_level=1) if data else pd.DataFrame()
        elif isinstance(data, dict):
            df = pd.json_normalize([data], max_level=1)
        else:
            raise HTTPException(
                status_code=400, detail="JSON must be an array or object"
            )

        # Convert any remaining dict/list columns to strings to avoid unhashable type errors
        for col in df.columns:
            if df[col].apply(lambda x: isinstance(x, (dict, list))).any():
                df[col] = df[col].apply(
                    lambda x: json.dumps(x) if isinstance(x, (dict, list)) else x
                )

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

        # Persist to disk so stats survive backend restarts
        _persist_upload(contents, file.filename or "data.csv")

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

        # Cache the result (evict oldest entry if at capacity)
        if len(_analysis_cache) >= _MAX_CACHE_SIZE:
            oldest_key = next(iter(_analysis_cache))
            del _analysis_cache[oldest_key]
        _analysis_cache[file_hash] = {"df": df, "report": report}
        logger.info(f"Cached result for {file.filename} with hash {file_hash[:8]}")

        return _sanitize(report)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing file {file.filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@app.post("/query")
async def query_local_df(request: Request):
    """
    Run a SQL SELECT against the in-memory DataFrame loaded by /upload.
    Used by the SQL editor when datasetId == 'local'.
    """
    df_pd = _get_current_df()
    if df_pd is None:
        raise HTTPException(
            status_code=400, detail="No dataset loaded. Upload a file first."
        )
    body = await request.json()
    sql: str = body.get("sql", "")
    limit: int = int(body.get("limit", 1000))
    offset: int = int(body.get("offset", 0))
    try:
        import polars as pl

        pl_df = pl.from_pandas(df_pd)
        return _duckdb_run_query(pl_df, sql, limit, offset)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))


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
    df = _get_current_df()
    if df is None:
        raise HTTPException(
            status_code=400, detail="No dataset loaded. Upload a file first."
        )

    if column_name not in df.columns:
        raise HTTPException(status_code=404, detail=f"Column '{column_name}' not found")

    viz = Visualizer(df)
    is_numeric = pd.api.types.is_numeric_dtype(df[column_name])

    if chart_type == "auto":
        chart_type = "distribution" if is_numeric else "categorical_bar"

    if chart_type == "distribution":
        return viz.create_distribution_plot(column_name)
    elif chart_type == "box_plot":
        return viz.create_box_plot(column_name)
    elif chart_type == "categorical_bar":
        return viz.create_categorical_bar(column_name)
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown chart_type '{chart_type}'. Use: distribution, box_plot, categorical_bar",
        )


@app.get("/visualize")
async def visualize_all():
    """Generate all visualizations for the currently loaded dataset."""
    df = _get_current_df()
    if df is None:
        raise HTTPException(
            status_code=400, detail="No dataset loaded. Upload a file first."
        )

    viz = Visualizer(df)
    return viz.generate_all_visualizations()


@app.post("/compare")
async def compare_datasets(
    file1: UploadFile = File(...), file2: UploadFile = File(...)
):
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
    df = _get_current_df()
    if df is None:
        raise HTTPException(
            status_code=400, detail="No dataset loaded. Upload a file first."
        )

    stats_analyzer = AdvancedStatistics(df)
    return _sanitize(stats_analyzer.generate_all_tests())


@app.post("/stats/regression")
async def perform_regression(x_col: str, y_col: str):
    """Perform linear regression between two columns."""
    df = _get_current_df()
    if df is None:
        raise HTTPException(
            status_code=400, detail="No dataset loaded. Upload a file first."
        )
    return _sanitize(AdvancedStatistics(df).linear_regression(x_col, y_col))


@app.post("/stats/ttest")
async def perform_ttest(col1: str, col2: str):
    """Perform independent t-test between two columns."""
    df = _get_current_df()
    if df is None:
        raise HTTPException(
            status_code=400, detail="No dataset loaded. Upload a file first."
        )
    return _sanitize(AdvancedStatistics(df).t_test_independent(col1, col2))


@app.post("/stats/mann_whitney")
async def perform_mann_whitney(col1: str, col2: str, alternative: str = "two-sided"):
    """Mann-Whitney U test between two numeric columns."""
    df = _get_current_df()
    if df is None:
        raise HTTPException(
            status_code=400, detail="No dataset loaded. Upload a file first."
        )
    return _sanitize(
        AdvancedStatistics(df).mann_whitney_u(col1, col2, alternative=alternative)
    )


@app.post("/stats/chi_square")
async def perform_chi_square(col1: str, col2: str):
    """Chi-square test of independence between two categorical columns."""
    df = _get_current_df()
    if df is None:
        raise HTTPException(
            status_code=400, detail="No dataset loaded. Upload a file first."
        )
    return _sanitize(AdvancedStatistics(df).chi_square_test(col1, col2))


@app.post("/stats/anova")
async def perform_anova(numeric_col: str, group_col: str):
    """One-way ANOVA: numeric_col grouped by group_col."""
    df = _get_current_df()
    if df is None:
        raise HTTPException(
            status_code=400, detail="No dataset loaded. Upload a file first."
        )
    return _sanitize(AdvancedStatistics(df).anova_one_way(numeric_col, group_col))


@app.post("/stats/correlation")
async def perform_correlation(col1: str, col2: str, method: str = "pearson"):
    """Correlation coefficient + significance between two numeric columns."""
    from scipy import stats as scipy_stats

    if method not in ("pearson", "spearman", "kendall"):
        raise HTTPException(
            status_code=400, detail="method must be pearson | spearman | kendall"
        )
    df = _get_current_df()
    if df is None:
        raise HTTPException(
            status_code=400, detail="No dataset loaded. Upload a file first."
        )
    data = df[[col1, col2]].dropna()
    if len(data) < 3:
        raise HTTPException(status_code=422, detail="Insufficient data")
    fn = {
        "pearson": scipy_stats.pearsonr,
        "spearman": scipy_stats.spearmanr,
        "kendall": scipy_stats.kendalltau,
    }[method]
    stat, p = fn(data[col1], data[col2])
    stat_f = (
        None if (math.isnan(float(stat)) or math.isinf(float(stat))) else float(stat)
    )
    p_f = None if (math.isnan(float(p)) or math.isinf(float(p))) else float(p)
    return {
        "test": f"{method.title()} correlation",
        "column1": col1,
        "column2": col2,
        "coefficient": stat_f,
        "p_value": p_f,
        "significant": bool(p_f is not None and p_f < 0.05),
        "n": int(len(data)),
    }


@app.post("/stats/regression/logistic")
async def perform_logistic_regression(
    x_col: str, y_col: str, positive_class: str | None = None
):
    """Logistic regression for a binary target column."""
    df = _get_current_df()
    if df is None:
        raise HTTPException(
            status_code=400, detail="No dataset loaded. Upload a file first."
        )
    return _sanitize(
        AdvancedStatistics(df).logistic_regression(
            x_col, y_col, positive_class=positive_class
        )
    )


@app.post("/stats/regression/polynomial")
async def perform_polynomial_regression(x_col: str, y_col: str, degree: int = 2):
    """Polynomial regression for numeric predictor/target pairs."""
    df = _get_current_df()
    if df is None:
        raise HTTPException(
            status_code=400, detail="No dataset loaded. Upload a file first."
        )
    return _sanitize(
        AdvancedStatistics(df).polynomial_regression(x_col, y_col, degree=degree)
    )


@app.post("/stats/time_series/decompose")
async def perform_ts_decomposition(
    date_col: str, value_col: str, period: int | None = None, model: str = "additive"
):
    """Time-series decomposition into trend/seasonality/residual."""
    df = _get_current_df()
    if df is None:
        raise HTTPException(
            status_code=400, detail="No dataset loaded. Upload a file first."
        )
    return _sanitize(
        AdvancedStatistics(df).time_series_decomposition(
            date_col=date_col,
            value_col=value_col,
            period=period,
            model=model,
        )
    )


@app.post("/stats/time_series/arima")
async def perform_arima_forecast(
    date_col: str,
    value_col: str,
    periods: int = 12,
    p: int = 1,
    d: int = 1,
    q: int = 1,
    alpha: float = 0.05,
):
    """ARIMA forecast endpoint for a date/value series."""
    df = _get_current_df()
    if df is None:
        raise HTTPException(
            status_code=400, detail="No dataset loaded. Upload a file first."
        )
    return AdvancedStatistics(df).arima_forecast(
        date_col=date_col,
        value_col=value_col,
        periods=periods,
        p=p,
        d=d,
        q=q,
        alpha=alpha,
    )


@app.post("/stats/cohort")
async def perform_cohort_analysis(entity_col: str, date_col: str, freq: str = "M"):
    """Cohort retention analysis by entity and activity date."""
    df = _get_current_df()
    if df is None:
        raise HTTPException(
            status_code=400, detail="No dataset loaded. Upload a file first."
        )
    return AdvancedStatistics(df).cohort_analysis(
        entity_col=entity_col, date_col=date_col, freq=freq
    )


@app.post("/stats/ab_test")
async def perform_ab_test(
    control_conversions: int,
    control_total: int,
    variant_conversions: int,
    variant_total: int,
    alpha: float = 0.05,
):
    """A/B test significance calculator using two-proportion z-test."""
    return AdvancedStatistics(pd.DataFrame()).ab_test_significance(
        control_conversions=control_conversions,
        control_total=control_total,
        variant_conversions=variant_conversions,
        variant_total=variant_total,
        alpha=alpha,
    )


@app.get("/export/excel")
async def export_to_excel():
    """Export current dataset and analysis to Excel."""
    df = _get_current_df()
    if df is None:
        raise HTTPException(
            status_code=400, detail="No dataset loaded. Upload a file first."
        )

    # Get the cached report
    file_hash = None
    report = None
    for hash_key, cache_data in _analysis_cache.items():
        if cache_data["df"].equals(df):
            file_hash = hash_key
            report = cache_data["report"]
            break

    if report is None:
        # Generate report if not cached
        analyzer = EDAAnalyzer(df)
        report = analyzer.generate_full_report()

    exporter = DataExporter(df, report)
    excel_data = exporter.to_excel()

    from fastapi.responses import Response

    return Response(
        content=excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=sushi_analysis.xlsx"},
    )


@app.get("/export/markdown")
async def export_to_markdown():
    """Export analysis report as markdown."""
    df = _get_current_df()
    if df is None:
        raise HTTPException(
            status_code=400, detail="No dataset loaded. Upload a file first."
        )

    # Get the cached report
    report = None
    for cache_data in _analysis_cache.values():
        if cache_data["df"].equals(df):
            report = cache_data["report"]
            break

    if report is None:
        analyzer = EDAAnalyzer(df)
        report = analyzer.generate_full_report()

    exporter = DataExporter(df, report)
    markdown_content = exporter.generate_markdown_report()

    from fastapi.responses import Response

    return Response(
        content=markdown_content,
        media_type="text/markdown",
        headers={"Content-Disposition": "attachment; filename=sushi_report.md"},
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
    df = _get_current_df()
    if df is None:
        raise HTTPException(
            status_code=400, detail="No dataset loaded. Upload a file first."
        )

    try:
        cleaner = DataCleaner(df)

        if operations.get("drop_missing_rows"):
            cleaner.drop_missing_rows(
                threshold=operations.get("drop_missing_rows_threshold", 0.0)
            )

        threshold = operations.get("drop_missing_cols_threshold")
        if threshold is not None:
            cleaner.drop_missing_columns(threshold=float(threshold))

        impute_num = operations.get("impute_numeric")
        if impute_num == "mean":
            cleaner.impute_mean(
                columns=operations.get("impute_numeric_columns") or None
            )
        elif impute_num == "median":
            cleaner.impute_median(
                columns=operations.get("impute_numeric_columns") or None
            )
        elif impute_num == "constant":
            cleaner.impute_constant(
                value=operations.get("impute_numeric_value", 0),
                columns=operations.get("impute_numeric_columns") or None,
            )
        elif impute_num == "ffill":
            cleaner.impute_forward_fill(
                columns=operations.get("impute_numeric_columns") or None
            )

        impute_cat = operations.get("impute_categorical")
        if impute_cat == "mode":
            cleaner.impute_mode(
                columns=operations.get("impute_categorical_columns") or None
            )
        elif impute_cat == "constant":
            cleaner.impute_constant(
                value=operations.get("impute_categorical_value", "unknown"),
                columns=operations.get("impute_categorical_columns") or None,
            )
        elif impute_cat == "ffill":
            cleaner.impute_forward_fill(
                columns=operations.get("impute_categorical_columns") or None
            )

        if operations.get("remove_duplicates"):
            cleaner.remove_duplicates(
                subset=operations.get("duplicate_subset") or None,
                keep=operations.get("duplicate_keep", "first"),
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
        logger.info(
            f"Cleaning complete: {result['rows_removed']} rows removed, {result['cols_removed']} cols removed"
        )
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
    df = _get_current_df()
    if df is None:
        raise HTTPException(
            status_code=400, detail="No dataset loaded. Upload a file first."
        )

    try:
        transformer = DataTransformer(df)

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
        logger.info(
            f"Transform complete: {len(result['transform_log'])} operations applied"
        )
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
    org_id: str = "default",
    current_user: Optional[_UserModel] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
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
    is_production = os.getenv("ENVIRONMENT", "development") == "production"

    if is_production and current_user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    if current_user is not None and org_id != "default":
        await validate_org_access(
            org_id,
            current_user,
            db,
            allowed_roles=("admin", "editor"),
        )

    # Validate size
    if len(contents) > 100 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File exceeds 100 MB limit")

    # Resolve "default" org_id to real UUID
    effective_org_id = (
        defaults.DEFAULT_ORG_ID
        if (org_id == "default" and defaults.DEFAULT_ORG_ID)
        else org_id
    )
    effective_created_by = (
        str(current_user.id)
        if current_user
        else (defaults.DEFAULT_USER_ID or effective_org_id)
    )

    # Upload to R2
    dataset_id = str(uuid.uuid4())
    file_key = f"uploads/{effective_org_id}/{dataset_id}/{filename}"
    try:
        storage.upload(effective_org_id, dataset_id, filename, contents)
    except Exception as e:
        logger.error(f"R2 upload failed: {e}")
        raise HTTPException(status_code=500, detail="File storage failed")

    # Persist Dataset row using the configured DB backend.
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not effective_org_id or not effective_created_by:
        raise HTTPException(status_code=500, detail="Default organization is unavailable")

    try:
        dataset_row = _DatasetModel(
            id=uuid.UUID(dataset_id),
            org_id=uuid.UUID(effective_org_id),
            created_by=uuid.UUID(effective_created_by),
            name=filename,
            original_filename=filename,
            file_key=file_key,
            file_size_bytes=len(contents),
            file_format=ext,
            status="processing" if _use_inline_dataset_processing() else "pending",
        )
        db.add(dataset_row)
        await db.flush()
    except Exception as e:
        await db.rollback()
        logger.error(f"Dataset row insert failed: {e}")
        raise HTTPException(status_code=500, detail="Dataset persistence failed")

    if _use_inline_dataset_processing():
        cache.set_job_status(dataset_id, "processing", {"progress": 35, "stage": "Analyzing dataset"})
        try:
            pl_df = parse_to_polars(contents, ext)
            df = pl_df.to_pandas()
            analyzer = EDAAnalyzer(df)
            report = analyzer.generate_full_report()
            report["preview"] = df.head(50).fillna("").to_dict(orient="records")  # type: ignore[attr-defined]
            analysis_row = _AnalysisModel(
                dataset_id=dataset_row.id,
                org_id=dataset_row.org_id,
                version=1,
                report=_sanitize(report),
                duration_seconds=0.0,
            )
            db.add(analysis_row)
            await db.flush()

            dataset_row.status = "ready"
            dataset_row.row_count = int(df.shape[0])
            dataset_row.column_count = int(df.shape[1])
            dataset_row.error_message = None

            await db.commit()
            cache.set_job_status(
                dataset_id,
                "done",
                {
                    "analysis_id": str(analysis_row.id),
                    "duration_seconds": 0.0,
                    "progress": 100,
                    "stage": "complete",
                },
            )
            logger.info(f"Completed inline analysis for dataset={dataset_id}")
            return {
                "dataset_id": dataset_id,
                "status": "done",
                "message": "Analysis complete.",
            }
        except Exception as e:
            await db.rollback()
            logger.exception(f"Inline dataset analysis failed for {dataset_id}: {e}")
            cache.set_job_status(dataset_id, "failed", {"error": str(e)})
            raise HTTPException(status_code=500, detail="Dataset analysis failed")

    await db.commit()

    # Enqueue Celery job for non-local environments. If Redis/Celery is down,
    # leave the persisted dataset in a failed state instead of pending forever.
    try:
        cache.set_job_status(dataset_id, "pending")
        analyze_dataset.delay(
            dataset_id=dataset_id,
            org_id=effective_org_id,
            file_key=file_key,
            file_format=ext,
            database_url=database_url,
        )
    except Exception as e:
        logger.error(f"Failed to enqueue analysis job for dataset={dataset_id}: {e}")
        dataset_row.status = "failed"
        dataset_row.error_message = "Analysis queue unavailable"
        await db.commit()
        cache.set_job_status(dataset_id, "failed", {"error": dataset_row.error_message})
        raise HTTPException(
            status_code=503,
            detail="Analysis queue unavailable. Please try again shortly.",
        )

    logger.info(f"Enqueued analysis job for dataset={dataset_id}")
    return {
        "dataset_id": dataset_id,
        "status": "pending",
        "message": "Analysis queued. Poll /jobs/{dataset_id} for progress.",
    }
