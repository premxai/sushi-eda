"""
Thin httpx client for the Sushi REST API.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import httpx

from sushi_cli.config import get_api_key, get_api_url, get_org_id

_TIMEOUT = 30.0
_UPLOAD_TIMEOUT = 300.0   # large files can take a while


def _headers() -> dict[str, str]:
    key = get_api_key()
    if not key:
        raise RuntimeError(
            "Not authenticated. Run `sushi login` first or set SUSHI_API_KEY."
        )
    return {"Authorization": f"Bearer {key}"}


def _client() -> httpx.Client:
    return httpx.Client(
        base_url=get_api_url(),
        headers=_headers(),
        timeout=_TIMEOUT,
        follow_redirects=True,
    )


def health() -> dict[str, Any]:
    with _client() as c:
        return c.get("/health").raise_for_status().json()


# ── Datasets ──────────────────────────────────────────────────────────────────

def list_datasets(org_id: str | None = None) -> list[dict[str, Any]]:
    oid = org_id or get_org_id()
    with _client() as c:
        return c.get(f"/datasets?org_id={oid}").raise_for_status().json()["datasets"]


def upload_dataset(file_path: Path, name: str | None = None, org_id: str | None = None) -> dict[str, Any]:
    oid = org_id or get_org_id()
    display_name = name or file_path.name
    with httpx.Client(base_url=get_api_url(), headers=_headers(), timeout=_UPLOAD_TIMEOUT, follow_redirects=True) as c:
        with file_path.open("rb") as f:
            resp = c.post(
                f"/datasets/upload?org_id={oid}",
                files={"file": (display_name, f)},
            ).raise_for_status()
    return resp.json()


def get_job_status(dataset_id: str) -> dict[str, Any]:
    with _client() as c:
        return c.get(f"/jobs/{dataset_id}").raise_for_status().json()


def get_latest_analysis(dataset_id: str, org_id: str | None = None) -> dict[str, Any]:
    oid = org_id or get_org_id()
    with _client() as c:
        return c.get(f"/datasets/{dataset_id}/analysis?org_id={oid}").raise_for_status().json()


def delete_dataset(dataset_id: str, org_id: str | None = None) -> None:
    oid = org_id or get_org_id()
    with _client() as c:
        c.delete(f"/datasets/{dataset_id}?org_id={oid}").raise_for_status()


# ── Credits ───────────────────────────────────────────────────────────────────

def get_credit_status(org_id: str | None = None) -> dict[str, Any]:
    oid = org_id or get_org_id()
    with _client() as c:
        return c.get(f"/orgs/{oid}/credits").raise_for_status().json()


# ── Connectors ────────────────────────────────────────────────────────────────

def list_connectors(org_id: str | None = None) -> list[dict[str, Any]]:
    oid = org_id or get_org_id()
    with _client() as c:
        return c.get(f"/connectors?org_id={oid}").raise_for_status().json()["connectors"]
