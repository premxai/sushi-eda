"""
Configuration management for sushi-cli.

Config is stored in ~/.sushi/config.json
API key is stored in the system keychain via `keyring`.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import keyring

_CONFIG_DIR = Path.home() / ".sushi"
_CONFIG_FILE = _CONFIG_DIR / "config.json"
_KEYRING_SERVICE = "sushi-cli"
_KEYRING_KEY = "api_key"

DEFAULT_API_URL = "https://api.sushi-eda.com"


def _read_config() -> dict[str, Any]:
    if _CONFIG_FILE.exists():
        try:
            return json.loads(_CONFIG_FILE.read_text())
        except Exception:
            return {}
    return {}


def _write_config(config: dict[str, Any]) -> None:
    _CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    _CONFIG_FILE.write_text(json.dumps(config, indent=2))
    _CONFIG_FILE.chmod(0o600)


def get_api_url() -> str:
    cfg = _read_config()
    return os.environ.get("SUSHI_API_URL") or cfg.get("api_url") or DEFAULT_API_URL


def get_api_key() -> str | None:
    # Env var takes precedence
    if key := os.environ.get("SUSHI_API_KEY"):
        return key
    # Try keychain
    try:
        return keyring.get_password(_KEYRING_SERVICE, _KEYRING_KEY)
    except Exception:
        return None


def get_org_id() -> str:
    cfg = _read_config()
    return os.environ.get("SUSHI_ORG_ID") or cfg.get("org_id") or "default"


def save_config(api_url: str, org_id: str, api_key: str) -> None:
    cfg = _read_config()
    cfg["api_url"] = api_url.rstrip("/")
    cfg["org_id"] = org_id
    _write_config(cfg)
    try:
        keyring.set_password(_KEYRING_SERVICE, _KEYRING_KEY, api_key)
    except Exception:
        # Fallback: store in config file (less secure)
        cfg["api_key"] = api_key
        _write_config(cfg)


def clear_config() -> None:
    if _CONFIG_FILE.exists():
        _CONFIG_FILE.unlink()
    try:
        keyring.delete_password(_KEYRING_SERVICE, _KEYRING_KEY)
    except Exception:
        pass
