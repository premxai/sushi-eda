"""
"Ask Your Data" AI chat engine.

Converts natural-language questions to DuckDB SQL, executes them against
the dataset, and returns the answer with an explanation.

Flow:
  1. Build schema context (column names + types)
  2. Ask Claude to generate a SQL SELECT for the user's question
  3. Execute via DuckDB
  4. Ask Claude to interpret the results into a plain-English answer
  5. Return {sql, results, answer}

Streaming mode (SSE) is supported — the answer is streamed token by token.
"""
from __future__ import annotations

import json
import os
from typing import Any, AsyncGenerator

import polars as pl
from loguru import logger

from duckdb_query import run_query

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
AI_MODEL = os.getenv("AI_MODEL", "claude-haiku-4-5-20251001")


# ── Non-streaming: return full {sql, results, answer} ─────────────────────────

def ask_dataset(
    df: pl.DataFrame,
    question: str,
    chat_history: list[dict[str, str]] | None = None,
    limit: int = 500,
) -> dict[str, Any]:
    """
    Answer a natural-language question about a dataset.

    Args:
        df:           Polars DataFrame (the dataset).
        question:     User's natural-language question.
        chat_history: Previous turns [{"role": "user"|"assistant", "content": str}].
        limit:        Max rows returned from SQL (default 500).

    Returns:
        {
          "sql":     str | None,
          "results": {"columns": [...], "rows": [...], "row_count": int},
          "answer":  str,
          "error":   str | None,
        }
    """
    if not ANTHROPIC_API_KEY:
        return {
            "sql": None,
            "results": None,
            "answer": "AI chat is not configured. Set ANTHROPIC_API_KEY to enable this feature.",
            "error": "AI not configured",
        }

    schema = _df_schema(df)

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

        # Step 1: NL → SQL
        sql = _generate_sql(client, schema, question, chat_history or [])
        if not sql:
            return {
                "sql": None,
                "results": None,
                "answer": "I couldn't generate a SQL query for that question. Please try rephrasing.",
                "error": "SQL generation failed",
            }

        # Step 2: Execute SQL
        try:
            results = run_query(df, sql, limit=limit)
        except Exception as e:
            # Re-ask Claude to fix the broken SQL
            sql = _fix_sql(client, schema, question, sql, str(e))
            if sql:
                results = run_query(df, sql, limit=limit)
            else:
                return {
                    "sql": sql,
                    "results": None,
                    "answer": f"SQL execution failed: {e}",
                    "error": str(e),
                }

        # Step 3: Interpret results
        answer = _interpret_results(client, question, sql, results)
        return {
            "sql": sql,
            "results": results,
            "answer": answer,
            "error": None,
        }

    except Exception as e:
        logger.error(f"AI chat error: {e}")
        return {
            "sql": None,
            "results": None,
            "answer": f"An error occurred: {e}",
            "error": str(e),
        }


# ── Streaming: yields SSE events ──────────────────────────────────────────────

async def ask_dataset_stream(
    df: pl.DataFrame,
    question: str,
    chat_history: list[dict[str, str]] | None = None,
    limit: int = 500,
) -> AsyncGenerator[str, None]:
    """
    Streaming version of ask_dataset.  Yields SSE-formatted events:

    data: {"event": "sql",     "sql": "SELECT ..."}
    data: {"event": "results", "columns": [...], "rows": [...], "row_count": N}
    data: {"event": "token",   "text": "chunk..."}
    data: {"event": "done"}
    data: {"event": "error",   "message": "..."}
    """
    if not ANTHROPIC_API_KEY:
        yield _sse({"event": "error", "message": "ANTHROPIC_API_KEY not configured"})
        return

    schema = _df_schema(df)

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

        # Step 1: SQL generation (non-streaming, fast)
        sql = _generate_sql(client, schema, question, chat_history or [])
        if not sql:
            yield _sse({"event": "error", "message": "Could not generate SQL for this question"})
            return

        yield _sse({"event": "sql", "sql": sql})

        # Step 2: Execute
        try:
            results = run_query(df, sql, limit=limit)
        except Exception as e:
            sql = _fix_sql(client, schema, question, sql, str(e))
            if not sql:
                yield _sse({"event": "error", "message": f"SQL error: {e}"})
                return
            yield _sse({"event": "sql", "sql": sql})
            results = run_query(df, sql, limit=limit)

        yield _sse({
            "event": "results",
            "columns": results["columns"],
            "rows": results["rows"],
            "row_count": results["row_count"],
            "truncated": results["truncated"],
        })

        # Step 3: Stream the interpretation
        interpret_prompt = _interpret_prompt(question, sql, results)
        with client.messages.stream(
            model=AI_MODEL,
            max_tokens=512,
            messages=[{"role": "user", "content": interpret_prompt}],
        ) as stream:
            for text in stream.text_stream:
                yield _sse({"event": "token", "text": text})

        yield _sse({"event": "done"})

    except Exception as e:
        logger.error(f"AI chat stream error: {e}")
        yield _sse({"event": "error", "message": str(e)})


# ── Private helpers ────────────────────────────────────────────────────────────

def _df_schema(df: pl.DataFrame) -> str:
    lines = [f"- {col} ({dtype})" for col, dtype in zip(df.columns, df.dtypes)]
    return "\n".join(lines)


def _generate_sql(
    client: Any,
    schema: str,
    question: str,
    history: list[dict[str, str]],
) -> str | None:
    """Generate a DuckDB-compatible SQL SELECT from a natural-language question."""
    system = f"""You are a SQL expert. The user is asking questions about a dataset.
The dataset is available as the table `df` with these columns:
{schema}

Rules:
- Return ONLY the SQL query — no explanation, no markdown, no code fences.
- Only SELECT statements are allowed.
- Use DuckDB syntax (supports ARRAY_AGG, MEDIAN, QUANTILE, LIST, etc.).
- The table name is always `df`.
- If the question is ambiguous, write the most useful interpretation.
- If the question cannot be answered with SQL, return: CANNOT_ANSWER"""

    messages = [*history, {"role": "user", "content": f"Question: {question}"}]

    response = client.messages.create(
        model=AI_MODEL,
        max_tokens=512,
        system=system,
        messages=messages,
    )
    sql = response.content[0].text.strip()
    if sql == "CANNOT_ANSWER" or not sql.upper().startswith("SELECT"):
        return None
    return sql


def _fix_sql(
    client: Any,
    schema: str,
    question: str,
    broken_sql: str,
    error: str,
) -> str | None:
    """Ask Claude to fix a SQL query that returned an error."""
    prompt = f"""Fix this DuckDB SQL error.
Schema:
{schema}

Question: {question}
Broken SQL: {broken_sql}
Error: {error}

Return ONLY the corrected SQL. No explanation."""
    response = client.messages.create(
        model=AI_MODEL,
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    sql = response.content[0].text.strip()
    return sql if sql.upper().startswith("SELECT") else None


def _interpret_results(client: Any, question: str, sql: str, results: dict) -> str:
    """Generate a plain-English interpretation of query results."""
    prompt = _interpret_prompt(question, sql, results)
    response = client.messages.create(
        model=AI_MODEL,
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text.strip()


def _interpret_prompt(question: str, sql: str, results: dict) -> str:
    rows_preview = results["rows"][:20]
    truncated_note = f" (showing first {len(rows_preview)} of {results['row_count']} rows)" \
        if results["truncated"] or results["row_count"] > 20 else ""
    return f"""The user asked: "{question}"

SQL executed: {sql}

Results{truncated_note}:
Columns: {results['columns']}
Rows: {json.dumps(rows_preview, default=str)}

Answer the user's question in 1-3 sentences using the data above. Be specific with numbers.
Do not repeat the SQL or the raw data — just give a clear, conversational answer."""


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"
