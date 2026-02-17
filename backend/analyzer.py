import pandas as pd
import numpy as np
from scipy import stats
from typing import Any

from quality_score import QualityScorer
from type_detector import TypeDetector


class EDAAnalyzer:
    """Exploratory Data Analysis engine for tabular datasets."""

    def __init__(self, df: pd.DataFrame):
        self.df = df

    def basic_info(self) -> dict[str, Any]:
        return {
            "rows": int(self.df.shape[0]),
            "columns": int(self.df.shape[1]),
            "memory_usage_bytes": int(self.df.memory_usage(deep=True).sum()),
            "memory_usage_mb": round(
                self.df.memory_usage(deep=True).sum() / (1024 * 1024), 2
            ),
            "duplicate_rows": int(self.df.duplicated().sum()),
            "total_missing": int(self.df.isnull().sum().sum()),
            "column_names": self.df.columns.tolist(),
            "dtypes_summary": self.df.dtypes.astype(str).value_counts().to_dict(),
        }

    def column_analysis(self) -> list[dict[str, Any]]:
        results = []
        for col in self.df.columns:
            series = self.df[col]
            info: dict[str, Any] = {
                "name": col,
                "dtype": str(series.dtype),
                "missing_count": int(series.isnull().sum()),
                "missing_percent": round(
                    series.isnull().sum() / len(series) * 100, 2
                ),
                "unique_count": int(series.nunique()),
                "is_numeric": pd.api.types.is_numeric_dtype(series),
            }

            # Skip boolean columns for numeric stats (they cause numpy errors)
            if pd.api.types.is_numeric_dtype(series) and series.dtype != 'bool':
                clean = series.dropna()
                if len(clean) > 0:
                    info["stats"] = {
                        "mean": round(float(clean.mean()), 4),
                        "median": round(float(clean.median()), 4),
                        "std": round(float(clean.std()), 4),
                        "min": round(float(clean.min()), 4),
                        "max": round(float(clean.max()), 4),
                        "q1": round(float(clean.quantile(0.25)), 4),
                        "q3": round(float(clean.quantile(0.75)), 4),
                        "skewness": round(float(stats.skew(clean, nan_policy="omit")), 4),
                    }
                else:
                    info["stats"] = None
            else:
                value_counts = series.value_counts().head(10)
                info["top_values"] = [
                    {"value": str(k), "count": int(v)}
                    for k, v in value_counts.items()
                ]

            results.append(info)
        return results

    def correlation_matrix(self) -> dict[str, Any]:
        # Exclude boolean columns from correlation (they cause numpy errors)
        numeric_df = self.df.select_dtypes(include=[np.number]).select_dtypes(exclude=['bool'])
        if numeric_df.empty:
            return {"columns": [], "matrix": []}

        corr = numeric_df.corr()
        return {
            "columns": corr.columns.tolist(),
            "matrix": corr.round(4).values.tolist(),
        }

    def detect_outliers(self) -> list[dict[str, Any]]:
        results = []
        numeric_cols = self.df.select_dtypes(include=[np.number]).columns

        for col in numeric_cols:
            clean = self.df[col].dropna()
            if len(clean) == 0:
                continue

            q1 = float(clean.quantile(0.25))
            q3 = float(clean.quantile(0.75))
            iqr = q3 - q1
            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr

            outlier_mask = (clean < lower_bound) | (clean > upper_bound)
            outlier_count = int(outlier_mask.sum())

            results.append(
                {
                    "column": col,
                    "outlier_count": outlier_count,
                    "outlier_percent": round(outlier_count / len(clean) * 100, 2),
                    "lower_bound": round(lower_bound, 4),
                    "upper_bound": round(upper_bound, 4),
                    "q1": round(q1, 4),
                    "q3": round(q3, 4),
                    "iqr": round(iqr, 4),
                }
            )
        return results

    def generate_full_report(self) -> dict[str, Any]:
        outliers = self.detect_outliers()
        
        # Calculate quality score
        scorer = QualityScorer(self.df, outliers)
        quality = scorer.calculate_score()
        
        # Detect type suggestions
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
