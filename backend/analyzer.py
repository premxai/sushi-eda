"""
EDA Analyzer — Polars-native for 10-100x speed on large datasets.

Accepts pl.DataFrame (fast path) or pd.DataFrame (auto-converted for
backward compatibility with legacy endpoints).

The correlation matrix is the only step that converts to pandas, because
Polars has no built-in full correlation matrix method.
"""
from __future__ import annotations

from collections import Counter
from typing import TYPE_CHECKING, Any, Union

import numpy as np
import polars as pl

from quality_score import QualityScorer
from type_detector import TypeDetector

if TYPE_CHECKING:
    import pandas as pd


# Polars numeric dtype set (works across 0.19–1.x)
_NUMERIC = {
    pl.Int8, pl.Int16, pl.Int32, pl.Int64,
    pl.UInt8, pl.UInt16, pl.UInt32, pl.UInt64,
    pl.Float32, pl.Float64,
}


def _is_numeric(dtype) -> bool:
    return type(dtype) in _NUMERIC or dtype in _NUMERIC


def _is_string(dtype) -> bool:
    return dtype in (pl.Utf8, pl.String) if hasattr(pl, "String") else dtype == pl.Utf8


class EDAAnalyzer:
    """Exploratory Data Analysis engine — Polars-native."""

    def __init__(self, df: Union[pl.DataFrame, "pd.DataFrame"]):
        if not isinstance(df, pl.DataFrame):
            import pandas as pd
            df = pl.from_pandas(df)
        self.df = df

    # ── public API ────────────────────────────────────────────────────────────

    def basic_info(self) -> dict[str, Any]:
        mem_bytes = self.df.estimated_size()
        return {
            "rows": self.df.height,
            "columns": self.df.width,
            "memory_usage_bytes": mem_bytes,
            "memory_usage_mb": round(mem_bytes / (1024 * 1024), 2),
            "duplicate_rows": self.df.height - self.df.unique().height,
            "total_missing": sum(self.df[col].null_count() for col in self.df.columns),
            "column_names": self.df.columns,
            "dtypes_summary": dict(Counter(str(d) for d in self.df.dtypes)),
        }

    def column_analysis(self) -> list[dict[str, Any]]:
        results = []
        n_rows = self.df.height

        for col in self.df.columns:
            series = self.df[col]
            dtype = series.dtype
            null_count = series.null_count()
            info: dict[str, Any] = {
                "name": col,
                "dtype": str(dtype),
                "missing_count": null_count,
                "missing_percent": round(null_count / n_rows * 100, 2) if n_rows else 0,
                "unique_count": series.n_unique(),
                "is_numeric": _is_numeric(dtype),
            }

            if _is_numeric(dtype) and dtype != pl.Boolean:
                clean = series.drop_nulls()
                if len(clean) > 0:
                    try:
                        skew = clean.skew()
                        skew_val = round(float(skew), 4) if skew is not None else None
                    except Exception:
                        skew_val = None
                    info["stats"] = {
                        "mean": round(float(clean.mean()), 4),
                        "median": round(float(clean.median()), 4),
                        "std": round(float(clean.std()), 4),
                        "min": round(float(clean.min()), 4),
                        "max": round(float(clean.max()), 4),
                        "q1": round(float(clean.quantile(0.25, interpolation="midpoint")), 4),
                        "q3": round(float(clean.quantile(0.75, interpolation="midpoint")), 4),
                        "skewness": skew_val,
                    }
                else:
                    info["stats"] = None
            else:
                vc = series.value_counts(sort=True).head(10)
                val_col = vc.columns[0]
                info["top_values"] = [
                    {"value": str(row[val_col]), "count": int(row["count"])}
                    for row in vc.iter_rows(named=True)
                ]

            results.append(info)
        return results

    def correlation_matrix(self) -> dict[str, Any]:
        numeric_cols = [
            col for col, dtype in zip(self.df.columns, self.df.dtypes)
            if _is_numeric(dtype) and dtype != pl.Boolean
        ]
        if not numeric_cols:
            return {"columns": [], "matrix": []}

        # Convert only the numeric slice to pandas for .corr()
        numeric_pdf = self.df.select(numeric_cols).to_pandas()
        corr = numeric_pdf.corr().fillna(0)
        return {
            "columns": corr.columns.tolist(),
            "matrix": corr.round(4).values.tolist(),
        }

    def detect_outliers(self) -> list[dict[str, Any]]:
        results = []
        numeric_cols = [
            col for col, dtype in zip(self.df.columns, self.df.dtypes)
            if _is_numeric(dtype)
        ]

        for col in numeric_cols:
            clean = self.df[col].drop_nulls()
            if len(clean) == 0:
                continue

            q1 = float(clean.quantile(0.25, interpolation="midpoint"))
            q3 = float(clean.quantile(0.75, interpolation="midpoint"))
            iqr = q3 - q1
            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr

            outlier_mask = (clean < lower_bound) | (clean > upper_bound)
            outlier_count = int(outlier_mask.sum())

            results.append({
                "column": col,
                "outlier_count": outlier_count,
                "outlier_percent": round(outlier_count / len(clean) * 100, 2),
                "lower_bound": round(lower_bound, 4),
                "upper_bound": round(upper_bound, 4),
                "q1": round(q1, 4),
                "q3": round(q3, 4),
                "iqr": round(iqr, 4),
            })
        return results

    def generate_full_report(self) -> dict[str, Any]:
        outliers = self.detect_outliers()
        scorer = QualityScorer(self.df, outliers)
        quality = scorer.calculate_score()
        detector = TypeDetector(self.df)
        type_suggestions = detector.generate_all_suggestions()
        return {
            "basic_info": self.basic_info(),
            "column_analysis": self.column_analysis(),
            "correlation_matrix": self.correlation_matrix(),
            "outliers": outliers,
            "quality_score": quality,
            "type_suggestions": type_suggestions,
        }
