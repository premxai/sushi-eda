"""
Dataset & Analysis router — replaces the global _current_df pattern.

All endpoints are scoped to (org_id, dataset_id). The DataFrame is
fetched from R2 on demand, never held in global server memory.

Routes:
  GET  /datasets                        — list datasets for an org
  GET  /datasets/{dataset_id}           — get dataset metadata
  DELETE /datasets/{dataset_id}         — delete dataset + R2 files
  GET  /datasets/{dataset_id}/analysis  — get latest analysis report
  GET  /analyses/{analysis_id}          — get analysis by ID
  GET  /datasets/{dataset_id}/visualize/{column} — on-demand chart
  GET  /datasets/{dataset_id}/visualize          — all charts
  GET  /datasets/{dataset_id}/stats/advanced     — advanced stats
  POST /datasets/{dataset_id}/stats/regression   — linear regression
  POST /datasets/{dataset_id}/stats/ttest        — t-test
  GET  /datasets/{dataset_id}/export/excel       — Excel export
  GET  /datasets/{dataset_id}/export/markdown    — Markdown export
"""
from typing import Any
from uuid import UUID

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi import Body

from analyzer import EDAAnalyzer
from advanced_stats import AdvancedStatistics
from duckdb_query import get_schema, run_query
from export_utils import DataExporter
from visualizer import Visualizer
from cache import cache
from storage import storage
from polars_loader import parse_to_polars
from db import get_db
from db.models import Analysis, Dataset

router = APIRouter(prefix="/datasets", tags=["datasets"])


# ── Helpers ───────────────────────────────────────────────────────────────────

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
            detail=f"Dataset is not ready (status={dataset.status}). Wait for analysis to complete.",
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
    """Download file from R2 and return a Polars DataFrame."""
    import polars as pl
    data = storage.download(file_key)
    try:
        return parse_to_polars(data, file_format)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


def _load_df_from_r2(file_key: str, file_format: str) -> pd.DataFrame:
    """Download file from R2 and return a pandas DataFrame (for scipy/plotly consumers)."""
    return _load_polars_from_r2(file_key, file_format).to_pandas()


# ── Dataset CRUD ──────────────────────────────────────────────────────────────

@router.get("")
async def list_datasets(
    org_id: str = Query(default="default"),
    db: AsyncSession = Depends(get_db),
):
    """List all datasets for an organization."""
    result = await db.execute(
        select(Dataset).where(Dataset.org_id == org_id).order_by(Dataset.created_at.desc())
    )
    datasets = result.scalars().all()
    return [
        {
            "id": str(d.id),
            "name": d.name,
            "original_filename": d.original_filename,
            "file_format": d.file_format,
            "file_size_bytes": d.file_size_bytes,
            "row_count": d.row_count,
            "column_count": d.column_count,
            "status": d.status,
            "created_at": d.created_at.isoformat(),
        }
        for d in datasets
    ]


@router.get("/{dataset_id}")
async def get_dataset(
    dataset_id: str,
    org_id: str = Query(default="default"),
    db: AsyncSession = Depends(get_db),
):
    """Get dataset metadata."""
    result = await db.execute(
        select(Dataset).where(Dataset.id == dataset_id, Dataset.org_id == org_id)
    )
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return {
        "id": str(dataset.id),
        "name": dataset.name,
        "original_filename": dataset.original_filename,
        "file_format": dataset.file_format,
        "file_size_bytes": dataset.file_size_bytes,
        "row_count": dataset.row_count,
        "column_count": dataset.column_count,
        "status": dataset.status,
        "error_message": dataset.error_message,
        "created_at": dataset.created_at.isoformat(),
        "updated_at": dataset.updated_at.isoformat(),
    }


@router.delete("/{dataset_id}", status_code=204)
async def delete_dataset(
    dataset_id: str,
    org_id: str = Query(default="default"),
    db: AsyncSession = Depends(get_db),
):
    """Delete a dataset, its analyses, and its R2 files."""
    result = await db.execute(
        select(Dataset).where(Dataset.id == dataset_id, Dataset.org_id == org_id)
    )
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Delete R2 files
    try:
        prefix = f"uploads/{org_id}/{dataset_id}/"
        storage.delete_prefix(prefix)
    except Exception as e:
        logger.warning(f"R2 delete failed for {dataset_id}: {e}")

    # Delete DB row (cascades to analyses, monitors)
    await db.delete(dataset)
    await db.commit()
    logger.info(f"Deleted dataset {dataset_id}")


# ── Analysis retrieval ────────────────────────────────────────────────────────

@router.get("/{dataset_id}/analysis")
async def get_dataset_analysis(
    dataset_id: str,
    org_id: str = Query(default="default"),
    db: AsyncSession = Depends(get_db),
):
    """Return the latest analysis report for a dataset."""
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


@router.get("/{dataset_id}/analyses")
async def list_dataset_analyses(
    dataset_id: str,
    org_id: str = Query(default="default"),
    db: AsyncSession = Depends(get_db),
):
    """List all analysis versions for a dataset (version history)."""
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
    db: AsyncSession = Depends(get_db),
):
    """Fetch a specific analysis by its UUID (used after SSE job_done)."""
    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if analysis is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return {
        "analysis_id": str(analysis.id),
        "dataset_id": str(analysis.dataset_id),
        "version": analysis.version,
        "ai_narrative": analysis.ai_narrative,
        "duration_seconds": analysis.duration_seconds,
        "created_at": analysis.created_at.isoformat(),
        "report": analysis.report,
    }


# ── Visualizations (on-demand, loads DF from R2) ─────────────────────────────

@router.get("/{dataset_id}/visualize/{column_name}")
async def visualize_column(
    dataset_id: str,
    column_name: str,
    org_id: str = Query(default="default"),
    chart_type: str = "auto",
    db: AsyncSession = Depends(get_db),
):
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
    else:
        raise HTTPException(status_code=400, detail=f"Unknown chart_type: {resolved}")


@router.get("/{dataset_id}/visualize")
async def visualize_all(
    dataset_id: str,
    org_id: str = Query(default="default"),
    db: AsyncSession = Depends(get_db),
):
    dataset = await _get_dataset_or_404(dataset_id, org_id, db)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    return Visualizer(df).generate_all_visualizations()


# ── Advanced Stats ────────────────────────────────────────────────────────────

@router.get("/{dataset_id}/stats/advanced")
async def advanced_stats(
    dataset_id: str,
    org_id: str = Query(default="default"),
    db: AsyncSession = Depends(get_db),
):
    dataset = await _get_dataset_or_404(dataset_id, org_id, db)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    return AdvancedStatistics(df).generate_all_tests()


@router.post("/{dataset_id}/stats/regression")
async def regression(
    dataset_id: str,
    x_col: str,
    y_col: str,
    org_id: str = Query(default="default"),
    db: AsyncSession = Depends(get_db),
):
    dataset = await _get_dataset_or_404(dataset_id, org_id, db)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    return AdvancedStatistics(df).linear_regression(x_col, y_col)


@router.post("/{dataset_id}/stats/ttest")
async def ttest(
    dataset_id: str,
    col1: str,
    col2: str,
    org_id: str = Query(default="default"),
    db: AsyncSession = Depends(get_db),
):
    dataset = await _get_dataset_or_404(dataset_id, org_id, db)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    return AdvancedStatistics(df).t_test_independent(col1, col2)


# ── DuckDB SQL Query ─────────────────────────────────────────────────────────

@router.get("/{dataset_id}/query/schema")
async def query_schema(
    dataset_id: str,
    org_id: str = Query(default="default"),
    db: AsyncSession = Depends(get_db),
):
    """Return the column schema visible to DuckDB for a dataset."""
    dataset = await _get_dataset_or_404(dataset_id, org_id, db)
    pl_df = _load_polars_from_r2(dataset.file_key, dataset.file_format)
    return {"schema": get_schema(pl_df)}


@router.post("/{dataset_id}/query")
async def query_dataset(
    dataset_id: str,
    org_id: str = Query(default="default"),
    sql: str = Body(..., embed=True),
    limit: int = Body(default=1000, ge=1, le=10_000, embed=True),
    db: AsyncSession = Depends(get_db),
):
    """
    Run an ad-hoc SQL SELECT against the dataset using DuckDB.

    The table is aliased as `df` in your query, e.g.:
        SELECT region, AVG(sales) FROM df GROUP BY region ORDER BY 2 DESC

    Results are capped at `limit` rows (default 1 000, max 10 000).
    Only SELECT statements are allowed.
    """
    dataset = await _get_dataset_or_404(dataset_id, org_id, db)
    pl_df = _load_polars_from_r2(dataset.file_key, dataset.file_format)
    try:
        result = run_query(pl_df, sql, limit=limit)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return result


# ── Exports ───────────────────────────────────────────────────────────────────

@router.get("/{dataset_id}/export/excel")
async def export_excel(
    dataset_id: str,
    org_id: str = Query(default="default"),
    db: AsyncSession = Depends(get_db),
):
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
    db: AsyncSession = Depends(get_db),
):
    dataset = await _get_dataset_or_404(dataset_id, org_id, db)
    analysis = await _get_latest_analysis(dataset_id, db)
    df = _load_df_from_r2(dataset.file_key, dataset.file_format)
    md = DataExporter(df, analysis.report).generate_markdown_report()
    return Response(
        content=md,
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename={dataset.name}_report.md"},
    )
