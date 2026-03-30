"""
Runtime defaults for single-tenant / dev mode.

DEFAULT_ORG_ID and DEFAULT_USER_ID are string UUIDs populated at startup
by main.py's _ensure_default_org() event.  Routers import resolve_org_id()
to translate the literal string "default" into the actual DB UUID.
"""
import uuid as _uuid

DEFAULT_ORG_ID: str | None = None
DEFAULT_USER_ID: str | None = None


def resolve_org_id(org_id: str) -> _uuid.UUID | str:
    """Translate 'default' → actual default-org UUID (as uuid.UUID); pass others through."""
    target = DEFAULT_ORG_ID if (org_id == "default" and DEFAULT_ORG_ID) else org_id
    try:
        return _uuid.UUID(target)
    except (ValueError, AttributeError):
        return target


def resolve_dataset_id(dataset_id: str) -> _uuid.UUID | str:
    """Convert a dataset_id string to uuid.UUID for asyncpg compatibility."""
    try:
        return _uuid.UUID(dataset_id)
    except (ValueError, AttributeError):
        return dataset_id
