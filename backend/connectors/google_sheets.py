"""
Google Sheets connector (public CSV export mode).

This connector reads a Google Sheet via the standard CSV export endpoint:
  https://docs.google.com/spreadsheets/d/<SHEET_ID>/export?format=csv&gid=<GID>

Supported params:
  - sheet_url (required unless csv_url is provided)
  - gid (optional, defaults to 0)
  - csv_url (optional explicit export URL)
"""
from __future__ import annotations

import re
from typing import Any
from urllib.parse import parse_qs, urlparse

import httpx
import polars as pl
from loguru import logger

from polars_loader import parse_to_polars

_MAX_IMPORT_ROWS = 500_000


def _extract_sheet_id(sheet_url: str) -> str:
    match = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", sheet_url)
    if not match:
        raise ValueError("Invalid Google Sheets URL. Expected /spreadsheets/d/<id> format.")
    return match.group(1)


def _extract_gid(sheet_url: str) -> str:
    parsed = urlparse(sheet_url)
    query = parse_qs(parsed.query)
    if "gid" in query and query["gid"]:
        return query["gid"][0]
    if parsed.fragment.startswith("gid="):
        return parsed.fragment.split("gid=", 1)[1]
    return "0"


def _resolve_csv_url(params: dict[str, Any]) -> str:
    csv_url = (params.get("csv_url") or "").strip()
    if csv_url:
        return csv_url

    sheet_url = (params.get("sheet_url") or "").strip()
    if not sheet_url:
        raise ValueError("Missing sheet_url")

    sheet_id = _extract_sheet_id(sheet_url)
    gid = str(params.get("gid") or _extract_gid(sheet_url) or "0")
    return f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"


def _download_csv(params: dict[str, Any]) -> bytes:
    url = _resolve_csv_url(params)
    resp = httpx.get(url, timeout=20, follow_redirects=True)
    resp.raise_for_status()
    return resp.content


def test_connection(params: dict[str, Any]) -> bool:
    try:
        data = _download_csv(params)
        _ = parse_to_polars(data, "csv")
        return True
    except Exception as exc:
        logger.warning(f"Google Sheets test_connection failed: {exc}")
        return False


def list_tables(params: dict[str, Any]) -> list[dict[str, Any]]:
    sheet_url = (params.get("sheet_url") or "").strip()
    csv_url = _resolve_csv_url(params)
    name = sheet_url.rsplit("/", 1)[-1] if sheet_url else "sheet"
    return [
        {
            "schema": "google_sheets",
            "name": name or "sheet",
            "type": "SHEET",
            "estimated_rows": None,
            "resource": csv_url,
        }
    ]


def preview_table(params: dict[str, Any], table: str | None = None, limit: int = 100) -> dict[str, Any]:
    data = _download_csv(params)
    df = parse_to_polars(data, "csv")
    df_preview = df.head(min(limit, 500))
    rows = df_preview.to_pandas().fillna("").values.tolist()
    return {"columns": df_preview.columns, "rows": rows, "row_count": df.height}


def fetch_table_as_polars(params: dict[str, Any], table: str | None = None, limit: int = _MAX_IMPORT_ROWS) -> pl.DataFrame:
    data = _download_csv(params)
    df = parse_to_polars(data, "csv")
    return df.head(min(limit, _MAX_IMPORT_ROWS))
