"""
Claude AI data cleaning suggestion engine.

Takes an EDA report and produces a structured list of cleaning operations
with justification, impact estimate, and a ready-to-apply operation spec
that maps directly to the /clean and /transform endpoint bodies.

Endpoint: POST /datasets/{id}/ai/cleaning-suggestions
"""

from __future__ import annotations

import json
import os
from typing import Any

from loguru import logger

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
AI_MODEL = os.getenv("AI_MODEL", "claude-haiku-4-5-20251001")
AI_MAX_TOKENS = int(os.getenv("AI_MAX_TOKENS_CLEANING", "2048"))


def generate_cleaning_suggestions(report: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Generate structured cleaning suggestions for a dataset.

    Returns a list of suggestion dicts:
    {
      "id": str,
      "priority": "high" | "medium" | "low",
      "category": "missing_data" | "duplicates" | "outliers" | "type_cast" | "formatting",
      "column": str | None,
      "title": str,
      "description": str,
      "estimated_rows_affected": int | None,
      "operation": dict,   # maps to /clean or /transform body
    }

    Returns [] if AI is disabled or API call fails.
    """
    if not ANTHROPIC_API_KEY:
        logger.info(
            "ANTHROPIC_API_KEY not set — returning rule-based cleaning suggestions"
        )
        return _rule_based_suggestions(report)

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        prompt = _build_prompt(report)
        message = client.messages.create(
            model=AI_MODEL,
            max_tokens=AI_MAX_TOKENS,
            messages=[{"role": "user", "content": prompt}],
        )
        text = message.content[0].text.strip()
        suggestions = _parse_ai_response(text)
        logger.info(f"AI generated {len(suggestions)} cleaning suggestions")
        return suggestions
    except Exception as e:
        logger.warning(
            f"AI cleaning suggestions failed, falling back to rule-based: {e}"
        )
        return _rule_based_suggestions(report)


# ── Prompt construction ────────────────────────────────────────────────────────


def _build_prompt(report: dict[str, Any]) -> str:
    basic = report.get("basic_info", {})
    columns = report.get("column_analysis", [])
    outliers = report.get("outliers", [])
    quality = report.get("quality_score", {})
    type_suggestions = report.get("type_suggestions", {})

    col_summary = []
    for c in columns:
        s = c.get("stats") or {}
        entry = {
            "name": c["name"],
            "dtype": c["dtype"],
            "missing_pct": c["missing_percent"],
            "unique_count": c["unique_count"],
            "is_numeric": c["is_numeric"],
        }
        if s:
            entry["mean"] = s.get("mean")
            entry["std"] = s.get("std")
            entry["skewness"] = s.get("skewness")
        col_summary.append(entry)

    outlier_summary = [
        {"column": o["column"], "outlier_pct": o["outlier_percent"]}
        for o in outliers
        if o["outlier_percent"] > 2
    ]

    return f"""You are a data engineering expert. Analyze this EDA report and return a JSON array of cleaning suggestions.

Dataset: {basic.get("rows", 0):,} rows × {basic.get("columns", "?")} columns
Duplicates: {basic.get("duplicate_rows", 0)}
Quality score: {quality.get("overall_score", "?")}/100

Columns:
{json.dumps(col_summary, indent=2)}

Outlier columns (>2% outliers):
{json.dumps(outlier_summary, indent=2)}

Type suggestions from analysis:
- Datetime: {[s["column"] for s in type_suggestions.get("datetime_suggestions", [])]}
- Categorical: {[s["column"] for s in type_suggestions.get("categorical_suggestions", [])]}
- Numeric strings: {[s["column"] for s in type_suggestions.get("numeric_suggestions", [])]}
- Boolean: {[s["column"] for s in type_suggestions.get("boolean_suggestions", [])]}

Return ONLY a valid JSON array (no markdown, no explanation). Each element:
{{
  "id": "unique-kebab-id",
  "priority": "high|medium|low",
  "category": "missing_data|duplicates|outliers|type_cast|formatting",
  "column": "column_name or null for dataset-level",
  "title": "Short title",
  "description": "Why this matters and what it does",
  "estimated_rows_affected": integer_or_null,
  "operation": {{
    "endpoint": "/clean or /transform",
    "body": {{ ... }}
  }}
}}

Focus on the top 5-8 most impactful suggestions. Use actual column names from the data.
For /clean operations, body keys: drop_missing_rows, drop_missing_cols_threshold,
impute_numeric (mean|median|constant|ffill), remove_duplicates, cap_outliers,
remove_outliers, cast_datetime, cast_numeric, cast_categorical.
For /transform: log_transform, normalize, standardize, one_hot_encode, label_encode."""


# ── Response parsing ───────────────────────────────────────────────────────────


def _parse_ai_response(text: str) -> list[dict[str, Any]]:
    """Extract JSON array from AI response."""
    try:
        # Strip any markdown code fences
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text.strip())
    except Exception as e:
        logger.warning(f"Failed to parse AI cleaning response: {e}")
        return []


# ── Rule-based fallback ────────────────────────────────────────────────────────


def _rule_based_suggestions(report: dict[str, Any]) -> list[dict[str, Any]]:
    """Deterministic suggestions when AI is unavailable."""
    suggestions = []
    columns = report.get("column_analysis", [])
    outliers = report.get("outliers", [])
    basic = report.get("basic_info", {})
    n_rows = basic.get("rows", 1) or 1
    type_hints = report.get("type_suggestions", {})

    idx = 0

    # 1. Duplicates
    if basic.get("duplicate_rows", 0) > 0:
        dup_pct = round(basic["duplicate_rows"] / n_rows * 100, 1)
        suggestions.append(
            {
                "id": f"remove-duplicates",
                "priority": "high" if dup_pct > 5 else "medium",
                "category": "duplicates",
                "column": None,
                "title": f"Remove {basic['duplicate_rows']:,} duplicate rows",
                "description": f"{dup_pct}% of rows are exact duplicates. Removing them improves model accuracy and reduces noise.",
                "estimated_rows_affected": basic["duplicate_rows"],
                "operation": {
                    "endpoint": "/clean",
                    "body": {"remove_duplicates": True},
                },
            }
        )

    # 2. High missing columns
    missing_count = 0
    for c in sorted(columns, key=lambda x: x["missing_percent"], reverse=True):
        if c["missing_percent"] > 5:
            action = "mean" if c["is_numeric"] else "mode"
            suggestions.append(
                {
                    "id": f"impute-{c['name']}",
                    "priority": "high" if c["missing_percent"] > 30 else "medium",
                    "category": "missing_data",
                    "column": c["name"],
                    "title": f"Impute missing values in '{c['name']}' ({c['missing_percent']:.0f}% missing)",
                    "description": f"Fill {c['missing_count']} missing values using {action} imputation.",
                    "estimated_rows_affected": c["missing_count"],
                    "operation": {
                        "endpoint": "/clean",
                        "body": {
                            f"impute_{'numeric' if c['is_numeric'] else 'categorical'}": action,
                            f"impute_{'numeric' if c['is_numeric'] else 'categorical'}_columns": [
                                c["name"]
                            ],
                        },
                    },
                }
            )
            missing_count += 1
            if missing_count >= 5:
                break

    # 3. Outliers
    for o in sorted(outliers, key=lambda x: x["outlier_percent"], reverse=True)[:2]:
        if o["outlier_percent"] > 3:
            suggestions.append(
                {
                    "id": f"cap-outliers-{o['column']}",
                    "priority": "medium",
                    "category": "outliers",
                    "column": o["column"],
                    "title": f"Cap outliers in '{o['column']}' ({o['outlier_percent']:.1f}% affected)",
                    "description": f"{o['outlier_count']} values fall outside IQR bounds [{o['lower_bound']}, {o['upper_bound']}]. Capping prevents them from skewing models.",
                    "estimated_rows_affected": o["outlier_count"],
                    "operation": {
                        "endpoint": "/clean",
                        "body": {
                            "cap_outliers": True,
                            "outlier_columns": [o["column"]],
                        },
                    },
                }
            )

    # 4. Type casts
    for s in type_hints.get("datetime_suggestions", [])[:2]:
        suggestions.append(
            {
                "id": f"cast-datetime-{s['column']}",
                "priority": "low",
                "category": "type_cast",
                "column": s["column"],
                "title": f"Convert '{s['column']}' to datetime",
                "description": f"{s['confidence']:.0f}% of values parse as dates. Converting unlocks time-series features.",
                "estimated_rows_affected": None,
                "operation": {
                    "endpoint": "/clean",
                    "body": {"cast_datetime": [s["column"]]},
                },
            }
        )

    for s in type_hints.get("numeric_suggestions", [])[:2]:
        suggestions.append(
            {
                "id": f"cast-numeric-{s['column']}",
                "priority": "low",
                "category": "type_cast",
                "column": s["column"],
                "title": f"Convert '{s['column']}' to {s['suggested_type']}",
                "description": f"Column contains numeric strings. Converting enables statistical analysis.",
                "estimated_rows_affected": None,
                "operation": {
                    "endpoint": "/clean",
                    "body": {"cast_numeric": [s["column"]]},
                },
            }
        )

    return suggestions[:8]
