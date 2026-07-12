"""
Claude AI narrative generator.

Takes an EDA report dict and produces a plain-English summary for a
product-manager audience using the Claude API. Called once per analysis
(analysis_runner.py) and stored in Analysis.ai_narrative.

The prompt is tuned to produce markdown with:
  - What this data is (2-3 sentences, incl. trustworthiness)
  - Key findings (decision-relevant bullet points)
  - Watch out for (caveats that could mislead)
  - Questions worth asking (chat-ready follow-up questions)
"""

from __future__ import annotations

import os
from typing import Any

from loguru import logger

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
AI_MODEL = os.getenv(
    "AI_MODEL", "claude-haiku-4-5-20251001"
)  # cheap & fast for narratives
AI_MAX_TOKENS = int(os.getenv("AI_MAX_TOKENS", "1024"))


class NarrativeGenerationError(RuntimeError):
    """A supplied BYOK credential could not produce a narrative."""


def generate_narrative(
    report: dict[str, Any], dataset_name: str = "the dataset", api_key: str | None = None
) -> str | None:
    """
    Generate a markdown insight narrative for an EDA report.

    Returns the narrative string, or None if AI is disabled / key missing.
    Errors are swallowed so analysis still completes without a narrative.
    """
    resolved_api_key = api_key or ANTHROPIC_API_KEY
    if not resolved_api_key:
        logger.info("ANTHROPIC_API_KEY not set — skipping AI narrative")
        return None

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=resolved_api_key)

        prompt = _build_prompt(report, dataset_name)
        message = client.messages.create(
            model=AI_MODEL,
            max_tokens=AI_MAX_TOKENS,
            messages=[{"role": "user", "content": prompt}],
        )
        narrative = message.content[0].text.strip()
        logger.info(f"AI narrative generated ({len(narrative)} chars)")
        return narrative

    except Exception as exc:
        # Do not log a user-supplied key or a provider response containing it.
        logger.warning(f"AI narrative generation failed: {type(exc).__name__}")
        if api_key:
            raise NarrativeGenerationError("The supplied Anthropic key could not generate a summary.") from exc
        return None


def _build_prompt(report: dict[str, Any], dataset_name: str) -> str:
    basic = report.get("basic_info", {})
    quality = report.get("quality_score", {})
    columns = report.get("column_analysis", [])
    outliers = report.get("outliers", [])
    correlation = report.get("correlation_matrix", {})

    # Build a compact summary of the data for the prompt
    numeric_cols = [c for c in columns if c.get("is_numeric") and c.get("stats")]
    categorical_cols = [c for c in columns if not c.get("is_numeric")]

    top_outlier_cols = sorted(outliers, key=lambda x: x["outlier_count"], reverse=True)[
        :3
    ]
    high_missing = [c for c in columns if c["missing_percent"] > 10]

    # Find highly correlated pairs
    corr_pairs = []
    corr_matrix = correlation.get("matrix", [])
    corr_cols = correlation.get("columns", [])
    for i in range(len(corr_cols)):
        for j in range(i + 1, len(corr_cols)):
            if corr_matrix and abs(corr_matrix[i][j]) > 0.7:
                corr_pairs.append(
                    f"{corr_cols[i]} ↔ {corr_cols[j]}: {corr_matrix[i][j]:.2f}"
                )

    prompt = f"""You are a senior data analyst. Analyze the following EDA report for "{dataset_name}" and write a concise, insightful markdown narrative.

## Dataset Overview
- Rows: {basic.get("rows", 0):,}
- Columns: {basic.get("columns", "?")}
- Memory: {basic.get("memory_usage_mb", "?")} MB
- Duplicate rows: {basic.get("duplicate_rows", 0)}
- Total missing values: {basic.get("total_missing", 0)}

## Data Quality Score
- Overall: {quality.get("overall_score", "?")}/100 (Grade: {quality.get("grade", "?")})
- Missing data score: {quality.get("breakdown", {}).get("missing_data", {}).get("score", "?")}
- Duplicates score: {quality.get("breakdown", {}).get("duplicates", {}).get("score", "?")}
- Outliers score: {quality.get("breakdown", {}).get("outliers", {}).get("score", "?")}

## Numeric Columns ({len(numeric_cols)} total)
{_format_numeric_cols(numeric_cols[:8])}

## Categorical Columns ({len(categorical_cols)} total)
{_format_categorical_cols(categorical_cols[:5])}

## Columns with Missing Data (>10%)
{", ".join(f"{c['name']} ({c['missing_percent']:.1f}%)" for c in high_missing) or "None"}

## Top Outlier Columns
{_format_outliers(top_outlier_cols) or "None detected"}

## Strong Correlations (|r| > 0.7)
{chr(10).join(corr_pairs) or "None found"}

---

Write a markdown narrative with exactly these sections:
1. **What this data is** (2-3 sentences — what the dataset appears to contain and whether the numbers can be trusted, referencing the quality grade in plain terms)
2. **Key findings** (3-5 bullet points — the most decision-relevant patterns. Lead each bullet with the takeaway, then the supporting number)
3. **Watch out for** (specific caveats that could mislead someone reading totals or averages from this data — missing values, duplicates, extreme values. If nothing significant, say the data looks reliable)
4. **Questions worth asking** (2-3 short natural-language questions a product manager could ask next about this data, phrased so they could be typed into a chat box verbatim)

Audience: a sharp product manager with no statistics background. No jargon — never say "skewness", "correlation coefficient", "IQR", or "standard deviation"; say what the pattern means instead (e.g. "a few very large orders pull the average up"). Use concrete numbers. Keep it under 350 words."""

    return prompt


def _format_numeric_cols(cols: list[dict]) -> str:
    lines = []
    for c in cols:
        s = c.get("stats") or {}
        lines.append(
            f"- {c['name']}: mean={s.get('mean', '?')}, std={s.get('std', '?')}, "
            f"range=[{s.get('min', '?')} – {s.get('max', '?')}], "
            f"skew={s.get('skewness', '?')}, missing={c['missing_percent']:.1f}%"
        )
    return "\n".join(lines) or "None"


def _format_categorical_cols(cols: list[dict]) -> str:
    lines = []
    for c in cols:
        top = c.get("top_values", [])[:3]
        top_str = ", ".join(f"{t['value']} ({t['count']})" for t in top)
        lines.append(
            f"- {c['name']}: {c['unique_count']} unique, "
            f"missing={c['missing_percent']:.1f}%, top: {top_str}"
        )
    return "\n".join(lines) or "None"


def _format_outliers(outliers: list[dict]) -> str:
    return "\n".join(
        f"- {o['column']}: {o['outlier_count']} outliers ({o['outlier_percent']:.1f}%)"
        for o in outliers
    )
