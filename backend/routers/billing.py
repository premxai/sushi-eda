"""
Stripe billing router.

Routes:
  POST /billing/webhooks          — Stripe webhook handler (unsigned)
  POST /billing/create-checkout   — create Stripe Checkout Session
  POST /billing/create-portal     — create Billing Portal session
  GET  /billing/plans             — list available plans with pricing
"""

from __future__ import annotations

import os
import uuid
from typing import Any

import stripe
from auth import get_current_user, validate_org_access
from db import get_db
from db.models import Organization, User
from defaults import resolve_org_id
from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from loguru import logger
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

# ── Stripe config ─────────────────────────────────────────────────────────────

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRO_PRICE_ID = os.getenv("STRIPE_PRO_PRICE_ID", "")
STRIPE_TEAM_PRICE_ID = os.getenv("STRIPE_TEAM_PRICE_ID", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

router = APIRouter(prefix="/billing", tags=["billing"])

# ── Plan definitions ───────────────────────────────────────────────────────────

PLANS = {
    "free": {
        "name": "Free",
        "price_usd": 0,
        "ai_credits": 100,
        "datasets": 5,
        "members": 1,
        "features": ["Basic EDA", "CSV / Excel upload", "5 datasets"],
    },
    "pro": {
        "name": "Pro",
        "price_usd": 29,
        "stripe_price_id": STRIPE_PRO_PRICE_ID,
        "ai_credits": 2000,
        "datasets": 100,
        "members": 5,
        "features": [
            "Everything in Free",
            "AI narratives & chat",
            "DuckDB SQL queries",
            "100 datasets",
            "5 team members",
            "Excel & Markdown export",
        ],
    },
    "team": {
        "name": "Team",
        "price_usd": 99,
        "stripe_price_id": STRIPE_TEAM_PRICE_ID,
        "ai_credits": -1,  # unlimited
        "datasets": -1,
        "members": -1,
        "features": [
            "Everything in Pro",
            "Unlimited AI credits",
            "Unlimited datasets",
            "Unlimited members",
            "SSO / SAML (coming soon)",
            "Priority support",
        ],
    },
}

_PLAN_CREDIT_LIMITS = {"free": 100, "pro": 2000, "team": -1}


def _resolved_org_id(org_id: str) -> uuid.UUID:
    result = resolve_org_id(org_id)
    return result if isinstance(result, uuid.UUID) else uuid.UUID(result)


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/plans")
async def list_plans():
    """Return available subscription plans (public)."""
    return {"plans": PLANS}


@router.post("/create-checkout")
async def create_checkout_session(
    org_id: str = Query(...),
    plan: str = Body(..., embed=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a Stripe Checkout Session for upgrading an org's plan.
    Redirects to Stripe-hosted checkout page.
    """
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    await validate_org_access(org_id, current_user, db, allowed_roles=("admin",))
    resolved_org_id = _resolved_org_id(org_id)

    plan_data = PLANS.get(plan)
    if not plan_data or plan == "free":
        raise HTTPException(status_code=400, detail=f"Invalid plan: {plan}")

    price_id = plan_data.get("stripe_price_id", "")
    if not price_id:
        raise HTTPException(
            status_code=503, detail=f"Stripe price ID not configured for {plan}"
        )

    # Get or create Stripe customer for this org
    org = await _get_org(org_id, db)
    customer_id = org.stripe_customer_id if org else None

    if not customer_id:
        customer = stripe.Customer.create(
            email=current_user.email,
            metadata={"org_id": resolved_org_id, "user_id": str(current_user.id)},
        )
        customer_id = customer.id
        if org:
            await db.execute(
                update(Organization)
                .where(Organization.id == resolved_org_id)
                .values(stripe_customer_id=customer_id)
            )
            await db.commit()

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=f"{FRONTEND_URL}/settings/billing?success=1&org={resolved_org_id}",
        cancel_url=f"{FRONTEND_URL}/settings/billing?cancel=1",
        metadata={"org_id": resolved_org_id, "plan": plan},
        subscription_data={"metadata": {"org_id": resolved_org_id, "plan": plan}},
    )
    return {"checkout_url": session.url, "session_id": session.id}


@router.post("/create-portal")
async def create_billing_portal(
    org_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe Billing Portal session (manage subscription, invoices, payment)."""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    await validate_org_access(org_id, current_user, db, allowed_roles=("admin",))
    resolved_org_id = _resolved_org_id(org_id)

    org = await _get_org(resolved_org_id, db)
    if not org or not org.stripe_customer_id:
        raise HTTPException(
            status_code=404, detail="No billing account found for this org"
        )

    session = stripe.billing_portal.Session.create(
        customer=org.stripe_customer_id,
        return_url=f"{FRONTEND_URL}/settings/billing?org={resolved_org_id}",
    )
    return {"portal_url": session.url}


@router.post("/webhooks")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Receive and process Stripe webhook events.
    Verifies the Stripe-Signature header and handles:
      - checkout.session.completed  → activate plan
      - customer.subscription.updated → update plan
      - customer.subscription.deleted → downgrade to free
      - invoice.payment_failed → mark payment failure
    """
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    if STRIPE_WEBHOOK_SECRET:
        try:
            event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
        except Exception as exc:
            # Modern stripe SDK uses stripe.SignatureVerificationError;
            # older versions use stripe.error.SignatureVerificationError.
            _modern = getattr(stripe, "SignatureVerificationError", None)
            _legacy = getattr(
                getattr(stripe, "error", None), "SignatureVerificationError", None
            )
            if (_modern and isinstance(exc, _modern)) or (
                _legacy and isinstance(exc, _legacy)
            ):
                raise HTTPException(status_code=400, detail="Invalid Stripe signature")
            raise  # re-raise unexpected errors
    else:
        if os.getenv("ENVIRONMENT") == "production":
            raise HTTPException(
                status_code=500, detail="Stripe webhook secret not configured"
            )
        # Dev mode: skip signature verification
        import json

        logger.warning(
            "STRIPE_WEBHOOK_SECRET not set — skipping signature verification"
        )
        event = json.loads(payload)

    event_type = event.get("type", "")
    data = event.get("data", {}).get("object", {})

    logger.info(f"Stripe webhook: {event_type}")

    if event_type == "checkout.session.completed":
        org_id = data.get("metadata", {}).get("org_id")
        plan = data.get("metadata", {}).get("plan", "pro")
        customer_id = data.get("customer")
        if org_id:
            await _activate_plan(org_id, plan, customer_id, db)

    elif event_type in (
        "customer.subscription.updated",
        "customer.subscription.created",
    ):
        sub = data
        customer_id = sub.get("customer")
        plan = _plan_from_subscription(sub)
        org_id = sub.get("metadata", {}).get("org_id")
        if org_id and plan:
            await _activate_plan(org_id, plan, customer_id, db)

    elif event_type == "customer.subscription.deleted":
        customer_id = data.get("customer")
        org_id = data.get("metadata", {}).get("org_id")
        if org_id:
            await _activate_plan(org_id, "free", customer_id, db)

    elif event_type == "invoice.payment_failed":
        customer_id = data.get("customer")
        logger.warning(f"Payment failed for customer {customer_id}")
        # Could mark org as past-due here

    return JSONResponse({"received": True})


# ── Private helpers ────────────────────────────────────────────────────────────


async def _get_org(org_id: str, db: AsyncSession) -> Organization | None:
    result = await db.execute(
        select(Organization).where(Organization.id == _resolved_org_id(org_id))
    )
    return result.scalar_one_or_none()


async def _activate_plan(
    org_id: str, plan: str, customer_id: str | None, db: AsyncSession
) -> None:
    """Update org.plan and reset/set ai_credits_limit accordingly."""
    credit_limit = _PLAN_CREDIT_LIMITS.get(plan, 100)

    # Fetch current org to check if plan is actually changing
    resolved_org_id = _resolved_org_id(org_id)
    result = await db.execute(
        select(Organization).where(Organization.id == resolved_org_id)
    )
    org = result.scalar_one_or_none()

    values: dict[str, Any] = {
        "plan": plan,
        "ai_credits_limit": credit_limit,
    }
    if customer_id:
        values["stripe_customer_id"] = customer_id

    # Only reset credits on actual plan change
    if org is None or org.plan != plan:
        values["ai_credits_used"] = 0

    await db.execute(
        update(Organization)
        .where(Organization.id == resolved_org_id)
        .values(**values)
    )
    await db.commit()
    logger.info(
        f"Activated plan '{plan}' for org {resolved_org_id} (credits_limit={credit_limit})"
    )


def _plan_from_subscription(sub: dict) -> str | None:
    """Map Stripe subscription price IDs to plan names."""
    items = sub.get("items", {}).get("data", [])
    for item in items:
        price_id = item.get("price", {}).get("id", "")
        if price_id == STRIPE_PRO_PRICE_ID:
            return "pro"
        if price_id == STRIPE_TEAM_PRICE_ID:
            return "team"
    return None
