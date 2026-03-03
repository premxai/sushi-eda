"""Data quality scorer — Polars-native."""
from __future__ import annotations

from typing import TYPE_CHECKING, Any, Union

import polars as pl

if TYPE_CHECKING:
    pass

_NUMERIC = {
    pl.Int8, pl.Int16, pl.Int32, pl.Int64,
    pl.UInt8, pl.UInt16, pl.UInt32, pl.UInt64,
    pl.Float32, pl.Float64,
}


def _is_numeric(dtype) -> bool:
    return type(dtype) in _NUMERIC or dtype in _NUMERIC


def _is_string(dtype) -> bool:
    return dtype in (pl.Utf8, pl.String) if hasattr(pl, "String") else dtype == pl.Utf8


class QualityScorer:
    """Calculate data quality score (0-100) with breakdown."""

    def __init__(self, df: Union[pl.DataFrame, "pd.DataFrame"], outliers: list[dict[str, Any]]):
        if not isinstance(df, pl.DataFrame):
            import pandas as pd
            df = pl.from_pandas(df)
        self.df = df
        self.outliers = outliers

    def calculate_score(self) -> dict[str, Any]:
        scores = {}
        weights = {
            "missing_data": 0.30,
            "duplicates": 0.20,
            "outliers": 0.20,
            "type_consistency": 0.15,
            "unique_ratios": 0.15,
        }
        n_rows = self.df.height
        n_cols = self.df.width

        # 1. Missing data
        total_cells = n_rows * n_cols
        missing_cells = sum(self.df[col].null_count() for col in self.df.columns)
        missing_pct = (missing_cells / total_cells * 100) if total_cells > 0 else 0
        scores["missing_data"] = max(0, 100 - missing_pct * 2)

        # 2. Duplicates
        dup_count = n_rows - self.df.unique().height
        dup_pct = (dup_count / n_rows * 100) if n_rows > 0 else 0
        scores["duplicates"] = max(0, 100 - dup_pct * 3)

        # 3. Outliers
        numeric_cols = [col for col, d in zip(self.df.columns, self.df.dtypes) if _is_numeric(d)]
        if numeric_cols and self.outliers:
            total_outliers = sum(o["outlier_count"] for o in self.outliers)
            total_numeric_values = sum(
                n_rows - self.df[col].null_count() for col in numeric_cols
            )
            outlier_pct = (
                total_outliers / total_numeric_values * 100
                if total_numeric_values > 0
                else 0
            )
            scores["outliers"] = max(0, 100 - outlier_pct * 5)
        else:
            scores["outliers"] = 100

        # 4. Type consistency — penalise high-cardinality object columns
        suspicious_count = 0
        for col, dtype in zip(self.df.columns, self.df.dtypes):
            if _is_string(dtype):
                unique_ratio = self.df[col].n_unique() / n_rows if n_rows else 0
                if unique_ratio < 0.05:
                    suspicious_count += 1
        type_penalty = (suspicious_count / n_cols * 100) if n_cols > 0 else 0
        scores["type_consistency"] = max(0, 100 - type_penalty * 2)

        # 5. Constant columns
        constant_cols = sum(
            1 for col in self.df.columns if self.df[col].n_unique() <= 1
        )
        constant_pct = (constant_cols / n_cols * 100) if n_cols > 0 else 0
        scores["unique_ratios"] = max(0, 100 - constant_pct * 10)

        overall = sum(scores[k] * weights[k] for k in weights)

        return {
            "overall_score": round(overall, 1),
            "grade": self._get_grade(overall),
            "breakdown": {
                "missing_data": {
                    "score": round(scores["missing_data"], 1),
                    "weight": weights["missing_data"],
                    "details": f"{missing_pct:.1f}% of cells are missing",
                },
                "duplicates": {
                    "score": round(scores["duplicates"], 1),
                    "weight": weights["duplicates"],
                    "details": f"{dup_count} duplicate rows ({dup_pct:.1f}%)",
                },
                "outliers": {
                    "score": round(scores["outliers"], 1),
                    "weight": weights["outliers"],
                    "details": (
                        f"{sum(o['outlier_count'] for o in self.outliers)} outliers detected"
                        if self.outliers
                        else "No numeric columns"
                    ),
                },
                "type_consistency": {
                    "score": round(scores["type_consistency"], 1),
                    "weight": weights["type_consistency"],
                    "details": f"{suspicious_count} columns with suboptimal types",
                },
                "unique_ratios": {
                    "score": round(scores["unique_ratios"], 1),
                    "weight": weights["unique_ratios"],
                    "details": f"{constant_cols} constant columns",
                },
            },
            "recommendations": self._get_recommendations(
                scores, missing_pct, dup_pct, constant_cols
            ),
        }

    def _get_grade(self, score: float) -> str:
        if score >= 90:
            return "A"
        elif score >= 80:
            return "B"
        elif score >= 70:
            return "C"
        elif score >= 60:
            return "D"
        return "F"

    def _get_recommendations(
        self, scores: dict, missing_pct: float, dup_pct: float, constant_cols: int
    ) -> list[str]:
        recs = []
        if scores["missing_data"] < 80:
            recs.append(
                f"High missing data ({missing_pct:.1f}%). "
                "Consider imputation or dropping sparse columns."
            )
        if scores["duplicates"] < 90 and dup_pct > 1:
            recs.append(f"Remove {int(dup_pct)}% duplicate rows to improve data quality.")
        if scores["outliers"] < 80:
            recs.append(
                "Significant outliers detected. "
                "Review outlier section and consider capping or removal."
            )
        if scores["type_consistency"] < 80:
            recs.append(
                "Some columns have suboptimal data types. "
                "Consider converting low-cardinality strings to categorical."
            )
        if constant_cols > 0:
            recs.append(
                f"Remove {constant_cols} constant column(s) — they provide no information."
            )
        if not recs:
            recs.append("Data quality is excellent! No major issues detected.")
        return recs
