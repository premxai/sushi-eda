"""
REST API connector.

Configuration params:
  - base_url: string (required)
  - headers: object (optional)
  - auth_header: string (optional, default: Authorization)
  - bearer_token: string (optional)
  - endpoints: string[] (optional; used by list_tables)
  - healthcheck_endpoint: string (optional)
  - data_key: string (optional; extract list from response object)
"""
from __future__ import annotations

import json
from typing import Any
from urllib.parse import urljoin

import httpx
import polars as pl
from loguru import logger

_MAX_IMPORT_ROWS = 500_000


def _build_headers(params: dict[str, Any]) -> dict[str, str]:
    raw_headers = params.get("headers") or {}
    headers: dict[str, str] = {}
    if isinstance(raw_headers, dict):
        headers = {str(k): str(v) for k, v in raw_headers.items() if v is not None}
    token = (params.get("bearer_token") or "").strip()
    if token:
        auth_header = (params.get("auth_header") or "Authorization").strip()
        headers[auth_header] = f"Bearer {token}"
    return headers


def _build_url(base_url: str, endpoint: str) -> str:
    endpoint = (endpoint or "").strip()
    if not endpoint:
        return base_url
    if endpoint.startswith("http://") or endpoint.startswith("https://"):
        return endpoint
    return urljoin(base_url.rstrip("/") + "/", endpoint.lstrip("/"))


def _extract_records(payload: Any, data_key: str | None) -> list[Any]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        if data_key:
            data = payload.get(data_key)
            if isinstance(data, list):
                return data
            if isinstance(data, dict):
                return [data]
            return []
        # Fallback: choose first list field in object
        for value in payload.values():
            if isinstance(value, list):
                return value
        return [payload]
    return [payload]


def _records_to_polars(records: list[Any]) -> pl.DataFrame:
    normalized: list[dict[str, Any]] = []
    for item in records:
        if isinstance(item, dict):
            row: dict[str, Any] = {}
            for key, value in item.items():
                if isinstance(value, (dict, list)):
                    row[str(key)] = json.dumps(value)
                else:
                    row[str(key)] = value
            normalized.append(row)
        else:
            normalized.append({"value": item})
    if not normalized:
        return pl.DataFrame()
    return pl.from_dicts(normalized)


def _fetch_json(params: dict[str, Any], endpoint: str) -> Any:
    base_url = (params.get("base_url") or "").strip()
    if not base_url:
        raise ValueError("Missing base_url")
    url = _build_url(base_url, endpoint)
    headers = _build_headers(params)
    response = httpx.get(url, headers=headers, timeout=20, follow_redirects=True)
    response.raise_for_status()
    return response.json()


def test_connection(params: dict[str, Any]) -> bool:
    try:
        endpoint = (params.get("healthcheck_endpoint") or "").strip()
        if not endpoint:
            endpoint = (params.get("endpoints") or ["/"])[0] if isinstance(params.get("endpoints"), list) else "/"
        _ = _fetch_json(params, endpoint)
        return True
    except Exception as exc:
        logger.warning(f"REST connector test_connection failed: {exc}")
        return False


def list_tables(params: dict[str, Any]) -> list[dict[str, Any]]:
    endpoints = params.get("endpoints") or []
    if not isinstance(endpoints, list):
        endpoints = []
    if not endpoints:
        endpoints = ["/"]
    return [
        {
            "schema": "rest",
            "name": str(ep),
            "type": "ENDPOINT",
            "estimated_rows": None,
        }
        for ep in endpoints
    ]


def preview_table(params: dict[str, Any], table: str, limit: int = 100) -> dict[str, Any]:
    payload = _fetch_json(params, table)
    data_key = params.get("data_key")
    records = _extract_records(payload, str(data_key) if data_key else None)
    df = _records_to_polars(records)
    df_preview = df.head(min(limit, 500))
    rows = df_preview.to_pandas().fillna("").values.tolist()
    return {"columns": df_preview.columns, "rows": rows, "row_count": df.height}


def fetch_table_as_polars(params: dict[str, Any], table: str, limit: int = _MAX_IMPORT_ROWS) -> pl.DataFrame:
    payload = _fetch_json(params, table)
    data_key = params.get("data_key")
    records = _extract_records(payload, str(data_key) if data_key else None)
    df = _records_to_polars(records)
    return df.head(min(limit, _MAX_IMPORT_ROWS))
