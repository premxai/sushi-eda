"""
Dataset comment endpoints — org-scoped, Clerk-authenticated.

Routes
------
  POST   /datasets/{dataset_id}/comments          — add comment (viewer+)
  GET    /datasets/{dataset_id}/comments          — list comments (viewer+)
  PATCH  /comments/{comment_id}                   — edit own comment (viewer+)
  DELETE /comments/{comment_id}                   — delete own/any comment (editor+ or own)
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from auth import get_current_user, validate_org_access
from db import get_db
from db.models import Dataset, DatasetComment, User
from defaults import resolve_org_id
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["comments"])

DEV_ORG = "default"


def _parse_uuid(value: str, field_name: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid {field_name}") from exc


def _effective_org_uuid(org_id: str) -> uuid.UUID:
    return _parse_uuid(resolve_org_id(org_id), "org_id")


def _comment_dict(c: DatasetComment) -> dict[str, Any]:
    return {
        "comment_id": str(c.id),
        "dataset_id": str(c.dataset_id),
        "parent_id": str(c.parent_id) if c.parent_id else None,
        "column_name": c.column_name,
        "author_name": c.author_name or "Anonymous",
        "content": c.content,
        "created_at": c.created_at.isoformat(),
        "edited_at": c.edited_at.isoformat() if c.edited_at else None,
        "user_id": str(c.user_id) if c.user_id else None,
    }


async def _get_dataset_or_404(
    dataset_id: str, org_id: str, db: AsyncSession
) -> Dataset:
    effective_org_id = _effective_org_uuid(org_id)
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == _parse_uuid(dataset_id, "dataset_id"),
            Dataset.org_id == effective_org_id,
        )
    )
    ds = result.scalar_one_or_none()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return ds


async def _get_comment_or_404(
    comment_id: str, org_id: str, db: AsyncSession
) -> DatasetComment:
    effective_org_id = _effective_org_uuid(org_id)
    result = await db.execute(
        select(DatasetComment).where(
            DatasetComment.id == _parse_uuid(comment_id, "comment_id"),
            DatasetComment.org_id == effective_org_id,
        )
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    return comment


# ─── Create ───────────────────────────────────────────────────────────────────


@router.post("/datasets/{dataset_id}/comments", status_code=201)
async def create_comment(
    dataset_id: str,
    org_id: str = Query(DEV_ORG),
    body: dict = Body(...),
    current_user: User | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if org_id != DEV_ORG:
        await validate_org_access(
            org_id, current_user, db, allowed_roles=("viewer", "editor", "admin")
        )

    content = (body.get("content") or "").strip()
    if not content:
        raise HTTPException(status_code=422, detail="content is required")
    dataset = await _get_dataset_or_404(dataset_id, org_id, db)
    parent_id = body.get("parent_id")
    if parent_id:
        parent = await _get_comment_or_404(parent_id, org_id, db)
        if parent.dataset_id != dataset.id:
            raise HTTPException(
                status_code=400, detail="Reply must belong to the same dataset"
            )
    author_name = (body.get("author_name") or "").strip()
    if not author_name and current_user and current_user.name:
        author_name = current_user.name

    comment = DatasetComment(
        dataset_id=dataset.id,
        org_id=dataset.org_id,
        user_id=current_user.id if current_user else None,
        parent_id=_parse_uuid(parent_id, "parent_id") if parent_id else None,
        column_name=body.get("column_name") or None,
        author_name=author_name or "Anonymous",
        content=content,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    payload = _comment_dict(comment)
    payload["replies"] = []
    return payload


# ─── List ─────────────────────────────────────────────────────────────────────


@router.get("/datasets/{dataset_id}/comments")
async def list_comments(
    dataset_id: str,
    org_id: str = Query(DEV_ORG),
    column_name: str | None = Query(None),
    current_user: User | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    if org_id != DEV_ORG:
        await validate_org_access(
            org_id, current_user, db, allowed_roles=("viewer", "editor", "admin")
        )
    dataset = await _get_dataset_or_404(dataset_id, org_id, db)

    all_result = await db.execute(
        select(DatasetComment)
        .where(
            DatasetComment.dataset_id == dataset.id,
            DatasetComment.org_id == dataset.org_id,
        )
        .order_by(DatasetComment.created_at)
    )
    all_comments = all_result.scalars().all()

    # Separate into top-level and replies
    top_level = [c for c in all_comments if c.parent_id is None]
    if column_name:
        top_level = [c for c in top_level if c.column_name == column_name]

    # Build reply map
    reply_map: dict[str, list] = {}
    for c in all_comments:
        if c.parent_id:
            reply_map.setdefault(str(c.parent_id), []).append(_comment_dict(c))

    output = []
    for c in top_level:
        d = _comment_dict(c)
        d["replies"] = reply_map.get(str(c.id), [])
        output.append(d)
    return output


# ─── Edit ─────────────────────────────────────────────────────────────────────


@router.patch("/comments/{comment_id}")
async def edit_comment(
    comment_id: str,
    org_id: str = Query(DEV_ORG),
    body: dict = Body(...),
    current_user: User | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if org_id != DEV_ORG:
        await validate_org_access(
            org_id, current_user, db, allowed_roles=("viewer", "editor", "admin")
        )
    comment = await _get_comment_or_404(comment_id, org_id, db)
    is_author = current_user is not None and comment.user_id == current_user.id
    if not is_author:
        if org_id == DEV_ORG:
            raise HTTPException(
                status_code=403,
                detail="Only the original author can edit this comment",
            )
        await validate_org_access(
            org_id, current_user, db, allowed_roles=("editor", "admin")
        )

    content = (body.get("content") or "").strip()
    if not content:
        raise HTTPException(status_code=422, detail="content is required")

    comment.content = content
    comment.edited_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(comment)
    return _comment_dict(comment)


# ─── Delete ───────────────────────────────────────────────────────────────────


@router.delete("/comments/{comment_id}", status_code=204, response_model=None)
async def delete_comment(
    comment_id: str,
    org_id: str = Query(DEV_ORG),
    current_user: User | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    if org_id != DEV_ORG:
        await validate_org_access(
            org_id, current_user, db, allowed_roles=("viewer", "editor", "admin")
        )
    comment = await _get_comment_or_404(comment_id, org_id, db)
    is_author = current_user is not None and comment.user_id == current_user.id
    if not is_author:
        if org_id == DEV_ORG:
            raise HTTPException(
                status_code=403,
                detail="Only the original author can delete this comment",
            )
        await validate_org_access(
            org_id, current_user, db, allowed_roles=("editor", "admin")
        )

    await db.delete(comment)
    await db.commit()
