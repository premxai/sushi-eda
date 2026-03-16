"""
Fernet-based symmetric encryption for connector credentials.

The encryption key is read from the CONNECTOR_SECRET_KEY env var.

Production usage
----------------
Generate a key once and store it in your secrets manager::

    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

Then set::

    CONNECTOR_SECRET_KEY=<that 44-character base64 string>

If the env var is unset, a deterministic dev key is used (NOT safe for
production).  Set ENVIRONMENT=production to make an unset key a hard error.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
from typing import Any

from cryptography.fernet import Fernet
from loguru import logger

_RAW_KEY = os.getenv("CONNECTOR_SECRET_KEY", "")
_ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# 32 bytes exactly — deterministic, insecure, dev-only
_DEV_KEY_BYTES = b"sushi-dev-key!insecure!00000000"  # exactly 32 bytes

_fernet_instance: Fernet | None = None


def _derive_fernet_key(raw: str) -> bytes:
    """
    Turn an arbitrary string into a valid 44-char URL-safe-base64 Fernet key.

    If *raw* already looks like a properly generated Fernet key (44 chars of
    URL-safe base64 encoding 32 bytes), it is used as-is.  Otherwise we
    SHA-256 hash the input to get exactly 32 bytes, then base64-encode that.
    """
    raw_bytes = raw.encode("utf-8") if isinstance(raw, str) else raw

    # A Fernet.generate_key() output is always 44 URL-safe-base64 characters.
    # Try using the value directly first.
    if len(raw_bytes) == 44:
        try:
            decoded = base64.urlsafe_b64decode(raw_bytes)
            if len(decoded) == 32:
                # It's already a valid Fernet key — use as-is.
                return raw_bytes
        except Exception:
            pass

    # Fall back: derive 32 bytes via SHA-256, then base64-encode.
    logger.warning(
        "CONNECTOR_SECRET_KEY does not look like a Fernet key — "
        "deriving key via SHA-256. Consider using: "
        'python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
    )
    key_bytes = hashlib.sha256(raw_bytes).digest()  # always 32 bytes
    return base64.urlsafe_b64encode(key_bytes)


def _get_fernet() -> Fernet:
    """Return a cached Fernet instance, creating it on first call."""
    global _fernet_instance
    if _fernet_instance is not None:
        return _fernet_instance

    if _RAW_KEY:
        b64_key = _derive_fernet_key(_RAW_KEY)
    else:
        if _ENVIRONMENT == "production":
            raise RuntimeError(
                "CONNECTOR_SECRET_KEY is required in production. "
                "Generate one with: python -c "
                '"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
            )
        logger.warning(
            "CONNECTOR_SECRET_KEY not set — using insecure dev key. "
            "Do NOT use this in production."
        )
        b64_key = base64.urlsafe_b64encode(_DEV_KEY_BYTES)

    _fernet_instance = Fernet(b64_key)
    return _fernet_instance


def encrypt_config(config: dict[str, Any]) -> str:
    """Serialize and encrypt a config dict.  Returns a str token."""
    f = _get_fernet()
    plaintext = json.dumps(config).encode("utf-8")
    return f.encrypt(plaintext).decode("utf-8")


def decrypt_config(token: str) -> dict[str, Any]:
    """Decrypt and deserialize a config token back to a dict."""
    f = _get_fernet()
    plaintext = f.decrypt(token.encode("utf-8"))
    return json.loads(plaintext)
