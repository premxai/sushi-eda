"""
Enterprise admin endpoints — org-scoped, admin-role required.

Routes
------
  GET    /orgs/{org_id}/audit-logs          — paginated audit trail (admin)
  GET    /orgs/{org_id}/members             — list members with roles (admin)
  PATCH  /orgs/{org_id}/members/{user_id}   — change member role (admin)
  DELETE /orgs/{org_id}/members/{user_id}   — remove member (admin)
  POST   /orgs/{org_id}/audit-logs          — write an audit event (internal)
"""

from __future__ import annotations

import os
import uuid
from typing import Any

from auth import get_current_user, validate_org_access
from db import get_db
from db.models import AuditLog, OrgMember, User
from defaults import resolve_org_id
from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["admin"])

DEV_ORG = os.getenv("DEV_ORG", "") if os.getenv("ENVIRONMENT") == "development" else ""


def _org_uuid(org_id: str) -> uuid.UUID:
    result = resolve_org_id(org_id)
    return result if isinstance(result, uuid.UUID) else uuid.UUID(result)


def _audit_dict(a: AuditLog) -> dict[str, Any]:
    return {
        "log_id": str(a.id),
        "action": a.action,
        "resource_type": a.resource_type,
        "resource_id": str(a.resource_id) if a.resource_id else None,
        "user_id": str(a.user_id) if a.user_id else None,
        "ip_address": a.ip_address,
        "extra": a.extra,
        "created_at": a.created_at.isoformat(),
    }


def _member_dict(m: OrgMember) -> dict[str, Any]:
    u = m.user
    return {
        "member_id": str(m.id),
        "user_id": str(m.user_id),
        "email": u.email if u else None,
        "name": u.name if u else None,
        "avatar_url": u.avatar_url if u else None,
        "role": m.role,
        "joined_at": m.created_at.isoformat(),
    }


# ─── Audit Log ────────────────────────────────────────────────────────────────


@router.get("/orgs/{org_id}/audit-logs")
async def list_audit_logs(
    org_id: str,
    action: str | None = Query(None),
    resource_type: str | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    current_user: User | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if org_id != DEV_ORG:
        await validate_org_access(org_id, current_user, db, allowed_roles=("admin",))
        org_uuid = _org_uuid(org_id)
    else:
        org_uuid = None  # dev: return all

    stmt = select(AuditLog)
    if org_uuid:
        stmt = stmt.where(AuditLog.org_id == org_uuid)
    if action:
        stmt = stmt.where(AuditLog.action == action)
    if resource_type:
        stmt = stmt.where(AuditLog.resource_type == resource_type)

    stmt = stmt.order_by(desc(AuditLog.created_at)).offset(offset).limit(limit)
    result = await db.execute(stmt)
    logs = result.scalars().all()
    return {"logs": [_audit_dict(a) for a in logs], "count": len(logs)}


@router.post("/orgs/{org_id}/audit-logs", status_code=201)
async def write_audit_log(
    org_id: str,
    request: Request,
    body: dict = Body(...),
    current_user: User | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if org_id == DEV_ORG:
        # dev: find any org or use a sentinel UUID
        org_uuid = uuid.UUID("00000000-0000-0000-0000-000000000001")
    else:
        await validate_org_access(
            org_id, current_user, db, allowed_roles=("admin", "editor")
        )
        org_uuid = _org_uuid(org_id)

    log = AuditLog(
        org_id=org_uuid,
        user_id=current_user.id if current_user else None,
        action=body.get("action", "unknown"),
        resource_type=body.get("resource_type"),
        resource_id=uuid.UUID(body["resource_id"]) if body.get("resource_id") else None,
        extra=body.get("extra"),
        ip_address=request.client.host if request.client else None,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return _audit_dict(log)


# ─── Member Management ────────────────────────────────────────────────────────


@router.get("/orgs/{org_id}/members")
async def list_members(
    org_id: str,
    current_user: User | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    if org_id != DEV_ORG:
        await validate_org_access(
            org_id, current_user, db, allowed_roles=("admin", "editor", "viewer")
        )
        org_uuid = _org_uuid(org_id)
        stmt = (
            select(OrgMember)
            .where(OrgMember.org_id == org_uuid)
            .order_by(OrgMember.created_at)
        )
    else:
        stmt = select(OrgMember).order_by(OrgMember.created_at).limit(50)

    result = await db.execute(stmt)
    members = result.scalars().all()
    # eager-load users
    out = []
    for m in members:
        if not m.user:
            u_res = await db.execute(select(User).where(User.id == m.user_id))
            m.user = u_res.scalar_one_or_none()
        out.append(_member_dict(m))
    return out


@router.patch("/orgs/{org_id}/members/{user_id}")
async def update_member_role(
    org_id: str,
    user_id: str,
    body: dict = Body(...),
    current_user: User | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if org_id != DEV_ORG:
        await validate_org_access(org_id, current_user, db, allowed_roles=("admin",))
        org_uuid = _org_uuid(org_id)
    else:
        org_uuid = None

    stmt = select(OrgMember).where(OrgMember.user_id == uuid.UUID(user_id))
    if org_uuid:
        stmt = stmt.where(OrgMember.org_id == org_uuid)
    result = await db.execute(stmt)
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    new_role = body.get("role")
    if new_role not in ("viewer", "editor", "admin"):
        raise HTTPException(
            status_code=422, detail="role must be viewer | editor | admin"
        )

    # Guard: prevent last admin from losing admin access
    if member.role == "admin" and new_role != "admin":
        from sqlalchemy import func as sa_func

        admin_count_result = await db.execute(
            select(sa_func.count())
            .select_from(OrgMember)
            .where(
                OrgMember.org_id == (org_uuid or member.org_id),
                OrgMember.role == "admin",
            )
        )
        admin_count = admin_count_result.scalar() or 0
        if admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot remove or demote the last admin of the organization",
            )

    member.role = new_role
    await db.commit()
    await db.refresh(member)
    return _member_dict(member)


@router.delete("/orgs/{org_id}/members/{user_id}", status_code=204, response_model=None)
async def remove_member(
    org_id: str,
    user_id: str,
    current_user: User | None = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    if org_id != DEV_ORG:
        await validate_org_access(org_id, current_user, db, allowed_roles=("admin",))
        org_uuid = _org_uuid(org_id)
    else:
        org_uuid = None

    stmt = select(OrgMember).where(OrgMember.user_id == uuid.UUID(user_id))
    if org_uuid:
        stmt = stmt.where(OrgMember.org_id == org_uuid)
    result = await db.execute(stmt)
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Guard: prevent last admin from losing admin access
    if member.role == "admin":
        from sqlalchemy import func as sa_func

        admin_count_result = await db.execute(
            select(sa_func.count())
            .select_from(OrgMember)
            .where(
                OrgMember.org_id == (org_uuid or member.org_id),
                OrgMember.role == "admin",
            )
        )
        admin_count = admin_count_result.scalar() or 0
        if admin_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Cannot remove or demote the last admin of the organization",
            )

    await db.delete(member)
    await db.commit()
