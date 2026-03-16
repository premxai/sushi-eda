"""
Dataset monitor endpoints — org-scoped, Clerk-authenticated.

A monitor watches a dataset metric and alerts when a threshold is breached.
Checks run on a configurable cron schedule via Celery Beat.

Routes:
  POST   /datasets/{dataset_id}/monitors        — create monitor (editor+)
  GET    /datasets/{dataset_id}/monitors        — list monitors (viewer+)
  GET    /monitors/{monitor_id}                 — get monitor (viewer+)
  PATCH  /monitors/{monitor_id}                 — update monitor (editor+)
  DELETE /monitors/{monitor_id}                 — delete monitor (editor+)
  POST   /monitors/{monitor_id}/run             — trigger manual run (editor+)
  GET    /monitors/{monitor_id}/runs            — run history (viewer+)

Check types:
  row_count       — total rows in latest analysis
  null_rate       — null % for a specific column
  quality_score   — overall quality score
  column_drift    — % change in column mean vs previous analysis

Conditions:
  lt | gt | eq | change_pct
"""

from __future__ import annotations

import os
from typing import Any

from auth import get_current_user, validate_org_access
from db import get_db
from db.models import Analysis, Dataset, Monitor, MonitorRun, User
from defaults import resolve_org_id
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["monitors"])

DATABASE_URL = os.getenv("DATABASE_URL", "")

_VALID_CHECK_TYPES = frozenset(
    ["row_count", "null_rate", "quality_score", "column_drift"]
)
_VALID_CONDITIONS = frozenset(["lt", "gt", "eq", "change_pct"])


# ── Helpers ────────────────────────────────────────────────────────────────────


async def _get_monitor_or_404(
    monitor_id: str, org_id: str, db: AsyncSession
) -> Monitor:
    result = await db.execute(
        select(Monitor).where(Monitor.id == monitor_id, Monitor.org_id == org_id)
    )
    m = result.scalar_one_or_none()
    if m is None:
        raise HTTPException(status_code=404, detail="Monitor not found")
    return m


def _monitor_dict(m: Monitor) -> dict[str, Any]:
    return {
        "monitor_id": str(m.id),
        "dataset_id": str(m.dataset_id),
        "name": m.name,
        "check_type": m.check_type,
        "column_name": m.column_name,
        "condition": m.condition,
        "threshold": m.threshold,
        "schedule": m.schedule,
        "is_active": m.is_active,
        "last_checked_at": m.last_checked_at.isoformat() if m.last_checked_at else None,
        "last_status": m.last_status,
        "created_at": m.created_at.isoformat(),
    }


# ── CRUD ───────────────────────────────────────────────────────────────────────


@router.post("/datasets/{dataset_id}/monitors", status_code=201)
async def create_monitor(
    dataset_id: str,
    org_id: str = Query(default="default"),
    body: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a data quality monitor for a dataset.

    Body:
    {
      "name": "Row count drop alert",
      "check_type": "row_count",          // row_count | null_rate | quality_score | column_drift
      "column_name": null,                 // required for null_rate and column_drift
      "condition": "lt",                   // lt | gt | eq | change_pct
      "threshold": 1000,                   // numeric threshold value
      "schedule": "0 9 * * *"             // cron: daily at 9am UTC
    }
    """
    await validate_org_access(
        org_id, current_user, db, allowed_roles=("admin", "editor")
    )

    # Verify dataset belongs to org
    ds = await db.execute(
        select(Dataset).where(Dataset.id == dataset_id, Dataset.org_id == org_id)
    )
    if ds.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    check_type = body.get("check_type", "")
    condition = body.get("condition", "")
    if check_type not in _VALID_CHECK_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid check_type. Choose from: {sorted(_VALID_CHECK_TYPES)}",
        )
    if condition not in _VALID_CONDITIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid condition. Choose from: {sorted(_VALID_CONDITIONS)}",
        )

    monitor = Monitor(
        dataset_id=dataset_id,
        org_id=resolve_org_id(org_id),
        created_by=current_user.id,
        name=body.get("name", "Unnamed monitor"),
        check_type=check_type,
        column_name=body.get("column_name"),
        condition=condition,
        threshold=float(body.get("threshold", 0)),
        schedule=body.get("schedule", "0 * * * *"),
        is_active=body.get("is_active", True),
    )
    db.add(monitor)
    await db.commit()
    await db.refresh(monitor)

    logger.info(f"Created monitor {monitor.id} ({check_type}) for dataset {dataset_id}")
    return _monitor_dict(monitor)


@router.get("/datasets/{dataset_id}/monitors")
async def list_monitors(
    dataset_id: str,
    org_id: str = Query(default="default"),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await validate_org_access(org_id, current_user, db)
    result = await db.execute(
        select(Monitor)
        .where(Monitor.dataset_id == dataset_id, Monitor.org_id == org_id)
        .order_by(Monitor.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    monitors = result.scalars().all()
    return {"monitors": [_monitor_dict(m) for m in monitors]}


@router.get("/monitors/{monitor_id}")
async def get_monitor(
    monitor_id: str,
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await validate_org_access(org_id, current_user, db)
    m = await _get_monitor_or_404(monitor_id, org_id, db)
    return _monitor_dict(m)


@router.patch("/monitors/{monitor_id}")
async def update_monitor(
    monitor_id: str,
    org_id: str = Query(default="default"),
    body: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Partially update a monitor (name, threshold, schedule, is_active)."""
    await validate_org_access(
        org_id, current_user, db, allowed_roles=("admin", "editor")
    )
    m = await _get_monitor_or_404(monitor_id, org_id, db)

    for field in ("name", "threshold", "schedule", "is_active", "column_name"):
        if field in body:
            val = body[field]
            if field == "threshold":
                val = float(val)
            setattr(m, field, val)

    await db.commit()
    await db.refresh(m)
    return _monitor_dict(m)


@router.delete("/monitors/{monitor_id}", status_code=204, response_model=None)
async def delete_monitor(
    monitor_id: str,
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await validate_org_access(
        org_id, current_user, db, allowed_roles=("admin", "editor")
    )
    m = await _get_monitor_or_404(monitor_id, org_id, db)
    await db.delete(m)
    await db.commit()
    logger.info(f"Deleted monitor {monitor_id}")


# ── Run endpoints ──────────────────────────────────────────────────────────────


@router.post("/monitors/{monitor_id}/run")
async def trigger_monitor_run(
    monitor_id: str,
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually trigger a monitor check immediately."""
    await validate_org_access(
        org_id, current_user, db, allowed_roles=("admin", "editor")
    )
    m = await _get_monitor_or_404(monitor_id, org_id, db)

    from worker import run_monitor_check

    result = run_monitor_check.delay(str(m.id), DATABASE_URL)
    return {"task_id": result.id, "monitor_id": monitor_id, "status": "queued"}


@router.get("/monitors/{monitor_id}/runs")
async def get_monitor_runs(
    monitor_id: str,
    org_id: str = Query(default="default"),
    limit: int = Query(default=50, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve run history for a monitor (newest first)."""
    await validate_org_access(org_id, current_user, db)
    m = await _get_monitor_or_404(monitor_id, org_id, db)

    result = await db.execute(
        select(MonitorRun)
        .where(MonitorRun.monitor_id == monitor_id)
        .order_by(MonitorRun.ran_at.desc())
        .limit(limit)
    )
    runs = result.scalars().all()
    return {
        "monitor_id": monitor_id,
        "runs": [
            {
                "run_id": str(r.id),
                "status": r.status,
                "actual_value": r.actual_value,
                "message": r.message,
                "ran_at": r.ran_at.isoformat(),
            }
            for r in runs
        ],
    }
