"""
Shareable public report links.

Routes:
  POST /datasets/{dataset_id}/share   — create a share token (editor+)
  GET  /share/{token}                 — fetch the report by token (public, no auth)
  DELETE /share/{token}               — revoke a share (editor+)

Share tokens are UUID4 values stored in Redis with a TTL.
They map: token → {dataset_id, org_id, analysis_id, created_by, expires_at}

The public GET endpoint does NOT require Clerk auth — it can be embedded
in an iframe or shared via a link.
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user, validate_org_access
from cache import cache
from db import get_db
from db.models import Analysis, Dataset, User

router = APIRouter(tags=["shares"])

# Default TTL for share links (7 days)
SHARE_TTL_SECONDS = int(os.getenv("SHARE_TTL_SECONDS", str(7 * 24 * 3600)))
SHARE_KEY_PREFIX = "share:"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/datasets/{dataset_id}/share")
async def create_share(
    dataset_id: str,
    org_id: str = Query(default="default"),
    ttl_hours: int = Body(default=168, ge=1, le=720, embed=True),  # 1h–30d
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a shareable public link for the latest analysis report (editor+).

    Returns:
        {
          "token": "uuid4",
          "share_url": "/share/uuid4",
          "expires_at": "ISO timestamp",
          "ttl_hours": int
        }
    """
    await validate_org_access(org_id, current_user, db, allowed_roles=("admin", "editor"))

    # Verify dataset + get latest analysis
    ds_result = await db.execute(
        select(Dataset).where(Dataset.id == dataset_id, Dataset.org_id == org_id)
    )
    dataset = ds_result.scalar_one_or_none()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    an_result = await db.execute(
        select(Analysis)
        .where(Analysis.dataset_id == dataset_id)
        .order_by(Analysis.version.desc())
        .limit(1)
    )
    analysis = an_result.scalar_one_or_none()
    if analysis is None:
        raise HTTPException(status_code=404, detail="No analysis found for this dataset")

    token = str(uuid.uuid4())
    ttl_seconds = ttl_hours * 3600
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)

    payload = {
        "dataset_id": dataset_id,
        "org_id": org_id,
        "analysis_id": str(analysis.id),
        "dataset_name": dataset.name,
        "created_by": str(current_user.id),
        "expires_at": expires_at.isoformat(),
    }

    _set_share(token, payload, ttl_seconds)
    logger.info(f"Created share token {token[:8]}... for dataset {dataset_id}")

    return {
        "token": token,
        "share_url": f"/share/{token}",
        "expires_at": expires_at.isoformat(),
        "ttl_hours": ttl_hours,
    }


@router.get("/share/{token}")
async def get_shared_report(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch a shared analysis report by token — NO auth required (public endpoint).

    Returns the full analysis report including ai_narrative and basic dataset info.
    Returns 404 if token doesn't exist or has expired.
    """
    payload = _get_share(token)
    if payload is None:
        raise HTTPException(status_code=404, detail="Share link not found or expired")

    analysis_id = payload["analysis_id"]
    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if analysis is None:
        raise HTTPException(status_code=404, detail="Analysis not found")

    return {
        "token": token,
        "dataset_name": payload["dataset_name"],
        "expires_at": payload["expires_at"],
        "analysis": {
            "analysis_id": str(analysis.id),
            "version": analysis.version,
            "ai_narrative": analysis.ai_narrative,
            "duration_seconds": analysis.duration_seconds,
            "created_at": analysis.created_at.isoformat(),
            "report": analysis.report,
        },
    }


@router.delete("/datasets/{dataset_id}/share/{token}", status_code=204, response_model=None)
async def revoke_share(
    dataset_id: str,
    token: str,
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke a share token immediately (editor+)."""
    await validate_org_access(org_id, current_user, db, allowed_roles=("admin", "editor"))

    payload = _get_share(token)
    if payload is None:
        raise HTTPException(status_code=404, detail="Share token not found")
    if payload.get("dataset_id") != dataset_id:
        raise HTTPException(status_code=403, detail="Token does not belong to this dataset")

    _delete_share(token)
    logger.info(f"Revoked share token {token[:8]}... for dataset {dataset_id}")


# ── Redis helpers ──────────────────────────────────────────────────────────────

def _share_key(token: str) -> str:
    return f"{SHARE_KEY_PREFIX}{token}"


def _set_share(token: str, payload: dict[str, Any], ttl: int) -> None:
    try:
        cache._client.setex(_share_key(token), ttl, json.dumps(payload))
    except Exception as e:
        logger.error(f"Failed to store share token: {e}")
        raise HTTPException(status_code=500, detail="Failed to create share link")


def _get_share(token: str) -> dict[str, Any] | None:
    try:
        data = cache._client.get(_share_key(token))
        return json.loads(data) if data else None
    except Exception as e:
        logger.error(f"Failed to retrieve share token: {e}")
        return None


def _delete_share(token: str) -> None:
    try:
        cache._client.delete(_share_key(token))
    except Exception as e:
        logger.warning(f"Failed to delete share token: {e}")
