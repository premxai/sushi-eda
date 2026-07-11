"""
Dataset & Analysis router — org-scoped, Clerk-authenticated.

All endpoints require a valid Clerk JWT (via Authorization: Bearer <token>).
org_id is a query param set by the frontend from Clerk's active organisation.
Membership and RBAC are enforced per-endpoint:
  - Viewers  : all GET / read-only POST endpoints
  - Editors  : + mutating POST endpoints
  - Admins   : + DELETE

Routes:
  GET  /datasets                             — list org datasets
  GET  /datasets/{dataset_id}               — dataset metadata
  DELETE /datasets/{dataset_id}             — delete (admin|editor)
  GET  /datasets/{dataset_id}/analysis      — latest analysis report
  GET  /datasets/{dataset_id}/analyses      — version history
  GET  /analyses/{analysis_id}              — analysis by UUID
  GET  /datasets/{dataset_id}/visualize/{col}
  GET  /datasets/{dataset_id}/visualize
  GET  /datasets/{dataset_id}/stats/advanced
  POST /datasets/{dataset_id}/stats/regression
  POST /datasets/{dataset_id}/stats/ttest
  GET  /datasets/{dataset_id}/query/schema
  POST /datasets/{dataset_id}/query
  POST /datasets/{dataset_id}/query/explain
  GET  /datasets/{dataset_id}/export/excel
  GET  /datasets/{dataset_id}/export/markdown
"""

import asyncio
import re
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any, Optional

import pandas as pd
from advanced_stats import AdvancedStatistics
from analysis_runner import sanitize_json
from ai_limits import enforce_ai_limit
from auth import get_current_user, get_optional_user, validate_org_access
from db import get_db
from db.models import Analysis, Dataset, User
import defaults
from defaults import resolve_org_id
from duckdb_query import explain_query, get_schema, run_query
from export_utils import DataExporter
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import Response
from loguru import logger
from polars_loader import parse_to_polars
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from storage import storage
from visualizer import Visualizer

router = APIRouter(prefix="/datasets", tags=["datasets"])


class RenameDatasetBody(BaseModel):
    name: str = Field(min_length=1, max_length=255)


# ── Helpers ────────────────────────────────────────────────────────────────────

_UNSAFE_FILENAME_CHARS = re.compile(r'[^A-Za-z0-9._ -]')


def _safe_export_filename(name: str, suffix: str) -> str:
    """Sanitize a user-controlled dataset name for use in a
    Content-Disposition header.

    dataset.name is renamed via a free-text field with no character
    restrictions and was previously interpolated into the header raw: a
    name containing a quote let an attacker inject a second filename=
    parameter (spoofing the downloaded file's apparent name/extension —
    e.g. renaming to 'evil"; filename=hacked.exe' produced a header with
    both), and a name containing a literal CR/LF crashed the connection
    outright, since the ASGI server correctly refuses to write control
    characters into a response header. Stripping to a conservative
    allowlist and quoting the result (now safe since quotes can't survive
    the allowlist) closes both.
    """
    cleaned = _UNSAFE_FILENAME_CHARS.sub("_", name).strip() or "export"
    return f"{cleaned[:100]}{suffix}"


def _dataset_dict(d: "Dataset") -> dict:  # type: ignore[name-defined]
    return {
        "id": str(d.id),
        "name": d.name,
        "original_filename": d.original_filename,
        "file_format": d.file_format,
        "file_size_bytes": d.file_size_bytes,
        "row_count": d.row_count,
        "column_count": d.column_count,
        "status": d.status,
        "is_starred": d.is_starred,
        "archived_at": d.archived_at.isoformat() if d.archived_at else None,
        "created_at": d.created_at.isoformat(),
    }


def _ensure_dataset_visible(dataset: "Dataset", current_user: User) -> None:
    """In the shared default org, datasets are private to their creator.

    Real (non-default) orgs share datasets among members via OrgMember
    checks. Raises 404 rather than 403 so dataset ids are not confirmed
    to non-owners.
    """
    if (
        defaults.DEFAULT_ORG_ID
        and str(dataset.org_id) == defaults.DEFAULT_ORG_ID
        and dataset.created_by != current_user.id
    ):
        raise HTTPException(status_code=404, detail="Dataset not found")


def _is_public_example(dataset_id: str) -> bool:
    return bool(defaults.EXAMPLE_DATASET_ID and dataset_id == defaults.EXAMPLE_DATASET_ID)


async def _get_dataset_or_404(
    dataset_id: str, org_id: str, db: AsyncSession, current_user: User
) -> Dataset:
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id, Dataset.org_id == resolve_org_id(org_id)
        )
    )
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    _ensure_dataset_visible(dataset, current_user)
    if dataset.status != "ready":
        raise HTTPException(
            status_code=409,
            detail=f"Dataset not ready (status={dataset.status}). Wait for analysis to complete.",
        )
    return dataset


async def _get_latest_analysis(dataset_id: str, db: AsyncSession) -> Analysis:
    result = await db.execute(
        select(Analysis)
        .where(Analysis.dataset_id == dataset_id)
        .order_by(Analysis.version.desc())
        .limit(1)
    )
    analysis = result.scalar_one_or_none()
    if analysis is None:
        raise HTTPException(
            status_code=404, detail="No analysis found for this dataset"
        )
    return analysis


@lru_cache(maxsize=32)
def _cached_download(file_key: str) -> bytes:
    """Download from R2 with in-process LRU cache."""
    return storage.download(file_key)


def _load_polars_from_r2(file_key: str, file_format: str):
    """Download from R2 and return a Polars DataFrame."""
    data = _cached_download(file_key)
    try:
        return parse_to_polars(data, file_format)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


def _load_df_from_r2(file_key: str, file_format: str) -> pd.DataFrame:
    """Download from R2 and return a pandas DataFrame (for scipy/plotly)."""
    return _load_polars_from_r2(file_key, file_format).to_pandas()


# ── Dataset CRUD ───────────────────────────────────────────────────────────────


@router.get("")
async def list_datasets(
    org_id: str = Query(default="default"),
    archived: bool = Query(default=False),
    starred: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List datasets for an org. Excludes archived by default. Use ?archived=true for trash."""
    await validate_org_access(org_id, current_user, db)
    effective_org = resolve_org_id(org_id)
    query = select(Dataset).where(Dataset.org_id == effective_org)
    if defaults.DEFAULT_ORG_ID and effective_org == defaults.DEFAULT_ORG_ID:
        # Shared default org: each user only sees their own datasets.
        query = query.where(Dataset.created_by == current_user.id)
    if archived:
        query = query.where(Dataset.archived_at.isnot(None))
    else:
        query = query.where(Dataset.archived_at.is_(None))
    if starred:
        query = query.where(Dataset.is_starred.is_(True))
    query = query.order_by(Dataset.is_starred.desc(), Dataset.created_at.desc())
    result = await db.execute(query)
    return [_dataset_dict(d) for d in result.scalars().all()]


@router.patch("/{dataset_id}/star")
async def toggle_star(
    dataset_id: str,
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle starred status on a dataset (editor+)."""
    await validate_org_access(
        org_id, current_user, db, allowed_roles=("admin", "editor")
    )
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id, Dataset.org_id == resolve_org_id(org_id)
        )
    )
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    _ensure_dataset_visible(dataset, current_user)
    dataset.is_starred = not dataset.is_starred
    await db.commit()
    return {"id": dataset_id, "is_starred": dataset.is_starred}


@router.patch("/{dataset_id}/archive")
async def archive_dataset(
    dataset_id: str,
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft-archive a dataset (moves to trash, editor+)."""
    await validate_org_access(
        org_id, current_user, db, allowed_roles=("admin", "editor")
    )
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id, Dataset.org_id == resolve_org_id(org_id)
        )
    )
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    _ensure_dataset_visible(dataset, current_user)
    dataset.archived_at = datetime.now(timezone.utc)
    await db.commit()
    return {"id": dataset_id, "archived_at": dataset.archived_at.isoformat()}


@router.patch("/{dataset_id}/restore")
async def restore_dataset(
    dataset_id: str,
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Restore a dataset from the archive (editor+)."""
    await validate_org_access(
        org_id, current_user, db, allowed_roles=("admin", "editor")
    )
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id, Dataset.org_id == resolve_org_id(org_id)
        )
    )
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    _ensure_dataset_visible(dataset, current_user)
    dataset.archived_at = None
    await db.commit()
    return {"id": dataset_id, "archived_at": None}


@router.patch("/{dataset_id}/rename")
async def rename_dataset(
    dataset_id: str,
    payload: RenameDatasetBody,
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rename a saved dataset (editor+)."""
    await validate_org_access(
        org_id, current_user, db, allowed_roles=("admin", "editor")
    )
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id, Dataset.org_id == resolve_org_id(org_id)
        )
    )
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    _ensure_dataset_visible(dataset, current_user)

    cleaned_name = payload.name.strip()
    if not cleaned_name:
        raise HTTPException(status_code=422, detail="Dataset name cannot be empty")

    dataset.name = cleaned_name
    await db.commit()
    await db.refresh(dataset)
    return _dataset_dict(dataset)


@router.get("/{dataset_id}")
async def get_dataset(
    dataset_id: str,
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get dataset metadata (viewer+)."""
    await validate_org_access(org_id, current_user, db)
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id, Dataset.org_id == resolve_org_id(org_id)
        )
    )
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    _ensure_dataset_visible(dataset, current_user)
    return {
        **_dataset_dict(dataset),
        "error_message": dataset.error_message,
        "updated_at": dataset.updated_at.isoformat(),
    }


@router.delete("/{dataset_id}", status_code=204, response_model=None)
async def delete_dataset(
    dataset_id: str,
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a dataset, its analyses, and R2 files (admin|editor)."""
    effective_org = resolve_org_id(org_id)
    await validate_org_access(
        org_id, current_user, db, allowed_roles=("admin", "editor")
    )
    result = await db.execute(
        select(Dataset).where(Dataset.id == dataset_id, Dataset.org_id == effective_org)
    )
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    _ensure_dataset_visible(dataset, current_user)

    try:
        storage.delete_prefix(f"uploads/{effective_org}/{dataset_id}/")
    except Exception as e:
        logger.warning(f"R2 delete failed for {dataset_id}: {e}")

    await db.delete(dataset)
    await db.commit()
    logger.info(f"Deleted dataset {dataset_id} by user {current_user.id}")


# ── Analysis retrieval ─────────────────────────────────────────────────────────


@router.get("/{dataset_id}/analysis")
async def get_dataset_analysis(
    dataset_id: str,
    org_id: str = Query(default="default"),
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the latest analysis report, including the public sample report."""
    if _is_public_example(dataset_id):
        result = await db.execute(
            select(Dataset).where(
                Dataset.id == dataset_id,
                Dataset.org_id == resolve_org_id(org_id),
                Dataset.status == "ready",
            )
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Sample dataset not found")
    else:
        if current_user is None:
            raise HTTPException(status_code=401, detail="Authentication required")
        await validate_org_access(org_id, current_user, db)
        await _get_dataset_or_404(dataset_id, org_id, db, current_user)
    analysis = await _get_latest_analysis(dataset_id, db)
    return {
        "analysis_id": str(analysis.id),
        "version": analysis.version,
        "ai_narrative": analysis.ai_narrative,
        "duration_seconds": analysis.duration_seconds,
        "created_at": analysis.created_at.isoformat(),
        "report": analysis.report,
    }


@router.post("/{dataset_id}/analysis/narrative")
async def regenerate_narrative(
    dataset_id: str,
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _ai_limit: None = Depends(enforce_ai_limit),
):
    """
    Re-generate the AI narrative for the latest analysis (editor+).
    Useful after the initial job ran without ANTHROPIC_API_KEY set.
    Returns the new narrative and updates Analysis.ai_narrative in DB.
    """
    await validate_org_access(
        org_id, current_user, db, allowed_roles=("admin", "editor")
    )
    dataset = await _get_dataset_or_404(dataset_id, org_id, db, current_user)
    analysis = await _get_latest_analysis(dataset_id, db)

    import asyncio

    from ai_narrative import generate_narrative
    from sqlalchemy import update as sa_update

    narrative = await asyncio.to_thread(
        generate_narrative, analysis.report, dataset.name or str(dataset_id)
    )
    if narrative is None:
        raise HTTPException(
            status_code=503,
            detail="AI narrative generation unavailable — check ANTHROPIC_API_KEY",
        )

    await db.execute(
        sa_update(Analysis)
        .where(Analysis.id == analysis.id)
        .values(ai_narrative=narrative)
    )
    await db.commit()
    return {"analysis_id": str(analysis.id), "ai_narrative": narrative}


@router.get("/{dataset_id}/analyses")
async def list_dataset_analyses(
    dataset_id: str,
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all analysis versions for a dataset (viewer+)."""
    await validate_org_access(org_id, current_user, db)
    await _get_dataset_or_404(dataset_id, org_id, db, current_user)
    result = await db.execute(
        select(Analysis)
        .where(Analysis.dataset_id == dataset_id)
        .order_by(Analysis.version.desc())
    )
    analyses = result.scalars().all()
    return [
        {
            "analysis_id": str(a.id),
            "version": a.version,
            "duration_seconds": a.duration_seconds,
            "created_at": a.created_at.isoformat(),
        }
        for a in analyses
    ]


# ── Analysis by ID (used by SSE job_done handler) ─────────────────────────────

analyses_router = APIRouter(prefix="/analyses", tags=["analyses"])


@analyses_router.get("/{analysis_id}")
async def get_analysis(
    analysis_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch a specific analysis by UUID (used after SSE job_done — auth required)."""
    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if analysis is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    # Org membership check: the analysis's org_id must be accessible by current_user
    await validate_org_access(str(analysis.org_id), current_user, db)
    ds_result = await db.execute(
        select(Dataset).where(Dataset.id == analysis.dataset_id)
    )
    dataset = ds_result.scalar_one_or_none()
    if dataset is not None:
        _ensure_dataset_visible(dataset, current_user)
    return {
        "analysis_id": str(analysis.id),
        "dataset_id": str(analysis.dataset_id),
        "version": analysis.version,
        "ai_narrative": analysis.ai_narrative,
        "duration_seconds": analysis.duration_seconds,
        "created_at": analysis.created_at.isoformat(),
        "report": analysis.report,
    }


# ── AI Endpoints ──────────────────────────────────────────────────────────────


@router.post("/{dataset_id}/ai/chat")
async def ai_chat(
    dataset_id: str,
    org_id: str = Query(default="default"),
    question: str = Body(..., embed=True),
    chat_history: list = Body(default=[], embed=True),
    limit: int = Body(default=500, ge=1, le=5000, embed=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _ai_limit: None = Depends(enforce_ai_limit),
):
    """
    Ask a natural-language question about the dataset (viewer+).

    Claude translates the question to DuckDB SQL, executes it, and returns
    a plain-English answer with the SQL and raw results.

    Body:
    {
      "question": "Which region has the highest average sales?",
      "chat_history": [{"role": "user", "content": "..."}, ...],  // optional
      "limit": 500
    }
    """
    await validate_org_access(org_id, current_user, db)
    dataset = await _get_dataset_or_404(dataset_id, org_id, db, current_user)

    import asyncio

    pl_df = await asyncio.to_thread(
        _load_polars_from_r2, dataset.file_key, dataset.file_format
    )

    from ai_chat import ask_dataset

    # Claude call + DuckDB execution are blocking — keep them off the event loop
    return await asyncio.to_thread(
        ask_dataset, pl_df, question, chat_history=chat_history, limit=limit
    )


@router.post("/{dataset_id}/ai/chat/stream")
async def ai_chat_stream(
    dataset_id: str,
    org_id: str = Query(default="default"),
    question: str = Body(..., embed=True),
    chat_history: list = Body(default=[], embed=True),
    limit: int = Body(default=500, ge=1, le=5000, embed=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _ai_limit: None = Depends(enforce_ai_limit),
):
    """
    Streaming SSE version of AI chat (viewer+).

    Yields events: sql | results | token | done | error
    Content-Type: text/event-stream
    """
    from fastapi.responses import StreamingResponse

    await validate_org_access(org_id, current_user, db)
    dataset = await _get_dataset_or_404(dataset_id, org_id, db, current_user)
    pl_df = _load_polars_from_r2(dataset.file_key, dataset.file_format)

    from ai_chat import ask_dataset_stream

    return StreamingResponse(
        ask_dataset_stream(pl_df, question, chat_history=chat_history, limit=limit),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{dataset_id}/ai/cleaning-suggestions")
async def ai_cleaning_suggestions(
    dataset_id: str,
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _ai_limit: None = Depends(enforce_ai_limit),
):
    """
    AI-powered data cleaning suggestions (viewer+).

    Uses the latest analysis report to generate actionable cleaning steps
    with priority ranking, impact estimates, and ready-to-apply operation specs.
    Falls back to rule-based suggestions if ANTHROPIC_API_KEY is not set.
    """
    await validate_org_access(org_id, current_user, db)
    await _get_dataset_or_404(dataset_id, org_id, db, current_user)
    analysis = await _get_latest_analysis(dataset_id, db)

    from ai_cleaning import generate_cleaning_suggestions

    suggestions = generate_cleaning_suggestions(analysis.report)
    return {"dataset_id": dataset_id, "suggestions": suggestions}


# ── Visualizations ─────────────────────────────────────────────────────────────
#
# Route ORDER matters here: FastAPI/Starlette matches path operations in
# registration order, and "/{dataset_id}/visualize/{column_name}" below is a
# single-segment wildcard that would otherwise swallow literal single-segment
# paths like "/visualize/trend" (column_name="trend") before they ever reach
# their real handler. Every visualize/<literal-segment> route must therefore
# be declared ABOVE the generic per-column route.


@router.get("/{dataset_id}/visualize/business/{chart_type}")
async def visualize_business_chart(
    dataset_id: str,
    chart_type: str,
    category: str = Query(..., description="Categorical column to group by"),
    value: Optional[str] = Query(default=None, description="Numeric column to aggregate"),
    agg: str = Query(default="sum", description="sum | mean | count | max | min | median"),
    top_n: int = Query(default=10, ge=1, le=50),
    ascending: bool = Query(default=False),
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Pareto / top-n / waterfall — the category+value business charts
    (viewer+). These need two user-chosen columns, unlike the single-column
    charts above, so they get their own parameterised endpoint.
    """
    await validate_org_access(org_id, current_user, db)
    dataset = await _get_dataset_or_404(dataset_id, org_id, db, current_user)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    viz = Visualizer(df)

    if chart_type == "pareto":
        return viz.create_pareto_chart(category, value, top_n=top_n)
    elif chart_type == "top_n":
        return viz.create_top_n_chart(category, value, agg=agg, top_n=top_n, ascending=ascending)
    elif chart_type == "waterfall":
        if not value:
            raise HTTPException(status_code=400, detail="waterfall requires a 'value' column")
        return viz.create_waterfall_chart(category, value, top_n=top_n)
    raise HTTPException(
        status_code=400, detail="chart_type must be one of: pareto, top_n, waterfall"
    )


@router.get("/{dataset_id}/visualize/trend")
async def visualize_trend_chart(
    dataset_id: str,
    date_column: str = Query(..., description="Date/datetime-like column"),
    value_column: Optional[str] = Query(default=None, description="Numeric column to aggregate"),
    agg: str = Query(default="sum", description="sum | mean | count | max | min | median"),
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Time-series trend with auto granularity + rolling average (viewer+)."""
    await validate_org_access(org_id, current_user, db)
    dataset = await _get_dataset_or_404(dataset_id, org_id, db, current_user)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    return Visualizer(df).create_trend_chart(date_column, value_column, agg=agg)


@router.get("/{dataset_id}/visualize/scatter-matrix")
async def visualize_scatter_matrix(
    dataset_id: str,
    columns: Optional[str] = Query(default=None, description="Comma-separated numeric column names"),
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Pairwise numeric scatter grid (viewer+)."""
    await validate_org_access(org_id, current_user, db)
    dataset = await _get_dataset_or_404(dataset_id, org_id, db, current_user)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    col_list = [c.strip() for c in columns.split(",") if c.strip()] if columns else None
    return Visualizer(df).create_scatter_matrix(col_list)


@router.get("/{dataset_id}/visualize/quality-radar")
async def visualize_quality_radar(
    dataset_id: str,
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Radar chart of the 5 quality-score dimensions (viewer+)."""
    await validate_org_access(org_id, current_user, db)
    dataset = await _get_dataset_or_404(dataset_id, org_id, db, current_user)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    return Visualizer(df).create_quality_radar()


@router.get("/{dataset_id}/visualize/{column_name}")
async def visualize_column(
    dataset_id: str,
    column_name: str,
    org_id: str = Query(default="default"),
    chart_type: str = "auto",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """On-demand chart for a single column (viewer+)."""
    await validate_org_access(org_id, current_user, db)
    dataset = await _get_dataset_or_404(dataset_id, org_id, db, current_user)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)

    if column_name not in df.columns:
        raise HTTPException(status_code=404, detail=f"Column '{column_name}' not found")

    viz = Visualizer(df)
    is_numeric = pd.api.types.is_numeric_dtype(df[column_name])
    resolved = (
        chart_type
        if chart_type != "auto"
        else ("distribution" if is_numeric else "categorical_bar")
    )

    if resolved == "distribution":
        return viz.create_distribution_plot(column_name)
    elif resolved == "box_plot":
        return viz.create_box_plot(column_name)
    elif resolved == "violin":
        return viz.create_violin_plot(column_name)
    elif resolved == "categorical_bar":
        return viz.create_categorical_bar(column_name)
    raise HTTPException(status_code=400, detail=f"Unknown chart_type: {resolved}")


@router.get("/{dataset_id}/visualize")
async def visualize_all(
    dataset_id: str,
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """All charts for a dataset (viewer+)."""
    await validate_org_access(org_id, current_user, db)
    dataset = await _get_dataset_or_404(dataset_id, org_id, db, current_user)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    return Visualizer(df).generate_all_visualizations()


# Hard ceiling on rows returned by /data regardless of what the caller asks
# for — this endpoint exists so the frontend Custom Chart Builder can
# aggregate over real data instead of the 50-row report preview, not so it
# can page through an entire multi-million-row dataset as JSON.
_MAX_DATA_ROWS = 20_000


@router.get("/{dataset_id}/data")
async def get_dataset_rows(
    dataset_id: str,
    columns: Optional[str] = Query(default=None, description="Comma-separated column names to include"),
    limit: int = Query(default=5000, ge=1, le=_MAX_DATA_ROWS),
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Full-dataset rows (capped) for client-side chart building (viewer+).

    The stored Analysis.report only ever carries a 50-row preview; the
    Custom Chart Builder needs real aggregates (sums, group counts) across
    the actual dataset, so it calls this instead of reading report.preview.
    """
    await validate_org_access(org_id, current_user, db)
    dataset = await _get_dataset_or_404(dataset_id, org_id, db, current_user)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)

    if columns:
        requested = [c.strip() for c in columns.split(",") if c.strip()]
        missing = [c for c in requested if c not in df.columns]
        if missing:
            raise HTTPException(status_code=400, detail=f"Columns not found: {missing}")
        df = df[requested]

    total_rows = len(df)
    truncated = total_rows > limit
    rows = df.head(limit).fillna("").to_dict(orient="records")
    return {
        "rows": rows,
        "row_count": len(rows),
        "total_rows": total_rows,
        "truncated": truncated,
    }


# ── Advanced Stats ─────────────────────────────────────────────────────────────


@router.get("/{dataset_id}/stats/advanced")
async def advanced_stats(
    dataset_id: str,
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Advanced statistical tests (viewer+)."""
    await validate_org_access(org_id, current_user, db)
    dataset = await _get_dataset_or_404(dataset_id, org_id, db, current_user)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    return sanitize_json(AdvancedStatistics(df).generate_all_tests())


@router.post("/{dataset_id}/stats/regression")
async def regression(
    dataset_id: str,
    x_col: str,
    y_col: str,
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Linear regression between two columns (viewer+)."""
    await validate_org_access(org_id, current_user, db)
    dataset = await _get_dataset_or_404(dataset_id, org_id, db, current_user)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    return sanitize_json(AdvancedStatistics(df).linear_regression(x_col, y_col))


@router.post("/{dataset_id}/stats/regression/logistic")
async def logistic_regression(
    dataset_id: str,
    x_col: str,
    y_col: str,
    positive_class: Optional[str] = Query(default=None),
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Logistic regression for a binary target column (viewer+)."""
    await validate_org_access(org_id, current_user, db)
    dataset = await _get_dataset_or_404(dataset_id, org_id, db, current_user)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    return sanitize_json(AdvancedStatistics(df).logistic_regression(
        x_col, y_col, positive_class=positive_class
    ))


@router.post("/{dataset_id}/stats/regression/polynomial")
async def polynomial_regression(
    dataset_id: str,
    x_col: str,
    y_col: str,
    degree: int = Query(default=2, ge=2, le=6),
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Polynomial regression for numeric predictor/target pairs (viewer+)."""
    await validate_org_access(org_id, current_user, db)
    dataset = await _get_dataset_or_404(dataset_id, org_id, db, current_user)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    return sanitize_json(AdvancedStatistics(df).polynomial_regression(x_col, y_col, degree=degree))


@router.post("/{dataset_id}/stats/ttest")
async def ttest(
    dataset_id: str,
    col1: str,
    col2: str,
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Independent t-test between two columns (viewer+)."""
    await validate_org_access(org_id, current_user, db)
    dataset = await _get_dataset_or_404(dataset_id, org_id, db, current_user)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    return sanitize_json(AdvancedStatistics(df).t_test_independent(col1, col2))


@router.post("/{dataset_id}/stats/mann_whitney")
async def mann_whitney(
    dataset_id: str,
    col1: str,
    col2: str,
    alternative: str = Query(default="two-sided"),
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mann-Whitney U test between two numeric columns (viewer+)."""
    await validate_org_access(org_id, current_user, db)
    dataset = await _get_dataset_or_404(dataset_id, org_id, db, current_user)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    return sanitize_json(AdvancedStatistics(df).mann_whitney_u(col1, col2, alternative=alternative))


@router.post("/{dataset_id}/stats/chi_square")
async def chi_square(
    dataset_id: str,
    col1: str,
    col2: str,
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Chi-square test of independence between two categorical columns (viewer+)."""
    await validate_org_access(org_id, current_user, db)
    dataset = await _get_dataset_or_404(dataset_id, org_id, db, current_user)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    return sanitize_json(AdvancedStatistics(df).chi_square_test(col1, col2))


@router.post("/{dataset_id}/stats/anova")
async def anova(
    dataset_id: str,
    numeric_col: str,
    group_col: str,
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """One-way ANOVA: numeric_col grouped by group_col (viewer+)."""
    await validate_org_access(org_id, current_user, db)
    dataset = await _get_dataset_or_404(dataset_id, org_id, db, current_user)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    return sanitize_json(AdvancedStatistics(df).anova_one_way(numeric_col, group_col))


@router.post("/{dataset_id}/stats/correlation")
async def correlation_test(
    dataset_id: str,
    col1: str,
    col2: str,
    method: str = Query(default="pearson"),
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Correlation coefficient + significance between two numeric columns.
    method: pearson | spearman | kendall  (viewer+).
    """
    from scipy import stats as scipy_stats

    if method not in ("pearson", "spearman", "kendall"):
        raise HTTPException(
            status_code=400, detail="method must be pearson | spearman | kendall"
        )
    await validate_org_access(org_id, current_user, db)
    dataset = await _get_dataset_or_404(dataset_id, org_id, db, current_user)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    if col1 not in df.columns or col2 not in df.columns:
        raise HTTPException(status_code=400, detail="Column not found")
    data = df[[col1, col2]].dropna()
    if len(data) < 3:
        raise HTTPException(status_code=422, detail="Insufficient data")
    fn = {
        "pearson": scipy_stats.pearsonr,
        "spearman": scipy_stats.spearmanr,
        "kendall": scipy_stats.kendalltau,
    }[method]
    stat, p = fn(data[col1], data[col2])
    return sanitize_json({
        "test": f"{method.title()} correlation",
        "column1": col1,
        "column2": col2,
        "coefficient": float(stat),
        "p_value": float(p),
        "significant": bool(p < 0.05),
        "n": int(len(data)),
    })


# ── DuckDB SQL Query ───────────────────────────────────────────────────────────


@router.post("/{dataset_id}/stats/time_series/decompose")
async def time_series_decompose(
    dataset_id: str,
    date_col: str,
    value_col: str,
    period: Optional[int] = Query(default=None, ge=2),
    model: str = Query(default="additive"),
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Time-series decomposition into trend/seasonality/residual (viewer+)."""
    await validate_org_access(org_id, current_user, db)
    dataset = await _get_dataset_or_404(dataset_id, org_id, db, current_user)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    return sanitize_json(AdvancedStatistics(df).time_series_decomposition(
        date_col=date_col,
        value_col=value_col,
        period=period,
        model=model,
    ))


@router.post("/{dataset_id}/stats/time_series/arima")
async def time_series_arima(
    dataset_id: str,
    date_col: str,
    value_col: str,
    periods: int = Query(default=12, ge=1, le=120),
    p: int = Query(default=1, ge=0, le=5),
    d: int = Query(default=1, ge=0, le=2),
    q: int = Query(default=1, ge=0, le=5),
    alpha: float = Query(default=0.05, gt=0, lt=1),
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """ARIMA forecast endpoint for a date/value series (viewer+)."""
    await validate_org_access(org_id, current_user, db)
    dataset = await _get_dataset_or_404(dataset_id, org_id, db, current_user)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    return sanitize_json(AdvancedStatistics(df).arima_forecast(
        date_col=date_col,
        value_col=value_col,
        periods=periods,
        p=p,
        d=d,
        q=q,
        alpha=alpha,
    ))


@router.post("/{dataset_id}/stats/cohort")
async def cohort_analysis(
    dataset_id: str,
    entity_col: str,
    date_col: str,
    freq: str = Query(default="M"),
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cohort retention analysis by entity and activity date (viewer+)."""
    await validate_org_access(org_id, current_user, db)
    dataset = await _get_dataset_or_404(dataset_id, org_id, db, current_user)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    return sanitize_json(AdvancedStatistics(df).cohort_analysis(
        entity_col=entity_col, date_col=date_col, freq=freq
    ))


@router.post("/{dataset_id}/stats/ab_test")
async def ab_test_significance(
    dataset_id: str,
    control_conversions: int = Query(..., ge=0),
    control_total: int = Query(..., ge=1),
    variant_conversions: int = Query(..., ge=0),
    variant_total: int = Query(..., ge=1),
    alpha: float = Query(default=0.05, gt=0, lt=1),
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """A/B test significance calculator using two-proportion z-test (viewer+)."""
    await validate_org_access(org_id, current_user, db)
    await _get_dataset_or_404(dataset_id, org_id, db, current_user)
    return sanitize_json(AdvancedStatistics(pd.DataFrame()).ab_test_significance(
        control_conversions=control_conversions,
        control_total=control_total,
        variant_conversions=variant_conversions,
        variant_total=variant_total,
        alpha=alpha,
    ))


@router.get("/{dataset_id}/query/schema")
async def query_schema(
    dataset_id: str,
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Column schema for the DuckDB query interface (viewer+)."""
    await validate_org_access(org_id, current_user, db)
    dataset = await _get_dataset_or_404(dataset_id, org_id, db, current_user)
    pl_df = _load_polars_from_r2(dataset.file_key, dataset.file_format)
    return {"schema": await asyncio.to_thread(get_schema, pl_df)}


@router.post("/{dataset_id}/query")
async def query_dataset(
    dataset_id: str,
    org_id: str = Query(default="default"),
    sql: str = Body(..., embed=True),
    limit: int = Body(default=1000, ge=1, le=10_000, embed=True),
    offset: int = Body(default=0, ge=0, le=1_000_000, embed=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Ad-hoc SQL SELECT against the dataset via DuckDB (viewer+).

    Table alias: `df`. Example:
        SELECT region, AVG(sales) FROM df GROUP BY region ORDER BY 2 DESC
    """
    await validate_org_access(org_id, current_user, db)
    dataset = await _get_dataset_or_404(dataset_id, org_id, db, current_user)
    pl_df = _load_polars_from_r2(dataset.file_key, dataset.file_format)
    try:
        return await asyncio.to_thread(run_query, pl_df, sql, limit=limit, offset=offset)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/{dataset_id}/query/explain")
async def explain_dataset_query(
    dataset_id: str,
    org_id: str = Query(default="default"),
    sql: str = Body(..., embed=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return DuckDB EXPLAIN plan for a SELECT query (viewer+)."""
    await validate_org_access(org_id, current_user, db)
    dataset = await _get_dataset_or_404(dataset_id, org_id, db, current_user)
    pl_df = _load_polars_from_r2(dataset.file_key, dataset.file_format)
    try:
        return await asyncio.to_thread(explain_query, pl_df, sql)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))


# ── Exports ────────────────────────────────────────────────────────────────────


@router.get("/{dataset_id}/export/excel")
async def export_excel(
    dataset_id: str,
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export dataset + analysis to Excel (viewer+)."""
    await validate_org_access(org_id, current_user, db)
    dataset = await _get_dataset_or_404(dataset_id, org_id, db, current_user)
    analysis = await _get_latest_analysis(dataset_id, db)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    # openpyxl writes cell-by-cell and is measured at 5+ seconds for a
    # 100k-row export well within the 25MB upload cap — synchronously
    # blocking the whole single-process server for that whole window, the
    # same pattern already fixed for /compare and the SQL/stats endpoints.
    excel_data = await asyncio.to_thread(lambda: DataExporter(df, analysis.report).to_excel())
    return Response(
        content=excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{_safe_export_filename(dataset.name, ".xlsx")}"'
        },
    )


@router.get("/{dataset_id}/export/markdown")
async def export_markdown(
    dataset_id: str,
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export analysis as Markdown (viewer+)."""
    await validate_org_access(org_id, current_user, db)
    dataset = await _get_dataset_or_404(dataset_id, org_id, db, current_user)
    analysis = await _get_latest_analysis(dataset_id, db)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    md = DataExporter(df, analysis.report).generate_markdown_report()
    return Response(
        content=md,
        media_type="text/markdown",
        headers={
            "Content-Disposition": f'attachment; filename="{_safe_export_filename(dataset.name, "_report.md")}"'
        },
    )
