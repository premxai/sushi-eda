"""
PostgreSQL data connector.

Connects to an external Postgres instance, lists tables/schemas,
previews rows, and fetches data into a Polars DataFrame for import.

All connections use asyncpg with a 10-second connection timeout.
SELECT-only operations are enforced (no DDL/DML).
"""
from __future__ import annotations

import re
from typing import Any

import asyncpg
import polars as pl
from loguru import logger

_CONNECT_TIMEOUT = 10  # seconds
_MAX_IMPORT_ROWS = 500_000

# Forbidden keywords that must not appear in user-supplied queries
_FORBIDDEN = frozenset(
    ["insert", "update", "delete", "drop", "truncate", "alter", "create",
     "grant", "revoke", "copy", "vacuum", "analyze", "reindex"]
)


def _validate_query(sql: str) -> None:
    """Raise ValueError if the query contains forbidden keywords."""
    tokens = re.findall(r"\b\w+\b", sql.lower())
    bad = _FORBIDDEN & set(tokens)
    if bad:
        raise ValueError(f"Query contains forbidden keyword(s): {', '.join(bad)}")


async def _connect(params: dict[str, Any]) -> asyncpg.Connection:
    ssl = params.get("ssl_mode", "prefer")
    return await asyncpg.connect(
        host=params["host"],
        port=int(params.get("port", 5432)),
        database=params["database"],
        user=params["username"],
        password=params["password"],
        ssl=ssl if ssl != "disable" else None,
        timeout=_CONNECT_TIMEOUT,
        command_timeout=60,
    )


async def test_connection(params: dict[str, Any]) -> bool:
    """Return True if we can connect and run SELECT 1."""
    try:
        conn = await _connect(params)
        await conn.fetchval("SELECT 1")
        await conn.close()
        return True
    except Exception as exc:
        logger.warning(f"Postgres test_connection failed: {exc}")
        return False


async def list_tables(params: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Return all user tables + views the credential can see.

    Returns a list of:
        {schema, name, type, estimated_rows}
    """
    conn = await _connect(params)
    try:
        rows = await conn.fetch(
            """
            SELECT
                table_schema  AS schema,
                table_name    AS name,
                table_type    AS type,
                (SELECT reltuples::bigint
                 FROM pg_class c
                 JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE n.nspname = table_schema AND c.relname = table_name
                ) AS estimated_rows
            FROM information_schema.tables
            WHERE table_schema NOT IN ('pg_catalog','information_schema','pg_toast')
              AND table_type IN ('BASE TABLE','VIEW')
            ORDER BY table_schema, table_name
            LIMIT 500
            """
        )
        return [dict(r) for r in rows]
    finally:
        await conn.close()


async def list_columns(
    params: dict[str, Any], schema: str, table: str
) -> list[dict[str, Any]]:
    """Return column names + types for a specific table."""
    conn = await _connect(params)
    try:
        rows = await conn.fetch(
            """
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = $1 AND table_name = $2
            ORDER BY ordinal_position
            """,
            schema, table,
        )
        return [dict(r) for r in rows]
    finally:
        await conn.close()


async def preview_table(
    params: dict[str, Any],
    schema: str,
    table: str,
    limit: int = 100,
) -> dict[str, Any]:
    """Return the first `limit` rows of a table as columns + rows."""
    # Sanitize schema/table names (allow only identifiers)
    if not re.match(r"^[A-Za-z_][A-Za-z0-9_$]*$", schema) or \
       not re.match(r"^[A-Za-z_][A-Za-z0-9_$]*$", table):
        raise ValueError("Invalid schema or table name")

    conn = await _connect(params)
    try:
        rows = await conn.fetch(
            f'SELECT * FROM "{schema}"."{table}" LIMIT {min(limit, 500)}'
        )
        if not rows:
            return {"columns": [], "rows": [], "row_count": 0}
        columns = list(rows[0].keys())
        data = [[str(cell) if cell is not None else None for cell in r] for r in rows]
        return {"columns": columns, "rows": data, "row_count": len(data)}
    finally:
        await conn.close()


async def fetch_table_as_polars(
    params: dict[str, Any],
    schema: str,
    table: str,
    limit: int = _MAX_IMPORT_ROWS,
) -> pl.DataFrame:
    """Fetch an entire table (up to limit rows) as a Polars DataFrame."""
    if not re.match(r"^[A-Za-z_][A-Za-z0-9_$]*$", schema) or \
       not re.match(r"^[A-Za-z_][A-Za-z0-9_$]*$", table):
        raise ValueError("Invalid schema or table name")

    conn = await _connect(params)
    try:
        rows = await conn.fetch(
            f'SELECT * FROM "{schema}"."{table}" LIMIT {min(limit, _MAX_IMPORT_ROWS)}'
        )
        if not rows:
            return pl.DataFrame()
        return pl.from_dicts([dict(r) for r in rows])
    finally:
        await conn.close()


async def fetch_query_as_polars(
    params: dict[str, Any],
    sql: str,
    limit: int = _MAX_IMPORT_ROWS,
) -> pl.DataFrame:
    """Run a user-supplied SELECT query and return a Polars DataFrame."""
    _validate_query(sql)
    # Wrap in a subquery to enforce LIMIT
    wrapped = f"SELECT * FROM ({sql}) _q LIMIT {min(limit, _MAX_IMPORT_ROWS)}"
    conn = await _connect(params)
    try:
        rows = await conn.fetch(wrapped)
        if not rows:
            return pl.DataFrame()
        return pl.from_dicts([dict(r) for r in rows])
    finally:
        await conn.close()
