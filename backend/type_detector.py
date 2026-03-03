"""Type detector — Polars-native."""
from __future__ import annotations

from typing import TYPE_CHECKING, Any, Union

import polars as pl
from dateutil import parser as dateutil_parser

if TYPE_CHECKING:
    pass


def _is_string(dtype) -> bool:
    return dtype in (pl.Utf8, pl.String) if hasattr(pl, "String") else dtype == pl.Utf8


class TypeDetector:
    """Detect better data types and suggest conversions."""

    def __init__(self, df: Union[pl.DataFrame, "pd.DataFrame"]):
        if not isinstance(df, pl.DataFrame):
            import pandas as pd
            df = pl.from_pandas(df)
        self.df = df

    # ── detectors ─────────────────────────────────────────────────────────────

    def detect_datetime_columns(self) -> list[dict[str, Any]]:
        suggestions = []
        for col in self.df.columns:
            if not _is_string(self.df[col].dtype):
                continue
            sample = self.df[col].drop_nulls().head(100)
            if len(sample) == 0:
                continue
            parsed_count = 0
            for val in sample.to_list():
                try:
                    dateutil_parser.parse(str(val))
                    parsed_count += 1
                except (ValueError, TypeError, dateutil_parser.ParserError):
                    pass
            if parsed_count / len(sample) > 0.8:
                suggestions.append({
                    "column": col,
                    "current_type": "string",
                    "suggested_type": "datetime",
                    "reason": f"{parsed_count}/{len(sample)} values parse as dates",
                    "confidence": round(parsed_count / len(sample) * 100, 1),
                })
        return suggestions

    def detect_categorical_columns(self) -> list[dict[str, Any]]:
        suggestions = []
        n_rows = self.df.height
        for col in self.df.columns:
            if not _is_string(self.df[col].dtype):
                continue
            n_unique = self.df[col].n_unique()
            unique_ratio = n_unique / n_rows if n_rows else 0
            if unique_ratio < 0.05 and n_unique > 1:
                memory_savings = self._estimate_categorical_savings(col)
                suggestions.append({
                    "column": col,
                    "current_type": "string",
                    "suggested_type": "category",
                    "reason": f"Only {n_unique} unique values ({unique_ratio*100:.1f}%)",
                    "unique_count": n_unique,
                    "unique_ratio": round(unique_ratio * 100, 2),
                    "memory_savings_mb": memory_savings,
                })
        return suggestions

    def detect_numeric_strings(self) -> list[dict[str, Any]]:
        suggestions = []
        for col in self.df.columns:
            if not _is_string(self.df[col].dtype):
                continue
            sample = self.df[col].drop_nulls().head(100)
            if len(sample) == 0:
                continue
            numeric_count = 0
            has_decimals = False
            for val in sample.to_list():
                try:
                    float(str(val).replace(",", ""))
                    numeric_count += 1
                    if "." in str(val):
                        has_decimals = True
                except (ValueError, TypeError):
                    pass
            if numeric_count / len(sample) > 0.95:
                suggested_type = "float64" if has_decimals else "int64"
                suggestions.append({
                    "column": col,
                    "current_type": "string",
                    "suggested_type": suggested_type,
                    "reason": f"{numeric_count}/{len(sample)} values are numeric",
                    "confidence": round(numeric_count / len(sample) * 100, 1),
                })
        return suggestions

    def detect_boolean_columns(self) -> list[dict[str, Any]]:
        suggestions = []
        bool_patterns = [
            {"true", "false"}, {"yes", "no"}, {"y", "n"},
            {"1", "0"}, {"t", "f"},
        ]
        for col in self.df.columns:
            if not _is_string(self.df[col].dtype):
                continue
            unique_vals_raw = self.df[col].drop_nulls().unique().to_list()
            if len(unique_vals_raw) != 2:
                continue
            unique_lower = {str(v).lower() for v in unique_vals_raw}
            if unique_lower in bool_patterns:
                suggestions.append({
                    "column": col,
                    "current_type": "string",
                    "suggested_type": "bool",
                    "reason": f"Only 2 values: {', '.join(map(str, unique_vals_raw))}",
                    "values": list(unique_vals_raw),
                })
        return suggestions

    # ── helpers ───────────────────────────────────────────────────────────────

    def _estimate_categorical_savings(self, col: str) -> float:
        series = self.df[col]
        current_memory = series.estimated_size()         # bytes
        estimated_categorical = (
            self.df.height * 2                           # 2 bytes per int16 code
            + series.n_unique() * 50                     # ~50 bytes per unique string
        )
        savings_mb = (current_memory - estimated_categorical) / (1024 * 1024)
        return round(max(0, savings_mb), 2)

    def generate_all_suggestions(self) -> dict[str, Any]:
        return {
            "datetime_suggestions": self.detect_datetime_columns(),
            "categorical_suggestions": self.detect_categorical_columns(),
            "numeric_suggestions": self.detect_numeric_strings(),
            "boolean_suggestions": self.detect_boolean_columns(),
        }
