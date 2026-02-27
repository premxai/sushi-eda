"""Data cleaning and transformation engine."""

import pandas as pd
import numpy as np
from typing import Any


class DataCleaner:
    """Applies cleaning operations to a DataFrame and tracks what changed."""

    def __init__(self, df: pd.DataFrame):
        self.df = df.copy()
        self.original_shape = df.shape
        self.log: list[str] = []

    # ── Missing value handling ────────────────────────────────────────

    def drop_missing_rows(self, threshold: float = 0.0) -> "DataCleaner":
        """Drop rows where missing % > threshold (0.0 = any missing)."""
        before = len(self.df)
        if threshold == 0.0:
            self.df = self.df.dropna()
        else:
            min_valid = int((1 - threshold) * len(self.df.columns))
            self.df = self.df.dropna(thresh=min_valid)
        dropped = before - len(self.df)
        self.log.append(f"Dropped {dropped} rows with missing values")
        return self

    def drop_missing_columns(self, threshold: float = 0.5) -> "DataCleaner":
        """Drop columns where missing % > threshold (default 50%)."""
        before = len(self.df.columns)
        missing_pct = self.df.isnull().mean()
        cols_to_drop = missing_pct[missing_pct > threshold].index.tolist()
        self.df = self.df.drop(columns=cols_to_drop)
        self.log.append(f"Dropped {len(cols_to_drop)} columns with >{threshold*100:.0f}% missing: {cols_to_drop}")
        return self

    def impute_mean(self, columns: list[str] | None = None) -> "DataCleaner":
        """Fill missing numeric values with column mean."""
        cols = columns or self.df.select_dtypes(include=[np.number]).columns.tolist()
        for col in cols:
            if col in self.df.columns and self.df[col].isnull().any():
                mean_val = self.df[col].mean()
                count = self.df[col].isnull().sum()
                self.df[col] = self.df[col].fillna(mean_val)
                self.log.append(f"Imputed {count} missing values in '{col}' with mean ({mean_val:.4f})")
        return self

    def impute_median(self, columns: list[str] | None = None) -> "DataCleaner":
        """Fill missing numeric values with column median."""
        cols = columns or self.df.select_dtypes(include=[np.number]).columns.tolist()
        for col in cols:
            if col in self.df.columns and self.df[col].isnull().any():
                median_val = self.df[col].median()
                count = self.df[col].isnull().sum()
                self.df[col] = self.df[col].fillna(median_val)
                self.log.append(f"Imputed {count} missing values in '{col}' with median ({median_val:.4f})")
        return self

    def impute_mode(self, columns: list[str] | None = None) -> "DataCleaner":
        """Fill missing categorical values with column mode."""
        cols = columns or self.df.select_dtypes(include=["object", "category"]).columns.tolist()
        for col in cols:
            if col in self.df.columns and self.df[col].isnull().any():
                mode_vals = self.df[col].mode()
                if len(mode_vals) == 0:
                    continue
                mode_val = mode_vals[0]
                count = self.df[col].isnull().sum()
                self.df[col] = self.df[col].fillna(mode_val)
                self.log.append(f"Imputed {count} missing values in '{col}' with mode ('{mode_val}')")
        return self

    def impute_constant(self, value: Any, columns: list[str] | None = None) -> "DataCleaner":
        """Fill missing values with a constant."""
        cols = columns or self.df.columns.tolist()
        for col in cols:
            if col in self.df.columns and self.df[col].isnull().any():
                count = self.df[col].isnull().sum()
                self.df[col] = self.df[col].fillna(value)
                self.log.append(f"Imputed {count} missing values in '{col}' with constant '{value}'")
        return self

    def impute_forward_fill(self, columns: list[str] | None = None) -> "DataCleaner":
        """Forward-fill missing values (useful for time series)."""
        cols = columns or self.df.columns.tolist()
        for col in cols:
            if col in self.df.columns and self.df[col].isnull().any():
                count = self.df[col].isnull().sum()
                self.df[col] = self.df[col].ffill()
                self.log.append(f"Forward-filled {count} missing values in '{col}'")
        return self

    # ── Duplicates ───────────────────────────────────────────────────

    def remove_duplicates(self, subset: list[str] | None = None, keep: str = "first") -> "DataCleaner":
        """Remove duplicate rows."""
        before = len(self.df)
        self.df = self.df.drop_duplicates(subset=subset, keep=keep)
        removed = before - len(self.df)
        scope = f"columns {subset}" if subset else "all columns"
        self.log.append(f"Removed {removed} duplicate rows (based on {scope}, keep='{keep}')")
        return self

    # ── Outlier treatment ────────────────────────────────────────────

    def cap_outliers_iqr(self, columns: list[str] | None = None, factor: float = 1.5) -> "DataCleaner":
        """Cap outliers at IQR whisker bounds (Winsorization)."""
        cols = columns or self.df.select_dtypes(include=[np.number]).columns.tolist()
        for col in cols:
            if col not in self.df.columns:
                continue
            q1 = self.df[col].quantile(0.25)
            q3 = self.df[col].quantile(0.75)
            iqr = q3 - q1
            lower = q1 - factor * iqr
            upper = q3 + factor * iqr
            n_capped = int(((self.df[col] < lower) | (self.df[col] > upper)).sum())
            self.df[col] = self.df[col].clip(lower=lower, upper=upper)
            self.log.append(f"Capped {n_capped} outliers in '{col}' to [{lower:.4f}, {upper:.4f}]")
        return self

    def remove_outliers_iqr(self, columns: list[str] | None = None, factor: float = 1.5) -> "DataCleaner":
        """Remove rows where any of the specified columns have outlier values."""
        cols = columns or self.df.select_dtypes(include=[np.number]).columns.tolist()
        before = len(self.df)
        mask = pd.Series([True] * len(self.df), index=self.df.index)
        for col in cols:
            if col not in self.df.columns:
                continue
            q1 = self.df[col].quantile(0.25)
            q3 = self.df[col].quantile(0.75)
            iqr = q3 - q1
            lower = q1 - factor * iqr
            upper = q3 + factor * iqr
            mask &= (self.df[col] >= lower) & (self.df[col] <= upper)
        self.df = self.df[mask]
        removed = before - len(self.df)
        self.log.append(f"Removed {removed} rows with outliers in columns: {cols}")
        return self

    # ── Type casting ─────────────────────────────────────────────────

    def cast_to_datetime(self, columns: list[str]) -> "DataCleaner":
        """Convert columns to datetime."""
        for col in columns:
            if col not in self.df.columns:
                continue
            try:
                self.df[col] = pd.to_datetime(self.df[col], errors="coerce")
                self.log.append(f"Cast '{col}' to datetime")
            except Exception as e:
                self.log.append(f"Failed to cast '{col}' to datetime: {e}")
        return self

    def cast_to_numeric(self, columns: list[str]) -> "DataCleaner":
        """Convert columns to numeric, coercing errors to NaN."""
        for col in columns:
            if col not in self.df.columns:
                continue
            try:
                self.df[col] = pd.to_numeric(self.df[col], errors="coerce")
                self.log.append(f"Cast '{col}' to numeric")
            except Exception as e:
                self.log.append(f"Failed to cast '{col}' to numeric: {e}")
        return self

    def cast_to_categorical(self, columns: list[str]) -> "DataCleaner":
        """Convert columns to categorical dtype."""
        for col in columns:
            if col not in self.df.columns:
                continue
            self.df[col] = self.df[col].astype("category")
            self.log.append(f"Cast '{col}' to category")
        return self

    # ── String cleaning ──────────────────────────────────────────────

    def strip_whitespace(self, columns: list[str] | None = None) -> "DataCleaner":
        """Strip leading/trailing whitespace from string columns."""
        cols = columns or self.df.select_dtypes(include=["object"]).columns.tolist()
        for col in cols:
            if col in self.df.columns:
                self.df[col] = self.df[col].astype(str).str.strip()
        self.log.append(f"Stripped whitespace from {len(cols)} string columns")
        return self

    def to_lowercase(self, columns: list[str] | None = None) -> "DataCleaner":
        """Lowercase all string columns."""
        cols = columns or self.df.select_dtypes(include=["object"]).columns.tolist()
        for col in cols:
            if col in self.df.columns:
                self.df[col] = self.df[col].str.lower()
        self.log.append(f"Lowercased {len(cols)} string columns")
        return self

    def drop_constant_columns(self) -> "DataCleaner":
        """Drop columns with only one unique value."""
        constant_cols = [col for col in self.df.columns if self.df[col].nunique() <= 1]
        self.df = self.df.drop(columns=constant_cols)
        self.log.append(f"Dropped {len(constant_cols)} constant columns: {constant_cols}")
        return self

    def rename_columns_snake_case(self) -> "DataCleaner":
        """Rename columns to snake_case."""
        import re
        new_names = {}
        for col in self.df.columns:
            new = re.sub(r"[\s\-\.]+", "_", str(col))
            new = re.sub(r"[^\w]", "", new)
            new = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1_\2", new)
            new = re.sub(r"([a-z\d])([A-Z])", r"\1_\2", new)
            new = new.lower().strip("_")
            new_names[col] = new
        self.df = self.df.rename(columns=new_names)
        self.log.append(f"Renamed columns to snake_case")
        return self

    def result(self) -> dict[str, Any]:
        """Return cleaned DataFrame summary."""
        from analyzer import EDAAnalyzer
        analyzer = EDAAnalyzer(self.df)
        report = analyzer.generate_full_report()
        preview = self.df.head(50).fillna("").to_dict(orient="records")
        report["preview"] = preview
        return {
            "report": report,
            "cleaning_log": self.log,
            "rows_before": self.original_shape[0],
            "rows_after": int(self.df.shape[0]),
            "cols_before": self.original_shape[1],
            "cols_after": int(self.df.shape[1]),
            "rows_removed": self.original_shape[0] - int(self.df.shape[0]),
            "cols_removed": self.original_shape[1] - int(self.df.shape[1]),
        }


class DataTransformer:
    """Applies feature engineering and transformation operations."""

    def __init__(self, df: pd.DataFrame):
        self.df = df.copy()
        self.log: list[str] = []

    def log_transform(self, columns: list[str], handle_zeros: bool = True) -> "DataTransformer":
        """Apply log1p transform to reduce right skew."""
        for col in columns:
            if col not in self.df.columns:
                continue
            if handle_zeros:
                min_val = self.df[col].min()
                if min_val <= 0:
                    shift = abs(min_val) + 1
                    self.df[f"{col}_log"] = np.log1p(self.df[col] + shift)
                    self.log.append(f"Log-transformed '{col}' (shifted by {shift:.4f}) → '{col}_log'")
                else:
                    self.df[f"{col}_log"] = np.log1p(self.df[col])
                    self.log.append(f"Log-transformed '{col}' → '{col}_log'")
            else:
                self.df[f"{col}_log"] = np.log(self.df[col])
                self.log.append(f"Log-transformed '{col}' → '{col}_log'")
        return self

    def normalize_minmax(self, columns: list[str]) -> "DataTransformer":
        """Min-max normalize to [0, 1]."""
        for col in columns:
            if col not in self.df.columns:
                continue
            col_min = self.df[col].min()
            col_max = self.df[col].max()
            if col_max == col_min:
                self.df[f"{col}_norm"] = 0.0
            else:
                self.df[f"{col}_norm"] = (self.df[col] - col_min) / (col_max - col_min)
            self.log.append(f"Min-max normalized '{col}' → '{col}_norm'")
        return self

    def standardize_zscore(self, columns: list[str]) -> "DataTransformer":
        """Z-score standardize (mean=0, std=1)."""
        for col in columns:
            if col not in self.df.columns:
                continue
            mean = self.df[col].mean()
            std = self.df[col].std()
            if std == 0:
                self.df[f"{col}_std"] = 0.0
            else:
                self.df[f"{col}_std"] = (self.df[col] - mean) / std
            self.log.append(f"Z-score standardized '{col}' → '{col}_std' (mean={mean:.4f}, std={std:.4f})")
        return self

    def bin_equal_width(self, column: str, n_bins: int = 5, labels: list[str] | None = None) -> "DataTransformer":
        """Bin a numeric column into equal-width buckets."""
        if column not in self.df.columns:
            return self
        new_col = f"{column}_bin"
        self.df[new_col] = pd.cut(self.df[column], bins=n_bins, labels=labels)
        self.log.append(f"Binned '{column}' into {n_bins} equal-width bins → '{new_col}'")
        return self

    def bin_equal_frequency(self, column: str, n_bins: int = 5) -> "DataTransformer":
        """Bin a numeric column into equal-frequency (quantile) buckets."""
        if column not in self.df.columns:
            return self
        new_col = f"{column}_qbin"
        self.df[new_col] = pd.qcut(self.df[column], q=n_bins, labels=False, duplicates="drop")
        self.log.append(f"Quantile-binned '{column}' into {n_bins} buckets → '{new_col}'")
        return self

    def one_hot_encode(self, columns: list[str], max_cardinality: int = 20) -> "DataTransformer":
        """One-hot encode low-cardinality categorical columns."""
        for col in columns:
            if col not in self.df.columns:
                continue
            n_unique = self.df[col].nunique()
            if n_unique > max_cardinality:
                self.log.append(f"Skipped OHE for '{col}': {n_unique} unique values > max {max_cardinality}")
                continue
            dummies = pd.get_dummies(self.df[col], prefix=col, drop_first=False)
            self.df = pd.concat([self.df, dummies], axis=1)
            self.log.append(f"One-hot encoded '{col}' → {list(dummies.columns)}")
        return self

    def label_encode(self, columns: list[str]) -> "DataTransformer":
        """Label-encode categorical columns to integers."""
        for col in columns:
            if col not in self.df.columns:
                continue
            self.df[f"{col}_enc"] = self.df[col].astype("category").cat.codes
            mapping = dict(enumerate(self.df[col].astype("category").cat.categories))
            self.log.append(f"Label-encoded '{col}' → '{col}_enc' (mapping: {mapping})")
        return self

    def extract_datetime_features(self, columns: list[str]) -> "DataTransformer":
        """Extract year, month, day, dayofweek, hour from datetime columns."""
        for col in columns:
            if col not in self.df.columns:
                continue
            try:
                dt = pd.to_datetime(self.df[col], errors="coerce")
                self.df[f"{col}_year"] = dt.dt.year
                self.df[f"{col}_month"] = dt.dt.month
                self.df[f"{col}_day"] = dt.dt.day
                self.df[f"{col}_dayofweek"] = dt.dt.dayofweek
                self.df[f"{col}_hour"] = dt.dt.hour
                self.log.append(f"Extracted datetime features from '{col}'")
            except Exception as e:
                self.log.append(f"Failed datetime extraction for '{col}': {e}")
        return self

    def result(self) -> dict[str, Any]:
        from analyzer import EDAAnalyzer
        analyzer = EDAAnalyzer(self.df)
        report = analyzer.generate_full_report()
        preview = self.df.head(50).fillna("").to_dict(orient="records")
        report["preview"] = preview
        return {
            "report": report,
            "transform_log": self.log,
            "new_columns": [c for c in self.df.columns if c not in self.df.columns],
            "total_columns": int(self.df.shape[1]),
        }
