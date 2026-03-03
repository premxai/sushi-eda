"""Advanced statistical analysis including tests, regressions, and time-series tools."""

from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from scipy import stats
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
)
from sklearn.preprocessing import PolynomialFeatures

try:
    from statsmodels.tsa.arima.model import ARIMA
    from statsmodels.tsa.seasonal import seasonal_decompose
except Exception:  # pragma: no cover - graceful fallback when optional dependency is missing
    ARIMA = None
    seasonal_decompose = None


class AdvancedStatistics:
    """Performs advanced statistical analysis on DataFrames."""

    def __init__(self, df: pd.DataFrame):
        self.df = df

    def _safe_float(self, value: Any) -> Optional[float]:
        if value is None:
            return None
        try:
            if pd.isna(value):
                return None
            return float(value)
        except Exception:
            return None

    def _get_numeric_pair(self, col1: str, col2: str) -> Tuple[Optional[pd.Series], Optional[pd.Series], Optional[str]]:
        if col1 not in self.df.columns or col2 not in self.df.columns:
            return None, None, "Column not found"
        data1 = self.df[col1].dropna()
        data2 = self.df[col2].dropna()
        if not pd.api.types.is_numeric_dtype(data1) or not pd.api.types.is_numeric_dtype(data2):
            return None, None, "Both columns must be numeric"
        return data1, data2, None

    def _prepare_time_series(self, date_col: str, value_col: str) -> Tuple[Optional[pd.DataFrame], Optional[str]]:
        if date_col not in self.df.columns or value_col not in self.df.columns:
            return None, "Column not found"
        if not pd.api.types.is_numeric_dtype(self.df[value_col]):
            return None, "Value column must be numeric"

        ts = self.df[[date_col, value_col]].dropna().copy()
        ts[date_col] = pd.to_datetime(ts[date_col], errors="coerce")
        ts = ts.dropna().sort_values(date_col)
        if ts.empty:
            return None, "No valid rows after parsing dates"

        ts = ts.groupby(date_col, as_index=False)[value_col].mean().sort_values(date_col)
        ts = ts.set_index(date_col)
        return ts, None

    def t_test_independent(self, col1: str, col2: str, equal_var: bool = False) -> Dict[str, Any]:
        """Perform independent t-test between two numeric columns."""
        data1, data2, error = self._get_numeric_pair(col1, col2)
        if error:
            return {"error": error}
        if data1 is None or data2 is None:
            return {"error": "Unexpected data error"}
        if len(data1) < 2 or len(data2) < 2:
            return {"error": "Insufficient data for t-test"}

        statistic, p_value = stats.ttest_ind(data1, data2, equal_var=equal_var)

        return {
            "test": "Independent t-test",
            "column1": col1,
            "column2": col2,
            "statistic": float(statistic),
            "p_value": float(p_value),
            "significant": p_value < 0.05,
            "equal_variance_assumed": equal_var,
            "mean1": float(data1.mean()),
            "mean2": float(data2.mean()),
            "std1": float(data1.std()),
            "std2": float(data2.std()),
            "n1": int(len(data1)),
            "n2": int(len(data2)),
        }

    def mann_whitney_u(self, col1: str, col2: str, alternative: str = "two-sided") -> Dict[str, Any]:
        """Perform Mann-Whitney U test between two numeric columns."""
        if alternative not in ("two-sided", "less", "greater"):
            return {"error": "alternative must be two-sided | less | greater"}
        data1, data2, error = self._get_numeric_pair(col1, col2)
        if error:
            return {"error": error}
        if data1 is None or data2 is None:
            return {"error": "Unexpected data error"}
        if len(data1) < 2 or len(data2) < 2:
            return {"error": "Insufficient data for Mann-Whitney test"}

        statistic, p_value = stats.mannwhitneyu(data1, data2, alternative=alternative)
        return {
            "test": "Mann-Whitney U",
            "column1": col1,
            "column2": col2,
            "alternative": alternative,
            "u_statistic": float(statistic),
            "p_value": float(p_value),
            "significant": p_value < 0.05,
            "median1": float(data1.median()),
            "median2": float(data2.median()),
            "n1": int(len(data1)),
            "n2": int(len(data2)),
        }

    def chi_square_test(self, col1: str, col2: str) -> Dict[str, Any]:
        """Perform chi-square test of independence between two categorical columns."""
        if col1 not in self.df.columns or col2 not in self.df.columns:
            return {"error": "Column not found"}

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
            "expected_frequencies": pd.DataFrame(
                expected, index=contingency.index, columns=contingency.columns
            ).to_dict(),
        }

    def linear_regression(self, x_col: str, y_col: str) -> Dict[str, Any]:
        """Perform simple linear regression with coefficient table."""
        if x_col not in self.df.columns or y_col not in self.df.columns:
            return {"error": "Column not found"}

        data = self.df[[x_col, y_col]].dropna()
        if len(data) < 3:
            return {"error": "Insufficient data for regression"}
        if not pd.api.types.is_numeric_dtype(data[x_col]) or not pd.api.types.is_numeric_dtype(data[y_col]):
            return {"error": "Both columns must be numeric"}

        X = data[x_col].values.reshape(-1, 1)
        y = data[y_col].values
        model = LinearRegression()
        model.fit(X, y)

        y_pred = model.predict(X)
        r2 = r2_score(y, y_pred)
        rmse = np.sqrt(mean_squared_error(y, y_pred))
        slope = float(model.coef_[0])
        intercept = float(model.intercept_)

        corr, p_value = stats.pearsonr(data[x_col], data[y_col])
        coefficient_table = [
            {"term": "intercept", "coefficient": intercept},
            {"term": x_col, "coefficient": slope},
        ]

        return {
            "test": "Linear Regression",
            "model_type": "linear",
            "x_column": x_col,
            "y_column": y_col,
            "slope": slope,
            "intercept": intercept,
            "r_squared": float(r2),
            "rmse": float(rmse),
            "coefficient_table": coefficient_table,
            "correlation": float(corr),
            "p_value": float(p_value),
            "significant": p_value < 0.05,
            "n_samples": int(len(data)),
            "equation": f"y = {slope:.4f}x + {intercept:.4f}",
        }

    def logistic_regression(self, x_col: str, y_col: str, positive_class: Optional[str] = None) -> Dict[str, Any]:
        """Perform logistic regression for binary targets."""
        if x_col not in self.df.columns or y_col not in self.df.columns:
            return {"error": "Column not found"}
        if not pd.api.types.is_numeric_dtype(self.df[x_col]):
            return {"error": "Predictor column must be numeric"}

        data = self.df[[x_col, y_col]].dropna().copy()
        if len(data) < 10:
            return {"error": "Insufficient data for logistic regression"}

        classes = list(pd.Series(data[y_col].unique()).dropna())
        if len(classes) != 2:
            return {"error": "Target column must have exactly 2 classes for logistic regression"}

        classes_sorted = sorted(classes, key=lambda v: str(v))
        if positive_class is not None:
            candidates = {str(v): v for v in classes_sorted}
            if positive_class not in candidates:
                return {"error": "positive_class does not match target classes"}
            positive_value = candidates[positive_class]
        else:
            positive_value = classes_sorted[-1]

        y_binary = (data[y_col] == positive_value).astype(int)
        X = data[[x_col]].values
        y = y_binary.values

        model = LogisticRegression(max_iter=1000)
        model.fit(X, y)
        probs = model.predict_proba(X)[:, 1]
        preds = (probs >= 0.5).astype(int)

        coef = float(model.coef_[0][0])
        intercept = float(model.intercept_[0])
        try:
            auc = float(roc_auc_score(y, probs))
        except Exception:
            auc = None

        coefficient_table = [
            {"term": "intercept", "coefficient": intercept, "odds_ratio": float(np.exp(intercept))},
            {"term": x_col, "coefficient": coef, "odds_ratio": float(np.exp(coef))},
        ]

        return {
            "test": "Logistic Regression",
            "model_type": "logistic",
            "x_column": x_col,
            "y_column": y_col,
            "positive_class": str(positive_value),
            "classes": [str(v) for v in classes_sorted],
            "n_samples": int(len(data)),
            "coefficient_table": coefficient_table,
            "accuracy": float(accuracy_score(y, preds)),
            "precision": float(precision_score(y, preds, zero_division=0)),
            "recall": float(recall_score(y, preds, zero_division=0)),
            "f1_score": float(f1_score(y, preds, zero_division=0)),
            "roc_auc": auc,
            "baseline_positive_rate": float(y_binary.mean()),
        }

    def polynomial_regression(self, x_col: str, y_col: str, degree: int = 2) -> Dict[str, Any]:
        """Perform polynomial regression and return coefficients by term."""
        if x_col not in self.df.columns or y_col not in self.df.columns:
            return {"error": "Column not found"}
        if degree < 2 or degree > 6:
            return {"error": "degree must be between 2 and 6"}

        data = self.df[[x_col, y_col]].dropna()
        if len(data) < max(10, degree + 2):
            return {"error": "Insufficient data for polynomial regression"}
        if not pd.api.types.is_numeric_dtype(data[x_col]) or not pd.api.types.is_numeric_dtype(data[y_col]):
            return {"error": "Both columns must be numeric"}

        X = data[[x_col]].values
        y = data[y_col].values
        poly = PolynomialFeatures(degree=degree, include_bias=False)
        X_poly = poly.fit_transform(X)

        model = LinearRegression()
        model.fit(X_poly, y)
        y_pred = model.predict(X_poly)
        r2 = r2_score(y, y_pred)
        rmse = np.sqrt(mean_squared_error(y, y_pred))

        feature_names = poly.get_feature_names_out([x_col]).tolist()
        coefficient_table = [{"term": "intercept", "coefficient": float(model.intercept_)}]
        for name, coef in zip(feature_names, model.coef_):
            coefficient_table.append({"term": name, "coefficient": float(coef)})

        return {
            "test": "Polynomial Regression",
            "model_type": "polynomial",
            "x_column": x_col,
            "y_column": y_col,
            "degree": degree,
            "r_squared": float(r2),
            "rmse": float(rmse),
            "n_samples": int(len(data)),
            "coefficient_table": coefficient_table,
        }

    def anova_one_way(self, numeric_col: str, group_col: str) -> Dict[str, Any]:
        """Perform one-way ANOVA."""
        if numeric_col not in self.df.columns or group_col not in self.df.columns:
            return {"error": "Column not found"}
        if not pd.api.types.is_numeric_dtype(self.df[numeric_col]):
            return {"error": "numeric_col must be numeric"}

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

    def time_series_decomposition(
        self,
        date_col: str,
        value_col: str,
        period: Optional[int] = None,
        model: str = "additive",
    ) -> Dict[str, Any]:
        """Decompose time series into trend, seasonality, and residual components."""
        if seasonal_decompose is None:
            return {"error": "statsmodels is required for decomposition but is not installed"}
        if model not in ("additive", "multiplicative"):
            return {"error": "model must be additive | multiplicative"}

        ts, error = self._prepare_time_series(date_col, value_col)
        if error:
            return {"error": error}
        if ts is None:
            return {"error": "Unexpected data error"}

        inferred_freq = pd.infer_freq(ts.index)
        if period is None:
            if inferred_freq in ("M", "MS", "ME"):
                period = 12
            elif inferred_freq in ("Q", "QS", "QE"):
                period = 4
            elif inferred_freq in ("D", "B"):
                period = 7
            else:
                period = max(2, min(12, len(ts) // 6))

        period = max(2, min(int(period), max(2, len(ts) // 2)))
        if len(ts) < period * 2:
            return {"error": f"Need at least {period * 2} observations for decomposition"}

        result = seasonal_decompose(ts[value_col], model=model, period=period, extrapolate_trend="freq")

        def _series_payload(series: pd.Series, name: str) -> List[Dict[str, Any]]:
            return [
                {"date": idx.isoformat(), name: self._safe_float(value)}
                for idx, value in series.items()
            ]

        return {
            "test": "Time Series Decomposition",
            "model_type": model,
            "date_column": date_col,
            "value_column": value_col,
            "period": period,
            "n_observations": int(len(ts)),
            "observed": _series_payload(result.observed, "value"),
            "trend": _series_payload(result.trend, "value"),
            "seasonal": _series_payload(result.seasonal, "value"),
            "residual": _series_payload(result.resid, "value"),
        }

    def arima_forecast(
        self,
        date_col: str,
        value_col: str,
        periods: int = 12,
        p: int = 1,
        d: int = 1,
        q: int = 1,
        alpha: float = 0.05,
    ) -> Dict[str, Any]:
        """Fit ARIMA model and forecast future values."""
        if ARIMA is None:
            return {"error": "statsmodels is required for ARIMA but is not installed"}
        if periods < 1 or periods > 120:
            return {"error": "periods must be between 1 and 120"}
        if min(p, d, q) < 0:
            return {"error": "ARIMA parameters p, d, q must be non-negative"}
        if alpha <= 0 or alpha >= 1:
            return {"error": "alpha must be between 0 and 1"}

        ts, error = self._prepare_time_series(date_col, value_col)
        if error:
            return {"error": error}
        if ts is None:
            return {"error": "Unexpected data error"}
        if len(ts) < 8:
            return {"error": "Need at least 8 observations for ARIMA forecasting"}

        series = ts[value_col]
        try:
            model = ARIMA(series, order=(p, d, q))
            fitted = model.fit()
        except Exception as exc:
            return {"error": f"ARIMA fit failed: {exc}"}

        forecast_result = fitted.get_forecast(steps=periods)
        forecast_values = forecast_result.predicted_mean
        conf_int = forecast_result.conf_int(alpha=alpha)

        inferred_freq = pd.infer_freq(series.index)
        if inferred_freq:
            future_index = pd.date_range(start=series.index[-1], periods=periods + 1, freq=inferred_freq)[1:]
        else:
            diffs = series.index.to_series().diff().dropna()
            step = diffs.median() if not diffs.empty else pd.Timedelta(days=1)
            future_index = [series.index[-1] + step * (i + 1) for i in range(periods)]

        forecast_rows = []
        for i in range(periods):
            low = conf_int.iloc[i, 0]
            high = conf_int.iloc[i, 1]
            forecast_rows.append(
                {
                    "date": pd.Timestamp(future_index[i]).isoformat(),
                    "forecast": self._safe_float(forecast_values.iloc[i]),
                    "lower_ci": self._safe_float(low),
                    "upper_ci": self._safe_float(high),
                }
            )

        return {
            "test": "ARIMA Forecast",
            "date_column": date_col,
            "value_column": value_col,
            "order": {"p": p, "d": d, "q": q},
            "periods": periods,
            "alpha": alpha,
            "n_observations": int(len(series)),
            "aic": self._safe_float(fitted.aic),
            "bic": self._safe_float(fitted.bic),
            "forecast": forecast_rows,
        }

    def cohort_analysis(self, entity_col: str, date_col: str, freq: str = "M") -> Dict[str, Any]:
        """Calculate cohort retention matrix by entity first-seen period."""
        if entity_col not in self.df.columns or date_col not in self.df.columns:
            return {"error": "Column not found"}
        freq = freq.upper()
        if freq not in ("D", "W", "M", "Q"):
            return {"error": "freq must be one of D | W | M | Q"}

        cohort_df = self.df[[entity_col, date_col]].dropna().copy()
        cohort_df[date_col] = pd.to_datetime(cohort_df[date_col], errors="coerce")
        cohort_df = cohort_df.dropna()
        if cohort_df.empty:
            return {"error": "No valid cohort data after date parsing"}

        cohort_df["activity_period"] = cohort_df[date_col].dt.to_period(freq)
        cohort_df["cohort_period"] = cohort_df.groupby(entity_col)["activity_period"].transform("min")
        cohort_df["period_index"] = (cohort_df["activity_period"] - cohort_df["cohort_period"]).apply(lambda p: p.n)
        cohort_df = cohort_df[cohort_df["period_index"] >= 0]
        if cohort_df.empty:
            return {"error": "No valid cohort rows after indexing"}

        grouped = (
            cohort_df.groupby(["cohort_period", "period_index"])[entity_col]
            .nunique()
            .reset_index(name="users")
        )
        retention_counts = grouped.pivot(index="cohort_period", columns="period_index", values="users")
        retention_counts = retention_counts.sort_index().sort_index(axis=1)
        if retention_counts.empty or 0 not in retention_counts.columns:
            return {"error": "Unable to compute cohort sizes"}

        cohort_sizes = retention_counts[0]
        retention_rates = retention_counts.divide(cohort_sizes, axis=0) * 100

        matrix = []
        max_period = int(retention_rates.columns.max()) if len(retention_rates.columns) else 0
        for cohort_key in retention_rates.index:
            periods = []
            for period_idx in retention_rates.columns:
                rate_value = retention_rates.loc[cohort_key, period_idx]
                count_value = retention_counts.loc[cohort_key, period_idx]
                periods.append(
                    {
                        "period_index": int(period_idx),
                        "retention_rate": self._safe_float(rate_value),
                        "active_users": int(count_value) if not pd.isna(count_value) else None,
                    }
                )
            matrix.append(
                {
                    "cohort": str(cohort_key),
                    "cohort_size": int(cohort_sizes.loc[cohort_key]),
                    "periods": periods,
                }
            )

        return {
            "test": "Cohort Analysis",
            "entity_column": entity_col,
            "date_column": date_col,
            "frequency": freq,
            "n_cohorts": int(len(matrix)),
            "max_period_index": max_period,
            "cohorts": matrix,
        }

    def ab_test_significance(
        self,
        control_conversions: int,
        control_total: int,
        variant_conversions: int,
        variant_total: int,
        alpha: float = 0.05,
    ) -> Dict[str, Any]:
        """Two-proportion z-test for A/B experiment significance."""
        try:
            control_conversions = int(control_conversions)
            control_total = int(control_total)
            variant_conversions = int(variant_conversions)
            variant_total = int(variant_total)
            alpha = float(alpha)
        except Exception:
            return {"error": "Inputs must be numeric"}

        if control_total <= 0 or variant_total <= 0:
            return {"error": "Totals must be positive"}
        if control_conversions < 0 or variant_conversions < 0:
            return {"error": "Conversions cannot be negative"}
        if control_conversions > control_total or variant_conversions > variant_total:
            return {"error": "Conversions cannot exceed totals"}
        if alpha <= 0 or alpha >= 1:
            return {"error": "alpha must be between 0 and 1"}

        p1 = control_conversions / control_total
        p2 = variant_conversions / variant_total
        lift_abs = p2 - p1
        lift_rel = (lift_abs / p1) * 100 if p1 > 0 else None

        pooled = (control_conversions + variant_conversions) / (control_total + variant_total)
        se_pooled = np.sqrt(pooled * (1 - pooled) * ((1 / control_total) + (1 / variant_total)))
        if se_pooled == 0:
            return {"error": "Standard error is zero; cannot compute z-test"}

        z_stat = lift_abs / se_pooled
        p_value = 2 * (1 - stats.norm.cdf(abs(z_stat)))

        z_critical = stats.norm.ppf(1 - alpha / 2)
        se_unpooled = np.sqrt((p1 * (1 - p1) / control_total) + (p2 * (1 - p2) / variant_total))
        ci_low = lift_abs - z_critical * se_unpooled
        ci_high = lift_abs + z_critical * se_unpooled

        significant = p_value < alpha
        if not significant:
            winner = "inconclusive"
        elif lift_abs > 0:
            winner = "variant"
        elif lift_abs < 0:
            winner = "control"
        else:
            winner = "tie"

        return {
            "test": "A/B Test Significance",
            "control": {
                "conversions": control_conversions,
                "total": control_total,
                "conversion_rate": p1,
            },
            "variant": {
                "conversions": variant_conversions,
                "total": variant_total,
                "conversion_rate": p2,
            },
            "lift_absolute": lift_abs,
            "lift_relative_percent": lift_rel,
            "z_statistic": float(z_stat),
            "p_value": float(p_value),
            "alpha": alpha,
            "significant": significant,
            "confidence_interval_absolute": {"low": float(ci_low), "high": float(ci_high)},
            "winner": winner,
        }

    def generate_all_tests(self) -> Dict[str, Any]:
        """Generate default statistical overview tests."""
        numeric_cols = self.df.select_dtypes(include=[np.number]).columns.tolist()
        results: Dict[str, Any] = {
            "normality_tests": [],
            "correlations_with_significance": [],
        }

        for col in numeric_cols[:10]:
            test_result = self.normality_test(col)
            if "error" not in test_result:
                results["normality_tests"].append(test_result)

        if len(numeric_cols) >= 2:
            for i, col1 in enumerate(numeric_cols[:5]):
                for col2 in numeric_cols[i + 1 : 6]:
                    data = self.df[[col1, col2]].dropna()
                    if len(data) > 2:
                        r, p_value = stats.pearsonr(data[col1], data[col2])
                        results["correlations_with_significance"].append(
                            {
                                "column1": col1,
                                "column2": col2,
                                "correlation": float(r),
                                "p_value": float(p_value),
                                "significant": p_value < 0.05,
                            }
                        )
        return results
