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

import re
import threading
from typing import Any

import duckdb
import polars as pl

# Hard wall-clock cap on a single query/explain execution. DuckDB has no
# built-in statement timeout; without this, a query like
# "SELECT count(*) FROM range(200000) a, range(200000) b WHERE ..." runs
# fully synchronously and — confirmed live — froze the entire single-process
# server (every /health check timed out) for the full 30+ seconds it ran.
# Enforced below by interrupting the connection from a watchdog thread.
_QUERY_TIMEOUT_SECONDS = 20

# Caps worst-case memory for a single query so a wide cross-join/aggregate
# can't exhaust the host's RAM even within the timeout window above.
_QUERY_MEMORY_LIMIT = "512MB"


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
    conn = duckdb.connect(config={
        "enable_external_access": False,
        "memory_limit": _QUERY_MEMORY_LIMIT,
    })
    conn.register("df", df.to_arrow())
    return conn


def _execute_with_timeout(
    conn: duckdb.DuckDBPyConnection, sql: str, timeout_seconds: float | None = None
) -> duckdb.DuckDBPyConnection:
    """Run `sql` on `conn`, interrupting it if it runs past `timeout_seconds`.

    DuckDB doesn't expose a statement-timeout config, so this drives one
    from a watchdog thread + conn.interrupt() (the officially supported way
    to cancel an in-flight query from another thread).

    `timeout_seconds` defaults to the module-level `_QUERY_TIMEOUT_SECONDS`,
    looked up here (not as a bound default parameter) so tests can
    monkeypatch it and actually affect already-imported callers.
    """
    if timeout_seconds is None:
        timeout_seconds = _QUERY_TIMEOUT_SECONDS
    error: list[BaseException] = []

    def target() -> None:
        try:
            conn.execute(sql)
        except BaseException as exc:  # noqa: BLE001 - re-raised on the caller's thread
            error.append(exc)

    worker = threading.Thread(target=target, daemon=True)
    worker.start()
    worker.join(timeout_seconds)

    if worker.is_alive():
        conn.interrupt()
        worker.join(5)
        raise RuntimeError(
            f"Query exceeded the {timeout_seconds:.0f}s execution limit and was cancelled. "
            "Try a smaller LIMIT, a narrower filter, or avoid large cross joins."
        )
    if error:
        raise error[0]
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
        _execute_with_timeout(conn, sql_exec)
        result = conn.fetchall()
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
        _execute_with_timeout(conn, f"EXPLAIN {sql_clean}")
        rows = conn.fetchall()
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
_FORBIDDEN_PATTERN = re.compile(
    r"\b(" + "|".join(_FORBIDDEN) + r")\b", re.IGNORECASE
)
# Strips string literals (so a filter like WHERE name = 'Grant Park' isn't
# flagged) and comments before the keyword scan, without needing a real SQL
# parser. Doesn't handle dollar-quoted strings; DuckDB's SQL dialect doesn't
# use them.
_STRING_OR_COMMENT = re.compile(
    r"'(?:[^']|'')*'"       # 'single-quoted string', with '' escapes
    r"|--[^\n]*"            # -- line comment
    r"|/\*.*?\*/",          # /* block comment */
    re.DOTALL,
)


def _validate_sql(sql: str) -> None:
    """Reject non-SELECT (and non-CTE-wrapped-SELECT) or mutating statements.

    The keyword scan runs over the SQL with string literals and comments
    stripped, and matches whole words only — a plain substring/whole-text
    check previously rejected completely benign, extremely common queries
    like "SELECT created_at FROM df" (contains "create") or
    "... WHERE updated_at IS NOT NULL" (contains "update").
    """
    first_word = sql.strip().split()[0].lower() if sql.strip() else ""
    if first_word not in ("select", "with"):
        raise ValueError(
            "Only SELECT statements (optionally starting with a WITH CTE) are allowed. "
            f"Got: {first_word.upper()!r}"
        )
    scannable = _STRING_OR_COMMENT.sub(" ", sql)
    match = _FORBIDDEN_PATTERN.search(scannable)
    if match:
        raise ValueError(f"Forbidden keyword in query: {match.group(1).upper()!r}")


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
