"""Supabase JWT authentication for the Sushi API.

When Supabase credentials are absent, local development remains in its explicit
demo mode. Production must set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.
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

import defaults
from db import get_db
from db.models import OrgMember, User

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
SUPABASE_JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json" if SUPABASE_URL else ""
SUPABASE_ISSUER = f"{SUPABASE_URL}/auth/v1" if SUPABASE_URL else ""

AUTH_ENABLED = bool(SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY)
if not AUTH_ENABLED:
    logger.warning("Supabase auth is not configured — running in local demo mode. Do not expose this publicly.")

bearer_scheme = HTTPBearer(auto_error=False)


async def _get_demo_user(db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.clerk_id == "system"))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(clerk_id="system", email="system@localhost")
        db.add(user)
        await db.flush()
    return user


@lru_cache(maxsize=1)
def _get_jwks() -> dict:
    """Retrieve Supabase public signing keys. Supabase caches this endpoint."""
    if not SUPABASE_JWKS_URL:
        return {"keys": []}
    response = httpx.get(SUPABASE_JWKS_URL, timeout=10)
    response.raise_for_status()
    return response.json()


def _get_user_from_auth_server(token: str) -> dict:
    """HS256-compatible fallback for projects that do not expose JWKS keys."""
    response = httpx.get(
        f"{SUPABASE_URL}/auth/v1/user",
        headers={"apikey": SUPABASE_PUBLISHABLE_KEY, "Authorization": f"Bearer {token}"},
        timeout=10,
    )
    if response.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user = response.json()
    return {
        "sub": user.get("id"),
        "email": user.get("email"),
        "user_metadata": user.get("user_metadata") or {},
    }


def _decode_supabase_token(token: str) -> dict:
    """Verify a Supabase-issued bearer token and return its claims."""
    try:
        header = jwt.get_unverified_header(token)
        algorithm = header.get("alg", "")
        jwks = _get_jwks()
        key = next((item for item in jwks.get("keys", []) if item.get("kid") == header.get("kid")), None)
        if key and algorithm.startswith(("RS", "ES", "EdDSA")):
            return jwt.decode(
                token,
                key,
                algorithms=[algorithm],
                issuer=SUPABASE_ISSUER,
                options={"verify_aud": False},
            )
        # Legacy shared-secret Supabase projects do not return JWKS keys.
        return _get_user_from_auth_server(token)
    except HTTPException:
        raise
    except (JWTError, httpx.HTTPError, ValueError) as exc:
        logger.warning(f"Supabase token verification failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: AsyncSession = Depends(get_db),
) -> User:
    if not AUTH_ENABLED:
        return await _get_demo_user(db)
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated", headers={"WWW-Authenticate": "Bearer"})

    payload = _decode_supabase_token(credentials.credentials)
    auth_user_id = payload.get("sub")
    if not auth_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token: missing subject")

    result = await db.execute(select(User).where(User.clerk_id == auth_user_id))
    user = result.scalar_one_or_none()
    if user is None:
        metadata = payload.get("user_metadata") or {}
        user = User(
            clerk_id=auth_user_id,  # Existing DB column retained for backwards compatibility.
            email=payload.get("email") or "",
            name=metadata.get("full_name") or metadata.get("name"),
            avatar_url=metadata.get("avatar_url"),
        )
        db.add(user)
        await db.flush()
        logger.info(f"Provisioned Supabase user: {user.email}")
    return user


async def get_optional_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: AsyncSession = Depends(get_db),
) -> User | None:
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
    if org_id == "default" or (defaults.DEFAULT_ORG_ID and org_id == defaults.DEFAULT_ORG_ID):
        return None
    query = select(OrgMember).where(OrgMember.org_id == org_id, OrgMember.user_id == current_user.id)
    if allowed_roles:
        query = query.where(OrgMember.role.in_(allowed_roles))
    member = (await db.execute(query)).scalar_one_or_none()
    if member is None:
        detail = f"Requires one of roles: {', '.join(allowed_roles)}" if allowed_roles else "Not a member of this organization"
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)
    return member


def require_role(*allowed_roles: str):
    async def _check_role(
        org_id: str,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> None:
        await validate_org_access(org_id, current_user, db, allowed_roles=allowed_roles)
    return _check_role
