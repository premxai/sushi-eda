"""
Clerk JWT authentication middleware for FastAPI.

Every protected endpoint calls `get_current_user` as a dependency.
It verifies the Bearer token issued by Clerk, extracts the user's
clerk_id, then returns (or auto-creates) the matching User row in Postgres.

Usage:
    from auth import get_current_user, require_role
    from db import AsyncSession

    @app.get("/my-endpoint")
    async def my_endpoint(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        ...
"""
import os
from functools import lru_cache
from typing import Annotated

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db
from db.models import OrgMember, User

# ── Config ────────────────────────────────────────────────────────────────────

CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY", "")
CLERK_JWKS_URL = "https://api.clerk.com/v1/jwks"

# When no Clerk secret is configured the API runs in open demo mode: every
# request is treated as the shared "system" demo user instead of requiring a
# Clerk JWT. Set CLERK_SECRET_KEY to enable real authentication.
AUTH_ENABLED = bool(CLERK_SECRET_KEY)
if not AUTH_ENABLED:
    logger.warning(
        "CLERK_SECRET_KEY not set — running in OPEN demo mode; "
        "all requests act as a shared demo user. Do not expose this publicly."
    )

bearer_scheme = HTTPBearer(auto_error=False)


async def _get_demo_user(db: AsyncSession) -> User:
    """Return the shared 'system' user used when auth is disabled."""
    result = await db.execute(select(User).where(User.clerk_id == "system"))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(clerk_id="system", email="system@localhost")
        db.add(user)
        await db.flush()
        logger.info("JIT provisioned demo user (clerk_id=system)")
    return user


# ── JWKS key fetching ─────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _get_jwks() -> dict:
    """Fetch Clerk's public JWKS keys (cached in-process)."""
    resp = httpx.get(CLERK_JWKS_URL, headers={"Authorization": f"Bearer {CLERK_SECRET_KEY}"})
    resp.raise_for_status()
    return resp.json()


def _decode_clerk_token(token: str) -> dict:
    """Decode and verify a Clerk-issued JWT, returning the payload."""
    try:
        # Get JWKS to find the correct key
        jwks = _get_jwks()
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")

        # Find matching key
        rsa_key = {}
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"],
                }
                break

        if not rsa_key:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token: key not found")

        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            options={"verify_aud": False},  # Clerk doesn't always set aud
        )
        return payload

    except JWTError as e:
        logger.warning(f"JWT decode error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ── FastAPI dependencies ───────────────────────────────────────────────────────

async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    FastAPI dependency — verifies Clerk JWT, returns the User ORM object.
    Auto-creates the User row on first login (just-in-time provisioning).
    """
    if not AUTH_ENABLED:
        return await _get_demo_user(db)

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = _decode_clerk_token(credentials.credentials)
    clerk_id: str = payload.get("sub", "")

    if not clerk_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token: missing sub")

    # Look up user in DB
    result = await db.execute(select(User).where(User.clerk_id == clerk_id))
    user = result.scalar_one_or_none()

    # Just-in-time user creation — first time this Clerk user hits our API
    if user is None:
        email = payload.get("email") or payload.get("email_addresses", [{}])[0].get("email_address", "")
        name = f"{payload.get('first_name', '')} {payload.get('last_name', '')}".strip() or None
        user = User(clerk_id=clerk_id, email=email, name=name)
        db.add(user)
        await db.flush()  # get the id without committing
        logger.info(f"JIT provisioned user: {email} (clerk_id={clerk_id})")

    return user


async def get_optional_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Like get_current_user but returns None instead of 401 (for public endpoints)."""
    if not AUTH_ENABLED:
        return await _get_demo_user(db)
    if credentials is None:
        return None
    try:
        return await get_current_user(credentials, db)
    except HTTPException:
        return None


async def validate_org_access(
    org_id: str,
    current_user: User,
    db: AsyncSession,
    allowed_roles: tuple[str, ...] | None = None,
) -> OrgMember | None:
    """
    Check that `current_user` is a member of `org_id` and (optionally) has
    one of the `allowed_roles`.

    - If `org_id == "default"` (legacy single-org mode), skips membership checks.
    - Returns the OrgMember row on success; raises HTTP 403 on failure.
    """
    if org_id == "default":
        return None  # legacy single-org bypass used by current frontend routes

    query = select(OrgMember).where(
        OrgMember.org_id == org_id,
        OrgMember.user_id == current_user.id,
    )
    if allowed_roles:
        query = query.where(OrgMember.role.in_(allowed_roles))

    result = await db.execute(query)
    member = result.scalar_one_or_none()
    if member is None:
        detail = (
            f"Requires one of roles: {', '.join(allowed_roles)}"
            if allowed_roles
            else "Not a member of this organization"
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)
    return member


def require_role(*allowed_roles: str):
    """
    Dependency factory — checks that the current user has one of the
    specified roles in the given org.

    Usage:
        @app.delete("/datasets/{dataset_id}")
        async def delete_dataset(
            dataset_id: UUID,
            org_id: str = Query(...),
            current_user: User = Depends(get_current_user),
            _: None = Depends(require_role("admin", "editor")),
            db: AsyncSession = Depends(get_db),
        ):
    """
    async def _check_role(
        org_id: str,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> None:
        await validate_org_access(org_id, current_user, db, allowed_roles=allowed_roles)

    return _check_role


# ── Clerk Webhook verification ─────────────────────────────────────────────────

def verify_clerk_webhook(payload: bytes, svix_id: str, svix_timestamp: str, svix_signature: str) -> dict:
    """
    Verify a Clerk webhook using the Svix signature scheme.
    Returns parsed JSON payload if valid, raises HTTPException if not.
    """
    import hmac
    import hashlib
    import base64
    import json

    webhook_secret = os.getenv("CLERK_WEBHOOK_SECRET", "")
    if not webhook_secret:
        raise HTTPException(status_code=500, detail="Webhook secret not configured")

    # Svix signing scheme: HMAC-SHA256 of "{id}.{timestamp}.{body}"
    to_sign = f"{svix_id}.{svix_timestamp}.{payload.decode()}"
    secret_bytes = base64.b64decode(webhook_secret.replace("whsec_", ""))
    expected_sig = base64.b64encode(
        hmac.new(secret_bytes, to_sign.encode(), hashlib.sha256).digest()
    ).decode()

    # svix_signature may contain multiple sigs separated by space
    received_sigs = svix_signature.split(" ")
    valid = any(
        hmac.compare_digest(f"v1,{expected_sig}", sig)
        for sig in received_sigs
    )
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    return json.loads(payload)
