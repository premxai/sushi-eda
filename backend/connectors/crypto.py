"""
Fernet-based symmetric encryption for connector credentials.

The encryption key is derived from CONNECTOR_SECRET_KEY env var.
If unset, a deterministic dev key is used (NOT safe for production).
"""
from __future__ import annotations

import base64
import json
import os
from typing import Any

from cryptography.fernet import Fernet
from loguru import logger

_RAW_KEY = os.getenv("CONNECTOR_SECRET_KEY", "")


def _get_fernet() -> Fernet:
    if _RAW_KEY:
        # Env var must be a 32-byte URL-safe base64 string (generate with Fernet.generate_key())
        key = _RAW_KEY.encode() if isinstance(_RAW_KEY, str) else _RAW_KEY
        # Pad/truncate to 32 bytes then re-encode as urlsafe base64
        key_bytes = key[:32].ljust(32, b"0")
        b64_key = base64.urlsafe_b64encode(key_bytes)
    else:
        logger.warning("CONNECTOR_SECRET_KEY not set — using insecure dev key")
        # Deterministic dev key — never use in production
        b64_key = base64.urlsafe_b64encode(b"dev-key-do-not-use-in-production!!")
    return Fernet(b64_key)


def encrypt_config(config: dict[str, Any]) -> str:
    """Serialize and encrypt a config dict. Returns a str token."""
    f = _get_fernet()
    plaintext = json.dumps(config).encode()
    return f.encrypt(plaintext).decode()


def decrypt_config(token: str) -> dict[str, Any]:
    """Decrypt and deserialize a config token back to a dict."""
    f = _get_fernet()
    plaintext = f.decrypt(token.encode())
    return json.loads(plaintext)
