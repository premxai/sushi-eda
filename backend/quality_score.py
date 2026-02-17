import pandas as pd
import numpy as np
from typing import Any


class QualityScorer:
    """Calculate data quality score (0-100) with breakdown."""

    def __init__(self, df: pd.DataFrame, outliers: list[dict[str, Any]]):
        self.df = df
        self.outliers = outliers

    def calculate_score(self) -> dict[str, Any]:
        """
        Calculate overall quality score based on:
        - Missing data (30%)
        - Duplicates (20%)
        - Outliers (20%)
        - Type consistency (15%)
        - Unique value ratios (15%)
        """
        scores = {}
        weights = {
            "missing_data": 0.30,
            "duplicates": 0.20,
            "outliers": 0.20,
            "type_consistency": 0.15,
            "unique_ratios": 0.15,
        }

        # 1. Missing data score (0-100, higher is better)
        total_cells = self.df.shape[0] * self.df.shape[1]
        missing_cells = int(self.df.isnull().sum().sum())
        missing_pct = (missing_cells / total_cells * 100) if total_cells > 0 else 0
        scores["missing_data"] = max(0, 100 - missing_pct * 2)  # Penalize heavily

        # 2. Duplicates score
        dup_count = int(self.df.duplicated().sum())
        dup_pct = (dup_count / len(self.df) * 100) if len(self.df) > 0 else 0
        scores["duplicates"] = max(0, 100 - dup_pct * 3)

        # 3. Outliers score
        numeric_cols = self.df.select_dtypes(include=[np.number]).columns
        if len(numeric_cols) > 0 and len(self.outliers) > 0:
            total_outliers = sum(o["outlier_count"] for o in self.outliers)
            total_numeric_values = sum(
                self.df[col].notna().sum() for col in numeric_cols
            )
            outlier_pct = (
                (total_outliers / total_numeric_values * 100)
                if total_numeric_values > 0
                else 0
            )
            scores["outliers"] = max(0, 100 - outlier_pct * 5)
        else:
            scores["outliers"] = 100  # No numeric columns = no outlier penalty

        # 4. Type consistency score
        # Penalize if many columns have mixed types or suspicious dtypes
        suspicious_count = 0
        for col in self.df.columns:
            dtype = str(self.df[col].dtype)
            # Object dtype often means mixed types or unoptimized strings
            if dtype == "object":
                unique_ratio = self.df[col].nunique() / len(self.df)
                # Low unique ratio but stored as object = should be categorical
                if unique_ratio < 0.05:
                    suspicious_count += 1
        type_penalty = (suspicious_count / len(self.df.columns) * 100) if len(self.df.columns) > 0 else 0
        scores["type_consistency"] = max(0, 100 - type_penalty * 2)

        # 5. Unique value ratios score
        # Penalize constant columns (0 or 1 unique values)
        constant_cols = sum(1 for col in self.df.columns if self.df[col].nunique() <= 1)
        constant_pct = (constant_cols / len(self.df.columns) * 100) if len(self.df.columns) > 0 else 0
        scores["unique_ratios"] = max(0, 100 - constant_pct * 10)

        # Calculate weighted overall score
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
            "recommendations": self._get_recommendations(scores, missing_pct, dup_pct, constant_cols),
        }

    def _get_grade(self, score: float) -> str:
        """Convert numeric score to letter grade."""
        if score >= 90:
            return "A"
        elif score >= 80:
            return "B"
        elif score >= 70:
            return "C"
        elif score >= 60:
            return "D"
        else:
            return "F"

    def _get_recommendations(
        self, scores: dict[str, float], missing_pct: float, dup_pct: float, constant_cols: int
    ) -> list[str]:
        """Generate actionable recommendations based on scores."""
        recs = []

        if scores["missing_data"] < 80:
            recs.append(f"High missing data ({missing_pct:.1f}%). Consider imputation or dropping sparse columns.")

        if scores["duplicates"] < 90 and dup_pct > 1:
            recs.append(f"Remove {int(dup_pct)}% duplicate rows to improve data quality.")

        if scores["outliers"] < 80:
            recs.append("Significant outliers detected. Review outlier section and consider capping or removal.")

        if scores["type_consistency"] < 80:
            recs.append("Some columns have suboptimal data types. Consider converting low-cardinality strings to categorical.")

        if constant_cols > 0:
            recs.append(f"Remove {constant_cols} constant column(s) — they provide no information.")

        if not recs:
            recs.append("Data quality is excellent! No major issues detected.")

        return recs
