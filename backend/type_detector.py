import pandas as pd
import numpy as np
from typing import Any
import re
from dateutil import parser


class TypeDetector:
    """Detect better data types and suggest conversions."""

    def __init__(self, df: pd.DataFrame):
        self.df = df

    def detect_datetime_columns(self) -> list[dict[str, Any]]:
        """Detect columns that should be datetime but are stored as strings."""
        suggestions = []
        
        for col in self.df.columns:
            if self.df[col].dtype == "object":
                # Sample non-null values
                sample = self.df[col].dropna().head(100)
                if len(sample) == 0:
                    continue
                
                # Try parsing as datetime
                parsed_count = 0
                for val in sample:
                    try:
                        parser.parse(str(val))
                        parsed_count += 1
                    except (ValueError, TypeError, parser.ParserError):
                        pass
                
                # If >80% parse successfully, suggest datetime
                if parsed_count / len(sample) > 0.8:
                    suggestions.append({
                        "column": col,
                        "current_type": "object",
                        "suggested_type": "datetime64",
                        "reason": f"{parsed_count}/{len(sample)} values parse as dates",
                        "confidence": round(parsed_count / len(sample) * 100, 1),
                    })
        
        return suggestions

    def detect_categorical_columns(self) -> list[dict[str, Any]]:
        """Detect low-cardinality string columns that should be categorical."""
        suggestions = []
        
        for col in self.df.columns:
            if self.df[col].dtype == "object":
                unique_ratio = self.df[col].nunique() / len(self.df)
                
                # If <5% unique values, suggest categorical
                if unique_ratio < 0.05 and self.df[col].nunique() > 1:
                    memory_savings = self._estimate_categorical_savings(col)
                    suggestions.append({
                        "column": col,
                        "current_type": "object",
                        "suggested_type": "category",
                        "reason": f"Only {self.df[col].nunique()} unique values ({unique_ratio*100:.1f}%)",
                        "unique_count": int(self.df[col].nunique()),
                        "unique_ratio": round(unique_ratio * 100, 2),
                        "memory_savings_mb": memory_savings,
                    })
        
        return suggestions

    def detect_numeric_strings(self) -> list[dict[str, Any]]:
        """Detect string columns that contain only numeric values."""
        suggestions = []
        
        for col in self.df.columns:
            if self.df[col].dtype == "object":
                sample = self.df[col].dropna().head(100)
                if len(sample) == 0:
                    continue
                
                # Check if all values are numeric
                numeric_count = 0
                has_decimals = False
                for val in sample:
                    try:
                        float_val = float(str(val).replace(",", ""))
                        numeric_count += 1
                        if "." in str(val):
                            has_decimals = True
                    except (ValueError, TypeError):
                        pass
                
                if numeric_count / len(sample) > 0.95:
                    suggested_type = "float64" if has_decimals else "int64"
                    suggestions.append({
                        "column": col,
                        "current_type": "object",
                        "suggested_type": suggested_type,
                        "reason": f"{numeric_count}/{len(sample)} values are numeric",
                        "confidence": round(numeric_count / len(sample) * 100, 1),
                    })
        
        return suggestions

    def detect_boolean_columns(self) -> list[dict[str, Any]]:
        """Detect columns with only 2 unique values that could be boolean."""
        suggestions = []
        
        for col in self.df.columns:
            if self.df[col].dtype == "object":
                unique_vals = set(self.df[col].dropna().unique())
                
                # Check for common boolean patterns
                bool_patterns = [
                    {"true", "false"},
                    {"yes", "no"},
                    {"y", "n"},
                    {"1", "0"},
                    {"t", "f"},
                ]
                
                unique_lower = {str(v).lower() for v in unique_vals}
                
                if len(unique_vals) == 2 and unique_lower in bool_patterns:
                    suggestions.append({
                        "column": col,
                        "current_type": "object",
                        "suggested_type": "bool",
                        "reason": f"Only 2 values: {', '.join(map(str, unique_vals))}",
                        "values": list(unique_vals),
                    })
        
        return suggestions

    def _estimate_categorical_savings(self, col: str) -> float:
        """Estimate memory savings from converting to categorical."""
        current_memory = self.df[col].memory_usage(deep=True)
        # Categorical uses int codes + unique values
        estimated_categorical = (
            len(self.df) * 2  # 2 bytes per code (int16)
            + self.df[col].nunique() * 50  # ~50 bytes per unique string
        )
        savings_mb = (current_memory - estimated_categorical) / (1024 * 1024)
        return round(max(0, savings_mb), 2)

    def convert_types(self, suggestions: list[dict[str, Any]]) -> pd.DataFrame:
        """Apply suggested type conversions and return new DataFrame."""
        df_converted = self.df.copy()
        
        for sug in suggestions:
            col = sug["column"]
            target_type = sug["suggested_type"]
            
            try:
                if target_type == "datetime64":
                    df_converted[col] = pd.to_datetime(df_converted[col], errors="coerce")
                elif target_type == "category":
                    df_converted[col] = df_converted[col].astype("category")
                elif target_type in ("int64", "float64"):
                    df_converted[col] = pd.to_numeric(
                        df_converted[col].str.replace(",", ""), errors="coerce"
                    )
                    if target_type == "int64":
                        df_converted[col] = df_converted[col].astype("Int64")  # Nullable int
                elif target_type == "bool":
                    # Map common boolean values
                    true_vals = {"true", "yes", "y", "1", "t"}
                    df_converted[col] = df_converted[col].str.lower().isin(true_vals)
            except Exception:
                # Skip if conversion fails
                pass
        
        return df_converted

    def generate_all_suggestions(self) -> dict[str, Any]:
        """Generate all type suggestions."""
        return {
            "datetime_suggestions": self.detect_datetime_columns(),
            "categorical_suggestions": self.detect_categorical_columns(),
            "numeric_suggestions": self.detect_numeric_strings(),
            "boolean_suggestions": self.detect_boolean_columns(),
        }
