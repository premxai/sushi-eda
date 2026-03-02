"""
Clerk webhook router — handles user lifecycle events from Clerk.

Clerk sends events (user.created, user.updated, user.deleted,
organizationMembership.created, etc.) to POST /webhooks/clerk.

This keeps our Postgres users table in sync with Clerk automatically.
"""
from fastapi import APIRouter, Header, HTTPException, Request
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from auth import verify_clerk_webhook
from db import get_db
from db.models import Organization, OrgMember, User

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/clerk")
async def clerk_webhook(
    request: Request,
    svix_id: str = Header(..., alias="svix-id"),
    svix_timestamp: str = Header(..., alias="svix-timestamp"),
    svix_signature: str = Header(..., alias="svix-signature"),
    db: AsyncSession = Depends(get_db),
):
    """Handle Clerk webhook events to keep users/orgs in sync."""
    payload = await request.body()
    event = verify_clerk_webhook(payload, svix_id, svix_timestamp, svix_signature)

    event_type = event.get("type")
    data = event.get("data", {})
    logger.info(f"Clerk webhook received: {event_type}")

    # ── user.created ──────────────────────────────────────────────────────────
    if event_type == "user.created":
        clerk_id = data["id"]
        email = (data.get("email_addresses") or [{}])[0].get("email_address", "")
        first = data.get("first_name") or ""
        last = data.get("last_name") or ""
        avatar = data.get("profile_image_url")

        existing = await db.execute(select(User).where(User.clerk_id == clerk_id))
        if existing.scalar_one_or_none() is None:
            user = User(
                clerk_id=clerk_id,
                email=email,
                name=f"{first} {last}".strip() or None,
                avatar_url=avatar,
            )
            db.add(user)
            await db.commit()
            logger.info(f"Created user via webhook: {email}")

    # ── user.updated ──────────────────────────────────────────────────────────
    elif event_type == "user.updated":
        clerk_id = data["id"]
        result = await db.execute(select(User).where(User.clerk_id == clerk_id))
        user = result.scalar_one_or_none()
        if user:
            email = (data.get("email_addresses") or [{}])[0].get("email_address", "")
            first = data.get("first_name") or ""
            last = data.get("last_name") or ""
            user.email = email or user.email
            user.name = f"{first} {last}".strip() or user.name
            user.avatar_url = data.get("profile_image_url") or user.avatar_url
            await db.commit()
            logger.info(f"Updated user via webhook: {user.email}")

    # ── user.deleted ──────────────────────────────────────────────────────────
    elif event_type == "user.deleted":
        clerk_id = data["id"]
        result = await db.execute(select(User).where(User.clerk_id == clerk_id))
        user = result.scalar_one_or_none()
        if user:
            await db.delete(user)
            await db.commit()
            logger.info(f"Deleted user via webhook: clerk_id={clerk_id}")

    # ── organization.created ──────────────────────────────────────────────────
    elif event_type == "organization.created":
        clerk_org_id = data["id"]
        slug = data.get("slug") or clerk_org_id
        name = data.get("name") or slug

        result = await db.execute(select(Organization).where(Organization.slug == clerk_org_id))
        if result.scalar_one_or_none() is None:
            org = Organization(name=name, slug=clerk_org_id)
            db.add(org)
            await db.commit()
            logger.info(f"Created org via webhook: {name} (slug={clerk_org_id})")

    # ── organizationMembership.created ────────────────────────────────────────
    elif event_type == "organizationMembership.created":
        clerk_org_id = data.get("organization", {}).get("id")
        clerk_user_id = data.get("public_user_data", {}).get("user_id")
        role = data.get("role", "viewer")

        org_result = await db.execute(select(Organization).where(Organization.slug == clerk_org_id))
        user_result = await db.execute(select(User).where(User.clerk_id == clerk_user_id))
        org = org_result.scalar_one_or_none()
        user = user_result.scalar_one_or_none()

        if org and user:
            membership = OrgMember(org_id=org.id, user_id=user.id, role=role)
            db.add(membership)
            await db.commit()
            logger.info(f"Created membership: user={clerk_user_id} org={clerk_org_id} role={role}")

    # ── organizationMembership.deleted ────────────────────────────────────────
    elif event_type == "organizationMembership.deleted":
        clerk_org_id = data.get("organization", {}).get("id")
        clerk_user_id = data.get("public_user_data", {}).get("user_id")

        org_result = await db.execute(select(Organization).where(Organization.slug == clerk_org_id))
        user_result = await db.execute(select(User).where(User.clerk_id == clerk_user_id))
        org = org_result.scalar_one_or_none()
        user = user_result.scalar_one_or_none()

        if org and user:
            result = await db.execute(
                select(OrgMember).where(OrgMember.org_id == org.id, OrgMember.user_id == user.id)
            )
            membership = result.scalar_one_or_none()
            if membership:
                await db.delete(membership)
                await db.commit()
                logger.info(f"Deleted membership: user={clerk_user_id} org={clerk_org_id}")

    else:
        logger.debug(f"Unhandled Clerk event type: {event_type}")

    return {"status": "ok"}
