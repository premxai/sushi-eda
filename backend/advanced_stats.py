"""Advanced statistical analysis including hypothesis testing and regression."""

import pandas as pd
import numpy as np
from scipy import stats
from typing import Any, Dict, List, Optional
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score, mean_squared_error


class AdvancedStatistics:
    """Performs advanced statistical analysis on DataFrames."""

    def __init__(self, df: pd.DataFrame):
        self.df = df

    def t_test_independent(self, col1: str, col2: str) -> Dict[str, Any]:
        """Perform independent t-test between two numeric columns."""
        if col1 not in self.df.columns or col2 not in self.df.columns:
            return {"error": "Column not found"}

        data1 = self.df[col1].dropna()
        data2 = self.df[col2].dropna()

        if not pd.api.types.is_numeric_dtype(data1) or not pd.api.types.is_numeric_dtype(data2):
            return {"error": "Both columns must be numeric"}

        if len(data1) < 2 or len(data2) < 2:
            return {"error": "Insufficient data for t-test"}

        statistic, p_value = stats.ttest_ind(data1, data2)

        return {
            "test": "Independent t-test",
            "column1": col1,
            "column2": col2,
            "statistic": float(statistic),
            "p_value": float(p_value),
            "significant": p_value < 0.05,
            "mean1": float(data1.mean()),
            "mean2": float(data2.mean()),
            "std1": float(data1.std()),
            "std2": float(data2.std()),
            "n1": int(len(data1)),
            "n2": int(len(data2)),
        }

    def chi_square_test(self, col1: str, col2: str) -> Dict[str, Any]:
        """Perform chi-square test of independence between two categorical columns."""
        if col1 not in self.df.columns or col2 not in self.df.columns:
            return {"error": "Column not found"}

        # Create contingency table
        contingency = pd.crosstab(self.df[col1], self.df[col2])

        if contingency.size < 4:
            return {"error": "Insufficient categories for chi-square test"}

        chi2, p_value, dof, expected = stats.chi2_contingency(contingency)

        return {
            "test": "Chi-square test of independence",
            "column1": col1,
            "column2": col2,
            "chi2_statistic": float(chi2),
            "p_value": float(p_value),
            "degrees_of_freedom": int(dof),
            "significant": p_value < 0.05,
            "contingency_table": contingency.to_dict(),
        }

    def linear_regression(self, x_col: str, y_col: str) -> Dict[str, Any]:
        """Perform simple linear regression."""
        if x_col not in self.df.columns or y_col not in self.df.columns:
            return {"error": "Column not found"}

        # Clean data
        data = self.df[[x_col, y_col]].dropna()

        if len(data) < 3:
            return {"error": "Insufficient data for regression"}

        X = data[x_col].values.reshape(-1, 1)
        y = data[y_col].values

        # Fit model
        model = LinearRegression()
        model.fit(X, y)

        # Predictions
        y_pred = model.predict(X)

        # Metrics
        r2 = r2_score(y, y_pred)
        rmse = np.sqrt(mean_squared_error(y, y_pred))

        return {
            "test": "Linear Regression",
            "x_column": x_col,
            "y_column": y_col,
            "slope": float(model.coef_[0]),
            "intercept": float(model.intercept_),
            "r_squared": float(r2),
            "rmse": float(rmse),
            "n_samples": int(len(data)),
            "equation": f"y = {model.coef_[0]:.4f}x + {model.intercept_:.4f}",
        }

    def anova_one_way(self, numeric_col: str, group_col: str) -> Dict[str, Any]:
        """Perform one-way ANOVA."""
        if numeric_col not in self.df.columns or group_col not in self.df.columns:
            return {"error": "Column not found"}

        groups = []
        group_names = []

        for name, group in self.df.groupby(group_col)[numeric_col]:
            clean_group = group.dropna()
            if len(clean_group) > 0:
                groups.append(clean_group.values)
                group_names.append(str(name))

        if len(groups) < 2:
            return {"error": "Need at least 2 groups for ANOVA"}

        f_statistic, p_value = stats.f_oneway(*groups)

        return {
            "test": "One-way ANOVA",
            "numeric_column": numeric_col,
            "group_column": group_col,
            "f_statistic": float(f_statistic),
            "p_value": float(p_value),
            "significant": p_value < 0.05,
            "n_groups": len(groups),
            "group_names": group_names,
        }

    def normality_test(self, column: str) -> Dict[str, Any]:
        """Test if data follows normal distribution using Shapiro-Wilk test."""
        if column not in self.df.columns:
            return {"error": "Column not found"}

        data = self.df[column].dropna()

        if not pd.api.types.is_numeric_dtype(data):
            return {"error": "Column must be numeric"}

        if len(data) < 3:
            return {"error": "Insufficient data"}

        # Limit to 5000 samples for performance
        if len(data) > 5000:
            data = data.sample(5000, random_state=42)

        statistic, p_value = stats.shapiro(data)

        return {
            "test": "Shapiro-Wilk normality test",
            "column": column,
            "statistic": float(statistic),
            "p_value": float(p_value),
            "is_normal": p_value > 0.05,
            "n_samples": int(len(data)),
        }

    def generate_all_tests(self) -> Dict[str, Any]:
        """Generate comprehensive statistical tests."""
        numeric_cols = self.df.select_dtypes(include=[np.number]).columns.tolist()

        results = {
            "normality_tests": [],
            "correlations_with_significance": [],
        }

        # Normality tests for numeric columns
        for col in numeric_cols[:10]:  # Limit to first 10 columns
            test_result = self.normality_test(col)
            if "error" not in test_result:
                results["normality_tests"].append(test_result)

        # Correlation significance tests
        if len(numeric_cols) >= 2:
            for i, col1 in enumerate(numeric_cols[:5]):
                for col2 in numeric_cols[i + 1 : 6]:
                    data = self.df[[col1, col2]].dropna()
                    if len(data) > 2:
                        r, p = stats.pearsonr(data[col1], data[col2])
                        results["correlations_with_significance"].append(
                            {
                                "column1": col1,
                                "column2": col2,
                                "correlation": float(r),
                                "p_value": float(p),
                                "significant": p < 0.05,
                            }
                        )

        return results
