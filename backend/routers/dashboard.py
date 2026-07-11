"""Personal dashboard saves.

Analyses and uploads are intentionally unlimited. A dashboard save is only a
small, curated pointer to an existing dataset or report, capped at three per
user and kind.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from db import get_db
from db.models import Analysis, DashboardSave, Dataset, User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
SAVE_LIMIT = 3


def _dataset_summary(dataset: Dataset) -> dict:
    return {
        "id": str(dataset.id),
        "name": dataset.name,
        "original_filename": dataset.original_filename,
        "file_format": dataset.file_format,
        "row_count": dataset.row_count,
        "column_count": dataset.column_count,
        "created_at": dataset.created_at.isoformat(),
    }


async def _owned_dataset(dataset_id: str, user: User, db: AsyncSession) -> Dataset:
    try:
        parsed_id = uuid.UUID(dataset_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid dataset id") from exc
    result = await db.execute(select(Dataset).where(Dataset.id == parsed_id, Dataset.created_by == user.id))
    dataset = result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if dataset.status != "ready":
        raise HTTPException(status_code=409, detail="Wait for this dataset's analysis to finish before saving it")
    return dataset


async def _ensure_capacity(user: User, kind: str, db: AsyncSession) -> None:
    existing = (await db.execute(select(DashboardSave).where(DashboardSave.user_id == user.id, DashboardSave.kind == kind))).scalars().all()
    if len(existing) >= SAVE_LIMIT:
        label = "datasets" if kind == "dataset" else "reports"
        raise HTTPException(status_code=409, detail=f"You can save up to {SAVE_LIMIT} {label}. Remove one from your dashboard to save another.")


@router.get("")
async def get_dashboard(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    dataset_rows = (await db.execute(
        select(DashboardSave, Dataset)
        .join(Dataset, DashboardSave.dataset_id == Dataset.id)
        .where(DashboardSave.user_id == current_user.id, DashboardSave.kind == "dataset")
        .order_by(DashboardSave.created_at.desc())
    )).all()
    report_rows = (await db.execute(
        select(DashboardSave, Analysis, Dataset)
        .join(Analysis, DashboardSave.analysis_id == Analysis.id)
        .join(Dataset, Analysis.dataset_id == Dataset.id)
        .where(DashboardSave.user_id == current_user.id, DashboardSave.kind == "report")
        .order_by(DashboardSave.created_at.desc())
    )).all()

    reports = []
    for _, analysis, dataset in report_rows:
        basic = analysis.report.get("basic_info", {}) if isinstance(analysis.report, dict) else {}
        quality = analysis.report.get("quality_score", {}) if isinstance(analysis.report, dict) else {}
        reports.append({
            "analysis_id": str(analysis.id),
            "dataset_id": str(dataset.id),
            "name": dataset.name,
            "created_at": analysis.created_at.isoformat(),
            "rows": basic.get("rows", dataset.row_count),
            "columns": basic.get("columns", dataset.column_count),
            "quality_score": quality.get("overall_score"),
        })

    return {
        "profile": {"name": current_user.name, "email": current_user.email},
        "limits": {"datasets": SAVE_LIMIT, "reports": SAVE_LIMIT},
        "saved_datasets": [_dataset_summary(dataset) for _, dataset in dataset_rows],
        "saved_reports": reports,
    }


@router.post("/datasets/{dataset_id}")
async def save_dataset(dataset_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    dataset = await _owned_dataset(dataset_id, current_user, db)
    existing = (await db.execute(select(DashboardSave).where(DashboardSave.user_id == current_user.id, DashboardSave.kind == "dataset", DashboardSave.dataset_id == dataset.id))).scalar_one_or_none()
    if existing:
        return {"saved": True, "dataset_id": dataset_id}
    await _ensure_capacity(current_user, "dataset", db)
    db.add(DashboardSave(user_id=current_user.id, kind="dataset", dataset_id=dataset.id))
    await db.commit()
    return {"saved": True, "dataset_id": dataset_id}


@router.delete("/datasets/{dataset_id}")
async def unsave_dataset(dataset_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    dataset = await _owned_dataset(dataset_id, current_user, db)
    save = (await db.execute(select(DashboardSave).where(DashboardSave.user_id == current_user.id, DashboardSave.kind == "dataset", DashboardSave.dataset_id == dataset.id))).scalar_one_or_none()
    if save:
        await db.delete(save)
        await db.commit()
    return {"saved": False, "dataset_id": dataset_id}


@router.post("/reports/dataset/{dataset_id}")
async def save_report(dataset_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    dataset = await _owned_dataset(dataset_id, current_user, db)
    analysis = (await db.execute(select(Analysis).where(Analysis.dataset_id == dataset.id).order_by(Analysis.version.desc()).limit(1))).scalar_one_or_none()
    if analysis is None:
        raise HTTPException(status_code=404, detail="Report not found")
    existing = (await db.execute(select(DashboardSave).where(DashboardSave.user_id == current_user.id, DashboardSave.kind == "report", DashboardSave.analysis_id == analysis.id))).scalar_one_or_none()
    if existing:
        return {"saved": True, "analysis_id": str(analysis.id)}
    await _ensure_capacity(current_user, "report", db)
    db.add(DashboardSave(user_id=current_user.id, kind="report", analysis_id=analysis.id))
    await db.commit()
    return {"saved": True, "analysis_id": str(analysis.id)}


@router.delete("/reports/{analysis_id}")
async def unsave_report(analysis_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        parsed_id = uuid.UUID(analysis_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid report id") from exc
    save = (await db.execute(select(DashboardSave).where(DashboardSave.user_id == current_user.id, DashboardSave.kind == "report", DashboardSave.analysis_id == parsed_id))).scalar_one_or_none()
    if save:
        await db.delete(save)
        await db.commit()
    return {"saved": False, "analysis_id": analysis_id}
