"""
In-process SQL query engine using DuckDB.

DuckDB can query Polars DataFrames (and pandas) directly with zero copying
via Apache Arrow, making it ideal for ad-hoc analytical queries on datasets
that have already been loaded from R2.

Usage:
    from duckdb_query import run_query
    result = run_query(pl_df, "SELECT region, SUM(sales) FROM df GROUP BY region")
"""
from __future__ import annotations

from typing import Any

import duckdb
import polars as pl


def _connect_with_df(df: pl.DataFrame) -> duckdb.DuckDBPyConnection:
    """Fresh connection with the DataFrame registered as table `df`.

    A per-call connection avoids cross-request races on a shared register
    slot. Registration goes through Arrow, which every DuckDB version
    supports (registering a Polars frame directly is version-dependent).

    enable_external_access=False is load-bearing: without it, DuckDB's
    built-in table functions (read_csv_auto, read_parquet, read_json_auto,
    glob, ...) let any SELECT statement read arbitrary files on the host —
    a full local-file-read vulnerability reachable from the SQL editor and
    the AI chat, neither of which restrict what the query can reference
    beyond a keyword denylist. This setting blocks all filesystem/network
    access from within the query itself; only the in-memory `df` table
    (registered below, before external access matters) is reachable.
    """
    conn = duckdb.connect(config={"enable_external_access": False})
    conn.register("df", df.to_arrow())
    return conn


def run_query(
    df: pl.DataFrame,
    sql: str,
    limit: int = 10_000,
    offset: int = 0,
) -> dict[str, Any]:
    """
    Execute a SQL query against a Polars DataFrame.

    The DataFrame is registered as the virtual table `df` for the duration
    of the query. Query results are paginated server-side using LIMIT/OFFSET.

    Args:
        df:    Polars DataFrame to query.
        sql:   SQL statement (must be a SELECT query).
        limit: Maximum rows returned (default 10 000).

    Returns:
        {
          "columns": ["col1", ...],
          "rows":    [[v1, v2, ...], ...],
          "row_count": int,
          "truncated": bool,     # True when result was capped at `limit`
        }

    Raises:
        ValueError:  Non-SELECT statement or SQL parse error.
        RuntimeError: Execution error (bad column name, type mismatch, etc.)
    """
    _validate_sql(sql)

    sql_clean = _normalize_sql(sql)
    sql_exec = (
        f"SELECT * FROM ({sql_clean}) __q "
        f"LIMIT {max(1, int(limit)) + 1} OFFSET {max(0, int(offset))}"
    )

    conn = _connect_with_df(df)
    try:
        result = conn.execute(sql_exec).fetchall()
        columns = [desc[0] for desc in conn.description]
    except Exception as exc:
        raise RuntimeError(str(exc)) from exc
    finally:
        conn.close()

    truncated = len(result) > limit
    rows = result[:limit]

    # Convert any non-JSON-serialisable types (Decimal, datetime, etc.)
    rows = [[_serialize(v) for v in row] for row in rows]

    return {
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
        "truncated": truncated,
        "offset": max(0, int(offset)),
        "limit": max(1, int(limit)),
        "has_more": truncated,
    }


def explain_query(df: pl.DataFrame, sql: str) -> dict[str, Any]:
    """
    Return DuckDB's logical/physical plan for a SELECT query.

    Response shape:
      { "plan": "..." }
    """
    _validate_sql(sql)
    sql_clean = _normalize_sql(sql)
    conn = _connect_with_df(df)
    try:
        rows = conn.execute(f"EXPLAIN {sql_clean}").fetchall()
    except Exception as exc:
        raise RuntimeError(str(exc)) from exc
    finally:
        conn.close()

    plan = "\n".join(str(r[-1]) for r in rows if r)
    return {"plan": plan}


def get_schema(df: pl.DataFrame) -> list[dict[str, str]]:
    """Return column names and DuckDB-reported types for a DataFrame."""
    try:
        conn = _connect_with_df(df)
        try:
            result = conn.execute("DESCRIBE df").fetchall()
        finally:
            conn.close()
        return [{"column": row[0], "type": row[1]} for row in result]
    except Exception:
        # Fallback: use Polars dtype info
        return [{"column": col, "type": str(dtype)}
                for col, dtype in zip(df.columns, df.dtypes)]


# ── private helpers ────────────────────────────────────────────────────────────

_FORBIDDEN = frozenset(["insert", "update", "delete", "drop", "create",
                         "alter", "truncate", "grant", "revoke", "copy"])


def _validate_sql(sql: str) -> None:
    """Reject non-SELECT or dangerous statements."""
    first_word = sql.strip().split()[0].lower() if sql.strip() else ""
    if first_word != "select":
        raise ValueError(
            "Only SELECT statements are allowed. "
            f"Got: {first_word.upper()!r}"
        )
    lower = sql.lower()
    for keyword in _FORBIDDEN:
        if keyword in lower:
            raise ValueError(f"Forbidden keyword in query: {keyword.upper()!r}")


def _normalize_sql(sql: str) -> str:
    """Normalize SQL text before execution."""
    return sql.strip().rstrip(";")


def _serialize(value: Any) -> Any:
    """Convert non-JSON-native types to strings for API responses."""
    if value is None:
        return None
    if isinstance(value, (int, float, bool, str)):
        return value
    # Decimal, date, datetime, timedelta, bytes, etc.
    return str(value)
