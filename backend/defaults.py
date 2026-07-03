"""
Runtime defaults for single-tenant / dev mode.

DEFAULT_ORG_ID and DEFAULT_USER_ID are string UUIDs populated at startup
by main.py's _ensure_default_org() event.  Routers import resolve_org_id()
to translate the literal string "default" into the actual DB UUID.
"""

DEFAULT_ORG_ID: str | None = None
DEFAULT_USER_ID: str | None = None

# Pre-analyzed example dataset seeded at startup (instant "try an example")
EXAMPLE_DATASET_ID: str | None = None


def resolve_org_id(org_id: str) -> str:
    """Translate 'default' → actual default-org UUID; pass others through."""
    if org_id == "default" and DEFAULT_ORG_ID:
        return DEFAULT_ORG_ID
    return org_id
