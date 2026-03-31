"""
Data connector endpoints (org-scoped, Clerk-authenticated).

Routes:
  POST   /connectors                         - create a connector (editor+)
  GET    /connectors                         - list org connectors (viewer+)
  GET    /connectors/{connector_id}          - get connector details (viewer+)
  DELETE /connectors/{connector_id}          - delete connector (editor+)
  POST   /connectors/{connector_id}/test     - test live connection (editor+)
  GET    /connectors/{connector_id}/tables   - list tables/objects/endpoints (editor+)
  GET    /connectors/{connector_id}/columns  - list columns for a postgres table (editor+)
  POST   /connectors/{connector_id}/preview  - preview rows (editor+)
  POST   /connectors/{connector_id}/import   - import as dataset (editor+)

Supported connector types:
  postgres | s3 | google_sheets | rest
"""

from __future__ import annotations

import io
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from auth import get_current_user, validate_org_access
from cache import cache
from connectors.crypto import decrypt_config, encrypt_config
from db import get_db
from db.models import DataConnector, Dataset, User
from defaults import resolve_org_id
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from storage import storage
from worker import analyze_dataset

router = APIRouter(prefix="/connectors", tags=["connectors"])

DATABASE_URL = os.getenv("DATABASE_URL", "")
SUPPORTED_CONNECTOR_TYPES = ("postgres", "s3", "google_sheets", "rest")


def _resolved_org_id(org_id: str) -> uuid.UUID:
    result = resolve_org_id(org_id)
    return result if isinstance(result, uuid.UUID) else uuid.UUID(result)


async def _get_connector_or_404(
    connector_id: str, org_id: str, db: AsyncSession
) -> DataConnector:
    resolved_org_id = _resolved_org_id(org_id)
    result = await db.execute(
        select(DataConnector).where(
            DataConnector.id == uuid.UUID(connector_id),
            DataConnector.org_id == resolved_org_id,
        )
    )
    conn = result.scalar_one_or_none()
    if conn is None:
        raise HTTPException(status_code=404, detail="Connector not found")
    return conn


def _connector_summary(c: DataConnector) -> dict[str, Any]:
    return {
        "connector_id": str(c.id),
        "name": c.name,
        "connector_type": c.connector_type,
        "last_tested_at": c.last_tested_at.isoformat() if c.last_tested_at else None,
        "last_test_ok": c.last_test_ok,
        "created_at": c.created_at.isoformat(),
    }


@router.post("")
async def create_connector(
    org_id: str = Query(default="default"),
    body: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new connector. Credentials are encrypted before storage.

    postgres:
      { "name": "...", "type": "postgres", "host": "...", "port": 5432,
        "database": "...", "username": "...", "password": "...", "ssl_mode": "require" }

    s3:
      { "name": "...", "type": "s3", "bucket": "...", "region": "us-east-1",
        "access_key_id": "...", "secret_access_key": "...", "endpoint_url": "..." }

    google_sheets:
      { "name": "...", "type": "google_sheets", "sheet_url": "...", "gid": "0" }
      or { "name": "...", "type": "google_sheets", "csv_url": "..." }

    rest:
      { "name": "...", "type": "rest", "base_url": "...", "endpoints": ["/users"],
        "headers": { "X-API-Key": "..." }, "bearer_token": "...", "data_key": "data" }
    """
    await validate_org_access(
        org_id, current_user, db, allowed_roles=("admin", "editor")
    )

    connector_type = str(body.get("type", "")).lower().strip()
    if connector_type not in SUPPORTED_CONNECTOR_TYPES:
        allowed = ", ".join(SUPPORTED_CONNECTOR_TYPES)
        raise HTTPException(status_code=400, detail=f"type must be one of: {allowed}")

    name = str(body.get("name", "")).strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    creds = {k: v for k, v in body.items() if k not in ("name", "type")}
    encrypted = encrypt_config(creds)

    resolved_org_id = _resolved_org_id(org_id)
    connector = DataConnector(
        org_id=resolved_org_id,
        created_by=current_user.id,
        name=name,
        connector_type=connector_type,
        config_encrypted=encrypted,
    )
    db.add(connector)
    await db.commit()
    await db.refresh(connector)

    logger.info(f"Created {connector_type} connector {connector.id} for org {org_id}")
    return _connector_summary(connector)


@router.get("")
async def list_connectors(
    org_id: str = Query(default="default"),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await validate_org_access(org_id, current_user, db)
    resolved_org_id = _resolved_org_id(org_id)
    result = await db.execute(
        select(DataConnector)
        .where(DataConnector.org_id == resolved_org_id)
        .order_by(DataConnector.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    connectors = result.scalars().all()
    return {"connectors": [_connector_summary(c) for c in connectors]}


@router.get("/{connector_id}")
async def get_connector(
    connector_id: str,
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await validate_org_access(org_id, current_user, db)
    c = await _get_connector_or_404(connector_id, org_id, db)
    return _connector_summary(c)


@router.delete("/{connector_id}", status_code=204, response_model=None)
async def delete_connector(
    connector_id: str,
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await validate_org_access(
        org_id, current_user, db, allowed_roles=("admin", "editor")
    )
    c = await _get_connector_or_404(connector_id, org_id, db)
    await db.delete(c)
    await db.commit()
    logger.info(f"Deleted connector {connector_id}")


@router.post("/{connector_id}/test")
async def test_connector(
    connector_id: str,
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await validate_org_access(
        org_id, current_user, db, allowed_roles=("admin", "editor")
    )
    c = await _get_connector_or_404(connector_id, org_id, db)
    params = decrypt_config(c.config_encrypted)

    ok = await _run_test(c.connector_type, params)

    c.last_tested_at = datetime.now(timezone.utc)
    c.last_test_ok = ok
    await db.commit()
    return {"ok": ok, "tested_at": c.last_tested_at.isoformat()}


@router.get("/{connector_id}/tables")
async def list_connector_tables(
    connector_id: str,
    org_id: str = Query(default="default"),
    prefix: str = Query(default=""),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List importable resources for a connector.
    """
    await validate_org_access(
        org_id, current_user, db, allowed_roles=("admin", "editor")
    )
    c = await _get_connector_or_404(connector_id, org_id, db)
    params = decrypt_config(c.config_encrypted)

    if c.connector_type == "postgres":
        from connectors.postgres import list_tables

        tables = await list_tables(params)
        return {"tables": tables}

    if c.connector_type == "s3":
        from connectors.s3_connector import list_objects

        objects = list_objects(params, prefix=prefix)
        return {"objects": objects}

    if c.connector_type == "google_sheets":
        from connectors.google_sheets import list_tables

        tables = list_tables(params)
        return {"tables": tables}

    if c.connector_type == "rest":
        from connectors.rest_api import list_tables

        tables = list_tables(params)
        return {"tables": tables}

    raise HTTPException(status_code=400, detail="Unknown connector type")


@router.get("/{connector_id}/columns")
async def list_connector_columns(
    connector_id: str,
    schema: str = Query(default="public"),
    table: str = Query(...),
    org_id: str = Query(default="default"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List columns for a specific table (postgres only).
    """
    await validate_org_access(
        org_id, current_user, db, allowed_roles=("admin", "editor")
    )
    c = await _get_connector_or_404(connector_id, org_id, db)
    if c.connector_type != "postgres":
        raise HTTPException(
            status_code=400, detail="Column listing only supported for postgres"
        )

    params = decrypt_config(c.config_encrypted)
    from connectors.postgres import list_columns

    columns = await list_columns(params, schema, table)
    return {"columns": columns}


@router.post("/{connector_id}/preview")
async def preview_connector(
    connector_id: str,
    org_id: str = Query(default="default"),
    body: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Preview rows without importing.
    """
    await validate_org_access(
        org_id, current_user, db, allowed_roles=("admin", "editor")
    )
    c = await _get_connector_or_404(connector_id, org_id, db)
    params = decrypt_config(c.config_encrypted)
    limit = min(int(body.get("limit", 100)), 500)

    if c.connector_type == "postgres":
        from connectors.postgres import fetch_query_as_polars, preview_table

        if "query" in body:
            df = await fetch_query_as_polars(params, body["query"], limit=limit)
            cols = df.columns
            rows = df.to_pandas().fillna("").values.tolist()
            return {"columns": cols, "rows": rows, "row_count": len(rows)}
        return await preview_table(
            params,
            schema=body.get("schema", "public"),
            table=body["table"],
            limit=limit,
        )

    if c.connector_type == "s3":
        from connectors.s3_connector import fetch_object_as_polars

        df, _ = fetch_object_as_polars(params, body["key"])
        df_preview = df.head(limit)
        cols = df_preview.columns
        rows = df_preview.to_pandas().fillna("").values.tolist()
        return {"columns": cols, "rows": rows, "row_count": df.height}

    if c.connector_type == "google_sheets":
        from connectors.google_sheets import preview_table

        return preview_table(params, table=body.get("table"), limit=limit)

    if c.connector_type == "rest":
        from connectors.rest_api import preview_table

        endpoint = str(body.get("table") or body.get("endpoint") or "").strip()
        if not endpoint:
            raise HTTPException(
                status_code=400, detail="table (endpoint) is required for REST preview"
            )
        return preview_table(params, table=endpoint, limit=limit)

    raise HTTPException(status_code=400, detail="Unknown connector type")


@router.post("/{connector_id}/import")
async def import_from_connector(
    connector_id: str,
    org_id: str = Query(default="default"),
    body: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Import data from a connector as a new Dataset.
    Saves to object storage as Parquet and enqueues a Celery analysis job.
    """
    await validate_org_access(
        org_id, current_user, db, allowed_roles=("admin", "editor")
    )
    c = await _get_connector_or_404(connector_id, org_id, db)
    params = decrypt_config(c.config_encrypted)
    dataset_name = body.get("name", "").strip() or "Imported dataset"

    if c.connector_type == "postgres":
        from connectors.postgres import fetch_query_as_polars, fetch_table_as_polars

        if "query" in body:
            df = await fetch_query_as_polars(params, body["query"])
            source_label = "query"
        else:
            df = await fetch_table_as_polars(
                params,
                schema=body.get("schema", "public"),
                table=body["table"],
            )
            source_label = body["table"]

    elif c.connector_type == "s3":
        from connectors.s3_connector import fetch_object_as_polars

        df, _ = fetch_object_as_polars(params, body["key"])
        source_label = body["key"].rsplit("/", 1)[-1]

    elif c.connector_type == "google_sheets":
        from connectors.google_sheets import fetch_table_as_polars

        df = fetch_table_as_polars(params, table=body.get("table"))
        source_label = "google_sheet"

    elif c.connector_type == "rest":
        from connectors.rest_api import fetch_table_as_polars

        endpoint = str(body.get("table") or body.get("endpoint") or "").strip()
        if not endpoint:
            raise HTTPException(
                status_code=400, detail="table (endpoint) is required for REST import"
            )
        df = fetch_table_as_polars(params, table=endpoint)
        source_label = (
            re.sub(r"[^a-zA-Z0-9._-]+", "_", endpoint.strip("/")) or "rest_endpoint"
        )

    else:
        raise HTTPException(status_code=400, detail="Unknown connector type")

    if df.is_empty():
        raise HTTPException(status_code=422, detail="Imported data is empty")

    dataset_id = str(uuid.uuid4())
    filename = f"{source_label}.parquet"
    file_key = f"uploads/{org_id}/{dataset_id}/{filename}"

    buf = io.BytesIO()
    df.write_parquet(buf)
    parquet_bytes = buf.getvalue()

    try:
        storage.upload(org_id, dataset_id, filename, parquet_bytes)
    except Exception as exc:
        logger.error(f"Object storage upload failed for connector import: {exc}")
        raise HTTPException(status_code=500, detail="File storage failed") from exc

    dataset = Dataset(
        id=dataset_id,
        org_id=_resolved_org_id(org_id),
        created_by=current_user.id,
        name=dataset_name,
        original_filename=filename,
        file_key=file_key,
        file_size_bytes=len(parquet_bytes),
        file_format="parquet",
        status="pending",
    )
    db.add(dataset)
    await db.commit()

    cache.set_job_status(dataset_id, "pending")
    analyze_dataset.delay(
        dataset_id=dataset_id,
        org_id=org_id,
        file_key=file_key,
        file_format="parquet",
        database_url=DATABASE_URL,
    )

    logger.info(
        f"Connector import: connector={connector_id} -> dataset={dataset_id} "
        f"({df.height}r x {df.width}c)"
    )
    return {
        "dataset_id": dataset_id,
        "status": "pending",
        "message": f"Imported {df.height:,} rows x {df.width} columns. Analysis queued.",
    }


async def _run_test(connector_type: str, params: dict[str, Any]) -> bool:
    if connector_type == "postgres":
        from connectors.postgres import test_connection

        return await test_connection(params)

    if connector_type == "s3":
        from connectors.s3_connector import test_connection

        return test_connection(params)

    if connector_type == "google_sheets":
        from connectors.google_sheets import test_connection

        return test_connection(params)

    if connector_type == "rest":
        from connectors.rest_api import test_connection

        return test_connection(params)

    return False
