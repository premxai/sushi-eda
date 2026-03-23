"""
Pipeline Builder endpoints — org-scoped, Clerk-authenticated.

Implements Task 27 core workflows:
- define Source → Transform → Destination recipes
- schedule recipe execution with cron
- manual runs
- run history with logs/metrics
- versioned recipe snapshots
"""

from __future__ import annotations

import os
from typing import Any

from auth import get_current_user, validate_org_access
from db import get_db
from db.models import Dataset, PipelineRecipe, PipelineRecipeVersion, PipelineRun, User
from defaults import resolve_org_id
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from croniter import croniter

router = APIRouter(tags=["pipelines"])

DATABASE_URL = os.getenv("DATABASE_URL", "")


def _resolved_org_id(org_id: str) -> str:
    return resolve_org_id(org_id)


def _validate_schedule(schedule: str) -> str:
    normalized = (schedule or "").strip() or "0 * * * *"
    if not croniter.is_valid(normalized):
        raise HTTPException(status_code=400, detail="Invalid cron schedule")
    return normalized


def _pipeline_dict(p: PipelineRecipe) -> dict[str, Any]:
    return {
        "pipeline_id": str(p.id),
        "name": p.name,
        "description": p.description,
        "source_dataset_id": str(p.source_dataset_id) if p.source_dataset_id else None,
        "graph": p.graph,
        "destination_type": p.destination_type,
        "destination_config": p.destination_config,
        "schedule": p.schedule,
        "is_active": p.is_active,
        "version": p.version,
        "last_run_at": p.last_run_at.isoformat() if p.last_run_at else None,
        "last_run_status": p.last_run_status,
        "created_at": p.created_at.isoformat(),
        "updated_at": p.updated_at.isoformat(),
    }


def _run_dict(r: PipelineRun) -> dict[str, Any]:
    return {
        "run_id": str(r.id),
        "pipeline_id": str(r.pipeline_id),
        "status": r.status,
        "trigger_type": r.trigger_type,
        "recipe_version": r.recipe_version,
        "output_dataset_id": str(r.output_dataset_id) if r.output_dataset_id else None,
        "logs": r.logs,
        "metrics": r.metrics,
        "started_at": r.started_at.isoformat() if r.started_at else None,
        "finished_at": r.finished_at.isoformat() if r.finished_at else None,
        "created_at": r.created_at.isoformat(),
    }


async def _get_pipeline_or_404(
    pipeline_id: str, org_id: str, db: AsyncSession
) -> PipelineRecipe:
    resolved_org_id = _resolved_org_id(org_id)
    result = await db.execute(
        select(PipelineRecipe).where(
            PipelineRecipe.id == pipeline_id,
            PipelineRecipe.org_id == resolved_org_id,
        )
    )
    pipeline = result.scalar_one_or_none()
    if pipeline is None:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return pipeline


@router.post("/pipelines", status_code=201)
async def create_pipeline(
    org_id: str = Query(default="default"),
    body: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new pipeline recipe (editor+)."""
    await validate_org_access(
        org_id, current_user, db, allowed_roles=("admin", "editor")
    )
    resolved_org_id = _resolved_org_id(org_id)

    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    source_dataset_id = body.get("source_dataset_id")
    if source_dataset_id:
        ds = await db.execute(
            select(Dataset).where(
                Dataset.id == source_dataset_id, Dataset.org_id == resolved_org_id
            )
        )
        if ds.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail="Source dataset not found")

    graph = body.get("graph") or {}
    if not isinstance(graph, dict):
        raise HTTPException(status_code=400, detail="graph must be an object")

    schedule = _validate_schedule(str(body.get("schedule", "0 * * * *")))

    pipeline = PipelineRecipe(
        org_id=resolved_org_id,
        created_by=current_user.id,
        source_dataset_id=source_dataset_id,
        name=name,
        description=body.get("description"),
        graph=graph,
        destination_type=body.get("destination_type", "dataset"),
        destination_config=body.get("destination_config"),
        schedule=schedule,
        is_active=bool(body.get("is_active", True)),
    )
    db.add(pipeline)
    await db.flush()

    first_version = PipelineRecipeVersion(
        pipeline_id=pipeline.id,
        version=1,
        graph=pipeline.graph,
        description=pipeline.description,
        created_by=current_user.id,
    )
    db.add(first_version)
    await db.commit()
    await db.refresh(pipeline)

    logger.info(f"Created pipeline {pipeline.id} for org={org_id}")
    return _pipeline_dict(pipeline)


@router.get("/pipelines")
async def list_pipelines(
    org_id: str = Query(default="default"),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List pipelines in an org (viewer+)."""
    await validate_org_access(org_id, current_user, db)
    resolved_org_id = _resolved_org_id(org_id)
    result = await db.execute(
        select(PipelineRecipe)
        .where(PipelineRecipe.org_id == resolved_org_id)
        .order_by(PipelineRecipe.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    pipelines = result.scalars().all()
    return {"pipelines": [_pipeline_dict(p) for p in pipelines]}


@router.get("/pipelines/{pipeline_id}")
async def get_pipeline(
    pipeline_id: str,
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a pipeline recipe (viewer+)."""
    await validate_org_access(org_id, current_user, db)
    pipeline = await _get_pipeline_or_404(pipeline_id, org_id, db)
    return _pipeline_dict(pipeline)


@router.patch("/pipelines/{pipeline_id}")
async def update_pipeline(
    pipeline_id: str,
    org_id: str = Query(default="default"),
    body: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update pipeline recipe and create a new version snapshot when changed (editor+)."""
    await validate_org_access(
        org_id, current_user, db, allowed_roles=("admin", "editor")
    )
    pipeline = await _get_pipeline_or_404(pipeline_id, org_id, db)

    changed = False

    if "source_dataset_id" in body:
        source_dataset_id = body.get("source_dataset_id")
        if source_dataset_id:
            ds = await db.execute(
                select(Dataset).where(
                    Dataset.id == source_dataset_id, Dataset.org_id == _resolved_org_id(org_id)
                )
            )
            if ds.scalar_one_or_none() is None:
                raise HTTPException(status_code=404, detail="Source dataset not found")
        if source_dataset_id != (
            str(pipeline.source_dataset_id) if pipeline.source_dataset_id else None
        ):
            pipeline.source_dataset_id = source_dataset_id
            changed = True

    for field in ("name", "description", "destination_type", "schedule", "is_active"):
        if field in body:
            value = body[field]
            if field == "schedule":
                value = _validate_schedule(str(value))
            if getattr(pipeline, field) != value:
                setattr(pipeline, field, value)
                changed = True

    if "destination_config" in body:
        value = body["destination_config"]
        if pipeline.destination_config != value:
            pipeline.destination_config = value
            changed = True

    if "graph" in body:
        graph = body.get("graph") or {}
        if not isinstance(graph, dict):
            raise HTTPException(status_code=400, detail="graph must be an object")
        if pipeline.graph != graph:
            pipeline.graph = graph
            changed = True

    if changed:
        pipeline.version += 1
        snapshot = PipelineRecipeVersion(
            pipeline_id=pipeline.id,
            version=pipeline.version,
            graph=pipeline.graph,
            description=pipeline.description,
            created_by=current_user.id,
        )
        db.add(snapshot)

    await db.commit()
    await db.refresh(pipeline)
    return _pipeline_dict(pipeline)


@router.delete("/pipelines/{pipeline_id}", status_code=204, response_model=None)
async def delete_pipeline(
    pipeline_id: str,
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a pipeline and associated runs/versions (editor+)."""
    await validate_org_access(
        org_id, current_user, db, allowed_roles=("admin", "editor")
    )
    pipeline = await _get_pipeline_or_404(pipeline_id, org_id, db)
    await db.delete(pipeline)
    await db.commit()
    logger.info(f"Deleted pipeline {pipeline_id}")


@router.post("/pipelines/{pipeline_id}/run")
async def run_pipeline(
    pipeline_id: str,
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Queue a pipeline run immediately (editor+)."""
    await validate_org_access(
        org_id, current_user, db, allowed_roles=("admin", "editor")
    )
    pipeline = await _get_pipeline_or_404(pipeline_id, org_id, db)

    if not DATABASE_URL:
        raise HTTPException(status_code=500, detail="DATABASE_URL is not configured")

    run = PipelineRun(
        pipeline_id=pipeline.id,
        org_id=pipeline.org_id,
        triggered_by=current_user.id,
        recipe_version=pipeline.version,
        trigger_type="manual",
        status="pending",
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    from worker import run_pipeline_recipe

    task = run_pipeline_recipe.delay(str(pipeline.id), str(run.id), DATABASE_URL)
    return {
        "task_id": task.id,
        "pipeline_id": pipeline_id,
        "run_id": str(run.id),
        "status": "queued",
    }


@router.get("/pipelines/{pipeline_id}/runs")
async def list_pipeline_runs(
    pipeline_id: str,
    org_id: str = Query(default="default"),
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List run history for a pipeline (viewer+)."""
    await validate_org_access(org_id, current_user, db)
    pipeline = await _get_pipeline_or_404(pipeline_id, org_id, db)

    result = await db.execute(
        select(PipelineRun)
        .where(PipelineRun.pipeline_id == pipeline.id)
        .order_by(PipelineRun.created_at.desc())
        .limit(limit)
    )
    runs = result.scalars().all()
    return {"pipeline_id": pipeline_id, "runs": [_run_dict(r) for r in runs]}


@router.get("/pipelines/{pipeline_id}/versions")
async def list_pipeline_versions(
    pipeline_id: str,
    org_id: str = Query(default="default"),
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List immutable version snapshots for a pipeline (viewer+)."""
    await validate_org_access(org_id, current_user, db)
    pipeline = await _get_pipeline_or_404(pipeline_id, org_id, db)

    result = await db.execute(
        select(PipelineRecipeVersion)
        .where(PipelineRecipeVersion.pipeline_id == pipeline.id)
        .order_by(PipelineRecipeVersion.version.desc())
        .limit(limit)
    )
    versions = result.scalars().all()
    return {
        "pipeline_id": pipeline_id,
        "versions": [
            {
                "version_id": str(v.id),
                "version": v.version,
                "graph": v.graph,
                "description": v.description,
                "created_at": v.created_at.isoformat(),
            }
            for v in versions
        ],
    }
