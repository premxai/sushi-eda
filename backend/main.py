"""
Sushi EDA API — single-process FastAPI app.

Upload lifecycle:
  POST /datasets/upload  → stores the file, inserts a Dataset row, schedules
                           analysis via BackgroundTasks (analysis_runner.py)
  GET  /jobs/{id}/stream → SSE progress until job_done / job_failed
  GET  /analyses/{id}    → the finished report (+ AI narrative)

Everything external is optional: without DATABASE_URL a SQLite fallback is
used, without R2_* files go to the local filesystem, without Supabase settings
every request acts as a shared demo user, without ANTHROPIC_API_KEY the AI
narrative/chat features are disabled.
"""

import os
import tempfile
import uuid
from typing import Optional

# Load backend/.env BEFORE any module reads os.getenv at import time
# (ai_narrative, storage, cache, db.connection all do). Real env vars win.
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

import pandas as pd
import sentry_sdk
from fastapi import (
    BackgroundTasks,
    Body,
    Depends,
    FastAPI,
    File,
    HTTPException,
    Request,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

import defaults
from analysis_runner import run_analysis, sanitize_json
from analyzer import EDAAnalyzer
from auth import get_optional_user, validate_org_access
from cache import cache
from db import get_db
from db.models import Base as _DBBase
from db.models import Dataset as _DatasetModel
from db.models import User as _UserModel
from polars_loader import parse_to_polars
from routers import jobs as jobs_router
from routers.datasets import analyses_router
from routers.datasets import router as datasets_router
from routers.shares import router as shares_router
from storage import storage

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
        ],
        send_default_pii=False,
    )
    logger.info("Sentry initialized")

# File logging — temp dir so it works on read-only filesystems (Render)
_LOG_PATH = os.path.join(tempfile.gettempdir(), "sushi", "app.log")
os.makedirs(os.path.dirname(_LOG_PATH), exist_ok=True)
logger.add(_LOG_PATH, rotation="500 MB", retention="10 days", level="INFO")

# ── App / CORS / rate limiting ─────────────────────────────────────────────────

MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Sushi EDA API", version="2.0.0")

_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
if not _ALLOWED_ORIGINS and os.getenv("ENVIRONMENT", "development") != "production":
    _ALLOWED_ORIGINS = ["*"]

# Development stays permissive; production must opt in with
# ALLOWED_ORIGINS=https://app.example.com,https://preview.example.com
app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials="*" not in _ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.include_router(jobs_router.router)
app.include_router(shares_router)
app.include_router(datasets_router)
app.include_router(analyses_router)


# ── Startup: schema + default org/system user ─────────────────────────────────


@app.on_event("startup")
async def _ensure_default_org() -> None:
    """Create tables and the 'default' org + 'system' user if missing."""
    from auth import AUTH_ENABLED
    from db.connection import AsyncSessionLocal, engine as db_engine

    if os.getenv("ENVIRONMENT", "development") == "production" and not AUTH_ENABLED:
        logger.error(
            "ENVIRONMENT=production but Supabase auth is not configured — "
            "the API is running in OPEN demo mode with no authentication."
        )

    try:
        async with db_engine.begin() as conn:
            await conn.run_sync(_DBBase.metadata.create_all)

        from sqlalchemy import select as sa_select

        from db.models import Organization
        from db.models import User as _User

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                sa_select(Organization).where(Organization.slug == "default")
            )
            org = result.scalar_one_or_none()
            if org is None:
                org = Organization(name="Default", slug="default", plan="free")
                db.add(org)
                await db.flush()
            defaults.DEFAULT_ORG_ID = str(org.id)

            result = await db.execute(sa_select(_User).where(_User.clerk_id == "system"))
            sys_user = result.scalar_one_or_none()
            if sys_user is None:
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

    try:
        await _seed_example_dataset()
    except Exception as exc:
        logger.warning(f"Could not seed example dataset: {exc}")

    import asyncio

    from retention import retention_loop

    asyncio.get_running_loop().create_task(retention_loop())


_EXAMPLE_FILENAME = "sample_sales.csv"
_EXAMPLE_SEED_PATH = os.path.join(os.path.dirname(__file__), "seed", _EXAMPLE_FILENAME)


async def _seed_example_dataset() -> None:
    """
    Ensure a pre-analyzed example dataset exists so "try an example" opens a
    finished report instantly. Analysis runs as a background task after
    startup, so health checks are not delayed.
    """
    import asyncio

    from sqlalchemy import select as sa_select

    from db.connection import AsyncSessionLocal

    if not defaults.DEFAULT_ORG_ID or not defaults.DEFAULT_USER_ID:
        return
    if not os.path.exists(_EXAMPLE_SEED_PATH):
        logger.info("No example seed file — skipping example dataset")
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            sa_select(_DatasetModel).where(
                _DatasetModel.original_filename == _EXAMPLE_FILENAME,
                _DatasetModel.created_by == uuid.UUID(defaults.DEFAULT_USER_ID),
                _DatasetModel.status == "ready",
            )
        )
        existing = result.scalars().first()
        if existing is not None:
            defaults.EXAMPLE_DATASET_ID = str(existing.id)
            logger.info(f"Example dataset ready: {defaults.EXAMPLE_DATASET_ID}")
            return

        with open(_EXAMPLE_SEED_PATH, "rb") as f:
            contents = f.read()

        dataset_id = str(uuid.uuid4())
        storage.upload(defaults.DEFAULT_ORG_ID, dataset_id, _EXAMPLE_FILENAME, contents)
        dataset_row = _DatasetModel(
            id=uuid.UUID(dataset_id),
            org_id=uuid.UUID(defaults.DEFAULT_ORG_ID),
            created_by=uuid.UUID(defaults.DEFAULT_USER_ID),
            name=_EXAMPLE_FILENAME,
            original_filename=_EXAMPLE_FILENAME,
            file_key=f"uploads/{defaults.DEFAULT_ORG_ID}/{dataset_id}/{_EXAMPLE_FILENAME}",
            file_size_bytes=len(contents),
            file_format="csv",
            status="processing",
        )
        db.add(dataset_row)
        await db.commit()

    cache.set_job_status(dataset_id, "pending", {"progress": 5, "stage": "queued"})
    defaults.EXAMPLE_DATASET_ID = dataset_id
    asyncio.get_running_loop().create_task(
        run_analysis(
            dataset_id,
            defaults.DEFAULT_ORG_ID,
            f"uploads/{defaults.DEFAULT_ORG_ID}/{dataset_id}/{_EXAMPLE_FILENAME}",
            "csv",
        )
    )
    logger.info(f"Seeding example dataset in background: {dataset_id}")


@app.get("/example")
async def get_example_dataset(db: AsyncSession = Depends(get_db)):
    """Return the pre-analyzed example dataset id, or 404 while it is still seeding."""
    if not defaults.EXAMPLE_DATASET_ID:
        # A cold deploy can receive a request before startup's background
        # seeding has populated the in-memory id. Seed lazily in that case.
        await _seed_example_dataset()
    if not defaults.EXAMPLE_DATASET_ID:
        raise HTTPException(status_code=404, detail="No example dataset available")
    result = await db.execute(
        # Only hand out the example once its analysis is finished
        _sa_select_ready_example()
    )
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Example dataset is still being prepared")
    return {"dataset_id": str(dataset.id), "filename": dataset.original_filename}


def _sa_select_ready_example():
    from sqlalchemy import select as sa_select

    return sa_select(_DatasetModel).where(
        _DatasetModel.id == uuid.UUID(defaults.EXAMPLE_DATASET_ID),
        _DatasetModel.status == "ready",
    )


# ── Health ─────────────────────────────────────────────────────────────────────


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "version": "2.0.0",
        "cache_size": cache.cache_size(),
        "redis_ok": cache.ping(),
    }


# ── Upload ─────────────────────────────────────────────────────────────────────


@app.post("/datasets/upload")
@limiter.limit("10/minute")
async def upload_dataset(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    org_id: str = "default",
    current_user: Optional[_UserModel] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a data file and schedule analysis in the background.

    Returns immediately with {dataset_id, status: "pending"}. Subscribe to
    GET /jobs/{dataset_id}/stream (SSE) or poll GET /jobs/{dataset_id}.
    """
    contents = file.file.read()
    raw_filename = file.filename or "upload"
    ext = raw_filename.rsplit(".", 1)[-1].lower() if "." in raw_filename else "csv"
    # Client-supplied filenames are untrusted and get embedded directly in the
    # storage key (uploads/{org}/{dataset_id}/{filename}) — strip any path
    # components so a crafted name like "../../../etc/x" can't be used to
    # write outside the storage root (storage.py also enforces containment
    # as a second layer, but a clean name here avoids the request failing).
    filename = os.path.basename(raw_filename.replace("\\", "/")) or "upload"
    is_production = os.getenv("ENVIRONMENT", "development") == "production"

    if is_production and current_user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    if current_user is not None and org_id != "default":
        await validate_org_access(
            org_id, current_user, db, allowed_roles=("admin", "editor")
        )

    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit. "
            "Try exporting fewer rows or columns.",
        )
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

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
    if not effective_org_id or not effective_created_by:
        raise HTTPException(status_code=500, detail="Default organization is unavailable")

    dataset_id = str(uuid.uuid4())
    file_key = f"uploads/{effective_org_id}/{dataset_id}/{filename}"
    try:
        storage.upload(effective_org_id, dataset_id, filename, contents)
    except Exception as e:
        logger.error(f"File storage failed: {e}")
        raise HTTPException(status_code=500, detail="File storage failed")

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
            status="processing",
        )
        db.add(dataset_row)
        await db.commit()
    except Exception as e:
        await db.rollback()
        logger.error(f"Dataset row insert failed: {e}")
        raise HTTPException(status_code=500, detail="Dataset persistence failed")

    cache.set_job_status(dataset_id, "pending", {"progress": 5, "stage": "queued"})
    background_tasks.add_task(
        run_analysis, dataset_id, effective_org_id, file_key, ext
    )

    logger.info(f"Scheduled analysis for dataset={dataset_id}")
    return {
        "dataset_id": dataset_id,
        "status": "pending",
        "message": "Analysis scheduled. Subscribe to /jobs/{dataset_id}/stream.",
    }


# ── Feedback ───────────────────────────────────────────────────────────────────


@app.post("/feedback")
@limiter.limit("5/minute")
async def submit_feedback(
    request: Request,
    message: str = Body(..., embed=True, min_length=3, max_length=4000),
    email: Optional[str] = Body(default=None, embed=True, max_length=320),
    page: Optional[str] = Body(default=None, embed=True, max_length=200),
    db: AsyncSession = Depends(get_db),
):
    """Store anonymous product feedback from the in-app widget."""
    from db.models import Feedback

    db.add(Feedback(message=message.strip(), email=email, page=page))
    await db.commit()
    return {"status": "ok"}


# ── Compare (stateless: parses both files in-request, no persistence) ─────────


def _read_upload_df(file: UploadFile) -> pd.DataFrame:
    contents = file.file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the 25 MB limit")
    filename = file.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    try:
        return parse_to_polars(contents, ext).to_pandas()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse file: {e}")


@app.post("/compare")
@limiter.limit("5/minute")
async def compare_datasets(
    request: Request,
    file1: UploadFile = File(...),
    file2: UploadFile = File(...),
):
    """Compare two datasets side-by-side (stateless, nothing stored)."""
    import asyncio

    df1 = _read_upload_df(file1)
    df2 = _read_upload_df(file2)

    # generate_full_report is the same CPU-heavy call analysis_runner.py
    # offloads via asyncio.to_thread for uploads; a wide (many-column) file
    # measured multiple seconds here, and this endpoint ran it synchronously
    # twice inside an async handler, freezing the whole single-process
    # server for every other request for that whole window.
    report1 = await asyncio.to_thread(lambda: EDAAnalyzer(df1).generate_full_report())
    report2 = await asyncio.to_thread(lambda: EDAAnalyzer(df2).generate_full_report())
    report1["preview"] = df1.head(50).fillna("").to_dict(orient="records")
    report2["preview"] = df2.head(50).fillna("").to_dict(orient="records")

    comparison = {
        "schema_diff": {
            "file1_only": sorted(set(df1.columns) - set(df2.columns)),
            "file2_only": sorted(set(df2.columns) - set(df1.columns)),
            "common": sorted(set(df1.columns) & set(df2.columns)),
        },
        "row_count_diff": int(df1.shape[0]) - int(df2.shape[0]),
        "column_count_diff": int(df1.shape[1]) - int(df2.shape[1]),
    }

    return sanitize_json(
        {
            "file1": {"name": file1.filename, "report": report1},
            "file2": {"name": file2.filename, "report": report2},
            "comparison": comparison,
        }
    )
