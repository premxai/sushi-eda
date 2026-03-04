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
from datetime import datetime, timezone
from typing import Any, Optional

import pandas as pd
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import Response
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from advanced_stats import AdvancedStatistics
from auth import get_current_user, validate_org_access
from duckdb_query import explain_query, get_schema, run_query
from export_utils import DataExporter
from polars_loader import parse_to_polars
from storage import storage
from visualizer import Visualizer
from db import get_db
from db.models import Analysis, Dataset, User

router = APIRouter(prefix="/datasets", tags=["datasets"])


# ── Helpers ────────────────────────────────────────────────────────────────────

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

async def _get_dataset_or_404(dataset_id: str, org_id: str, db: AsyncSession) -> Dataset:
    result = await db.execute(
        select(Dataset).where(Dataset.id == dataset_id, Dataset.org_id == org_id)
    )
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
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
        raise HTTPException(status_code=404, detail="No analysis found for this dataset")
    return analysis


def _load_polars_from_r2(file_key: str, file_format: str):
    """Download from R2 and return a Polars DataFrame."""
    data = storage.download(file_key)
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
    query = select(Dataset).where(Dataset.org_id == org_id)
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
    await validate_org_access(org_id, current_user, db, allowed_roles=("admin", "editor"))
    result = await db.execute(
        select(Dataset).where(Dataset.id == dataset_id, Dataset.org_id == org_id)
    )
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
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
    await validate_org_access(org_id, current_user, db, allowed_roles=("admin", "editor"))
    result = await db.execute(
        select(Dataset).where(Dataset.id == dataset_id, Dataset.org_id == org_id)
    )
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
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
    await validate_org_access(org_id, current_user, db, allowed_roles=("admin", "editor"))
    result = await db.execute(
        select(Dataset).where(Dataset.id == dataset_id, Dataset.org_id == org_id)
    )
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    dataset.archived_at = None
    await db.commit()
    return {"id": dataset_id, "archived_at": None}


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
        select(Dataset).where(Dataset.id == dataset_id, Dataset.org_id == org_id)
    )
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
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
    await validate_org_access(org_id, current_user, db, allowed_roles=("admin", "editor"))
    result = await db.execute(
        select(Dataset).where(Dataset.id == dataset_id, Dataset.org_id == org_id)
    )
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        storage.delete_prefix(f"uploads/{org_id}/{dataset_id}/")
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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the latest analysis report (viewer+)."""
    await validate_org_access(org_id, current_user, db)
    await _get_dataset_or_404(dataset_id, org_id, db)
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
):
    """
    Re-generate the AI narrative for the latest analysis (editor+).
    Useful after the initial job ran without ANTHROPIC_API_KEY set.
    Returns the new narrative and updates Analysis.ai_narrative in DB.
    """
    await validate_org_access(org_id, current_user, db, allowed_roles=("admin", "editor"))
    await _get_dataset_or_404(dataset_id, org_id, db)
    analysis = await _get_latest_analysis(dataset_id, db)

    from ai_credits import CREDIT_COSTS, check_credits, consume_credits
    await check_credits(org_id, cost=CREDIT_COSTS["narrative"], db=db)

    from ai_narrative import generate_narrative
    from sqlalchemy import update as sa_update

    narrative = generate_narrative(analysis.report, dataset_name=str(dataset_id))
    if narrative is None:
        raise HTTPException(
            status_code=503,
            detail="AI narrative generation unavailable — check ANTHROPIC_API_KEY",
        )

    await consume_credits(org_id, cost=CREDIT_COSTS["narrative"], db=db)
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
    await _get_dataset_or_404(dataset_id, org_id, db)
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
    from ai_credits import CREDIT_COSTS, check_credits, consume_credits
    await check_credits(org_id, cost=CREDIT_COSTS["chat"], db=db)
    dataset = await _get_dataset_or_404(dataset_id, org_id, db)
    pl_df = _load_polars_from_r2(dataset.file_key, dataset.file_format)

    from ai_chat import ask_dataset
    result = ask_dataset(pl_df, question, chat_history=chat_history, limit=limit)
    if result.get("error") is None:
        await consume_credits(org_id, cost=CREDIT_COSTS["chat"], db=db)
    return result


@router.post("/{dataset_id}/ai/chat/stream")
async def ai_chat_stream(
    dataset_id: str,
    org_id: str = Query(default="default"),
    question: str = Body(..., embed=True),
    chat_history: list = Body(default=[], embed=True),
    limit: int = Body(default=500, ge=1, le=5000, embed=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Streaming SSE version of AI chat (viewer+).

    Yields events: sql | results | token | done | error
    Content-Type: text/event-stream
    """
    from fastapi.responses import StreamingResponse
    await validate_org_access(org_id, current_user, db)
    from ai_credits import CREDIT_COSTS, check_credits, consume_credits
    await check_credits(org_id, cost=CREDIT_COSTS["chat"], db=db)
    dataset = await _get_dataset_or_404(dataset_id, org_id, db)
    pl_df = _load_polars_from_r2(dataset.file_key, dataset.file_format)
    # Consume credits upfront for streaming (can't check mid-stream)
    await consume_credits(org_id, cost=CREDIT_COSTS["chat"], db=db)

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
):
    """
    AI-powered data cleaning suggestions (viewer+).

    Uses the latest analysis report to generate actionable cleaning steps
    with priority ranking, impact estimates, and ready-to-apply operation specs.
    Falls back to rule-based suggestions if ANTHROPIC_API_KEY is not set.
    """
    await validate_org_access(org_id, current_user, db)
    await _get_dataset_or_404(dataset_id, org_id, db)
    analysis = await _get_latest_analysis(dataset_id, db)

    from ai_credits import CREDIT_COSTS, check_credits, consume_credits
    await check_credits(org_id, cost=CREDIT_COSTS["cleaning_suggestions"], db=db)

    from ai_cleaning import generate_cleaning_suggestions
    suggestions = generate_cleaning_suggestions(analysis.report)
    if suggestions:
        await consume_credits(org_id, cost=CREDIT_COSTS["cleaning_suggestions"], db=db)
    return {"dataset_id": dataset_id, "suggestions": suggestions}


# ── AI Credits ────────────────────────────────────────────────────────────────

credits_router = APIRouter(prefix="/orgs", tags=["credits"])


@credits_router.get("/{org_id}/credits")
async def get_org_credits(
    org_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return AI credit usage for an organisation (any member)."""
    await validate_org_access(org_id, current_user, db)
    from ai_credits import get_credit_status
    return await get_credit_status(org_id, db)


# ── Visualizations ─────────────────────────────────────────────────────────────

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
    dataset = await _get_dataset_or_404(dataset_id, org_id, db)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)

    if column_name not in df.columns:
        raise HTTPException(status_code=404, detail=f"Column '{column_name}' not found")

    viz = Visualizer(df)
    is_numeric = pd.api.types.is_numeric_dtype(df[column_name])
    resolved = chart_type if chart_type != "auto" else ("distribution" if is_numeric else "categorical_bar")

    if resolved == "distribution":
        return viz.create_distribution_plot(column_name)
    elif resolved == "box_plot":
        return viz.create_box_plot(column_name)
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
    dataset = await _get_dataset_or_404(dataset_id, org_id, db)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    return Visualizer(df).generate_all_visualizations()


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
    dataset = await _get_dataset_or_404(dataset_id, org_id, db)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    return AdvancedStatistics(df).generate_all_tests()


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
    dataset = await _get_dataset_or_404(dataset_id, org_id, db)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    return AdvancedStatistics(df).linear_regression(x_col, y_col)


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
    dataset = await _get_dataset_or_404(dataset_id, org_id, db)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    return AdvancedStatistics(df).logistic_regression(x_col, y_col, positive_class=positive_class)


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
    dataset = await _get_dataset_or_404(dataset_id, org_id, db)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    return AdvancedStatistics(df).polynomial_regression(x_col, y_col, degree=degree)


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
    dataset = await _get_dataset_or_404(dataset_id, org_id, db)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    return AdvancedStatistics(df).t_test_independent(col1, col2)


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
    dataset = await _get_dataset_or_404(dataset_id, org_id, db)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    return AdvancedStatistics(df).mann_whitney_u(col1, col2, alternative=alternative)


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
    dataset = await _get_dataset_or_404(dataset_id, org_id, db)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    return AdvancedStatistics(df).chi_square_test(col1, col2)


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
    dataset = await _get_dataset_or_404(dataset_id, org_id, db)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    return AdvancedStatistics(df).anova_one_way(numeric_col, group_col)


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
        raise HTTPException(status_code=400, detail="method must be pearson | spearman | kendall")
    await validate_org_access(org_id, current_user, db)
    dataset = await _get_dataset_or_404(dataset_id, org_id, db)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    if col1 not in df.columns or col2 not in df.columns:
        raise HTTPException(status_code=400, detail="Column not found")
    data = df[[col1, col2]].dropna()
    if len(data) < 3:
        raise HTTPException(status_code=422, detail="Insufficient data")
    fn = {"pearson": scipy_stats.pearsonr, "spearman": scipy_stats.spearmanr, "kendall": scipy_stats.kendalltau}[method]
    stat, p = fn(data[col1], data[col2])
    return {
        "test": f"{method.title()} correlation",
        "column1": col1, "column2": col2,
        "coefficient": float(stat), "p_value": float(p),
        "significant": p < 0.05, "n": int(len(data)),
    }


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
    dataset = await _get_dataset_or_404(dataset_id, org_id, db)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    return AdvancedStatistics(df).time_series_decomposition(
        date_col=date_col,
        value_col=value_col,
        period=period,
        model=model,
    )


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
    dataset = await _get_dataset_or_404(dataset_id, org_id, db)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    return AdvancedStatistics(df).arima_forecast(
        date_col=date_col,
        value_col=value_col,
        periods=periods,
        p=p,
        d=d,
        q=q,
        alpha=alpha,
    )


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
    dataset = await _get_dataset_or_404(dataset_id, org_id, db)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    return AdvancedStatistics(df).cohort_analysis(entity_col=entity_col, date_col=date_col, freq=freq)


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
    await _get_dataset_or_404(dataset_id, org_id, db)
    return AdvancedStatistics(pd.DataFrame()).ab_test_significance(
        control_conversions=control_conversions,
        control_total=control_total,
        variant_conversions=variant_conversions,
        variant_total=variant_total,
        alpha=alpha,
    )


@router.get("/{dataset_id}/query/schema")
async def query_schema(
    dataset_id: str,
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Column schema for the DuckDB query interface (viewer+)."""
    await validate_org_access(org_id, current_user, db)
    dataset = await _get_dataset_or_404(dataset_id, org_id, db)
    pl_df = _load_polars_from_r2(dataset.file_key, dataset.file_format)
    return {"schema": get_schema(pl_df)}


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
    dataset = await _get_dataset_or_404(dataset_id, org_id, db)
    pl_df = _load_polars_from_r2(dataset.file_key, dataset.file_format)
    try:
        return run_query(pl_df, sql, limit=limit, offset=offset)
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
    dataset = await _get_dataset_or_404(dataset_id, org_id, db)
    pl_df = _load_polars_from_r2(dataset.file_key, dataset.file_format)
    try:
        return explain_query(pl_df, sql)
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
    dataset = await _get_dataset_or_404(dataset_id, org_id, db)
    analysis = await _get_latest_analysis(dataset_id, db)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    excel_data = DataExporter(df, analysis.report).to_excel()
    return Response(
        content=excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={dataset.name}.xlsx"},
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
    dataset = await _get_dataset_or_404(dataset_id, org_id, db)
    analysis = await _get_latest_analysis(dataset_id, db)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    md = DataExporter(df, analysis.report).generate_markdown_report()
    return Response(
        content=md,
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename={dataset.name}_report.md"},
    )
