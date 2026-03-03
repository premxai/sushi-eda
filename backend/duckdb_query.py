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

# One DuckDB connection per process — thread-safe for reads
_conn = duckdb.connect()


def run_query(df: pl.DataFrame, sql: str, limit: int = 10_000) -> dict[str, Any]:
    """
    Execute a SQL query against a Polars DataFrame.

    The DataFrame is registered as the virtual table `df` for the duration
    of the query.  A LIMIT is injected automatically if the query is a
    bare SELECT without one, to prevent runaway result sets.

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

    # Inject limit if missing
    sql_exec = _inject_limit(sql.strip(), limit + 1)

    try:
        result = _conn.execute(sql_exec, {"df": df}).fetchall()
        columns = [desc[0] for desc in _conn.description]
    except Exception as exc:
        raise RuntimeError(str(exc)) from exc

    truncated = len(result) > limit
    rows = result[:limit]

    # Convert any non-JSON-serialisable types (Decimal, datetime, etc.)
    rows = [[_serialize(v) for v in row] for row in rows]

    return {
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
        "truncated": truncated,
    }


def get_schema(df: pl.DataFrame) -> list[dict[str, str]]:
    """Return column names and DuckDB-reported types for a DataFrame."""
    try:
        _conn.register("_schema_probe", df)
        result = _conn.execute("DESCRIBE _schema_probe").fetchall()
        _conn.unregister("_schema_probe")
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


def _inject_limit(sql: str, limit: int) -> str:
    """Add LIMIT clause if one is not already present."""
    lower = sql.rstrip(";").lower()
    if "limit" not in lower:
        return f"{sql.rstrip(';')} LIMIT {limit}"
    return sql


def _serialize(value: Any) -> Any:
    """Convert non-JSON-native types to strings for API responses."""
    if value is None:
        return None
    if isinstance(value, (int, float, bool, str)):
        return value
    # Decimal, date, datetime, timedelta, bytes, etc.
    return str(value)
