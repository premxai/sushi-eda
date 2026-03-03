"""
AI credit metering and enforcement.

Each AI operation costs a fixed number of credits (tokens-equivalent).
Credits are tracked per organisation in the database (ai_credits_used)
and compared against the plan limit (ai_credits_limit).

Credit costs (approximate, tuned for Haiku pricing):
  - Narrative generation: 5 credits
  - Cleaning suggestions: 3 credits
  - Chat message (non-streaming): 2 credits
  - Chat message (streaming): 2 credits

Plan limits (configured per org):
  - Free:  100 credits / month (reset on billing cycle)
  - Pro:   2 000 credits / month
  - Team:  unlimited (-1)

Usage:
    from ai_credits import consume_credits, check_credits
    await check_credits(org_id, cost=5, db=db)   # raises 402 if over limit
    await consume_credits(org_id, cost=5, db=db) # deducts credits
"""
from __future__ import annotations

import os
from typing import TYPE_CHECKING

from fastapi import HTTPException, status
from loguru import logger
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

if TYPE_CHECKING:
    pass

# Credit cost table
CREDIT_COSTS = {
    "narrative": 5,
    "cleaning_suggestions": 3,
    "chat": 2,
    "column_explain": 1,
}

UNLIMITED = -1


async def check_credits(org_id: str, cost: int, db: AsyncSession) -> None:
    """
    Raise HTTP 402 if the org has insufficient AI credits.
    Silently passes if org_id == "default" (dev mode, no limit enforced).
    """
    if org_id == "default":
        return  # dev bypass

    from db.models import Organization
    result = await db.execute(
        select(Organization.ai_credits_used, Organization.ai_credits_limit)
        .where(Organization.id == org_id)
    )
    row = result.one_or_none()
    if row is None:
        return  # org not found — let through, will fail at DB constraint later

    used, limit = row
    if limit == UNLIMITED or limit is None:
        return
    if (used or 0) + cost > limit:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "error": "ai_credits_exhausted",
                "message": f"AI credits exhausted ({used}/{limit}). Upgrade your plan.",
                "credits_used": used,
                "credits_limit": limit,
            },
        )


async def consume_credits(org_id: str, cost: int, db: AsyncSession) -> None:
    """
    Deduct `cost` credits from the org's ai_credits_used counter.
    Silently no-ops for dev mode or DB errors.
    """
    if org_id == "default":
        return

    try:
        from db.models import Organization
        await db.execute(
            update(Organization)
            .where(Organization.id == org_id)
            .values(ai_credits_used=Organization.ai_credits_used + cost)
        )
        await db.commit()
        logger.debug(f"Consumed {cost} AI credits for org {org_id}")
    except Exception as e:
        logger.warning(f"Failed to consume credits for org {org_id}: {e}")


async def get_credit_status(org_id: str, db: AsyncSession) -> dict:
    """Return credit usage stats for an org."""
    if org_id == "default":
        return {"credits_used": 0, "credits_limit": UNLIMITED, "credits_remaining": UNLIMITED}

    from db.models import Organization
    result = await db.execute(
        select(Organization.ai_credits_used, Organization.ai_credits_limit, Organization.plan)
        .where(Organization.id == org_id)
    )
    row = result.one_or_none()
    if row is None:
        return {"credits_used": 0, "credits_limit": 100, "credits_remaining": 100}

    used, limit, plan = row
    used = used or 0
    limit = limit if limit is not None else 100
    remaining = UNLIMITED if limit == UNLIMITED else max(0, limit - used)
    return {
        "plan": plan,
        "credits_used": used,
        "credits_limit": limit,
        "credits_remaining": remaining,
        "percent_used": round(used / limit * 100, 1) if limit > 0 else 0,
    }
