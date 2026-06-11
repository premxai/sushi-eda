import json

import numpy as np
import pandas as pd
from scipy import stats as sp_stats
from typing import Any
import plotly.graph_objects as go
from plotly.utils import PlotlyJSONEncoder


PLOTLY_THEME = dict(
    font=dict(family="Inter, sans-serif", size=12, color="#334155"),
    paper_bgcolor="rgba(0,0,0,0)",
    plot_bgcolor="rgba(0,0,0,0)",
    margin=dict(t=30, r=20, b=40, l=60),
    hovermode="closest",
)

PLOTLY_CONFIG = dict(displayModeBar=False, responsive=True)


def _themed_layout(**overrides) -> dict:
    """PLOTLY_THEME merged with per-chart overrides (overrides win).

    Passing **PLOTLY_THEME alongside an explicit margin= would raise
    "got multiple values for keyword argument".
    """
    return {**PLOTLY_THEME, **overrides}


class Visualizer:
    """Generates Plotly JSON chart specs for a DataFrame."""

    def __init__(self, df: pd.DataFrame):
        self.df = df

    # ── helpers ───────────────────────────────────────────────────────

    def _to_json(self, fig: go.Figure) -> dict[str, Any]:
        """Convert a Plotly figure to a JSON-serialisable dict.

        Round-trip through PlotlyJSONEncoder so numpy arrays/scalars become
        plain lists/numbers FastAPI's encoder can handle.
        """
        return json.loads(json.dumps(fig.to_plotly_json(), cls=PlotlyJSONEncoder))

    # ── 1. Distribution plot ─────────────────────────────────────────

    def create_distribution_plot(self, column: str) -> dict[str, Any]:
        """Histogram with KDE overlay and mean/median vertical lines."""
        if column not in self.df.columns:
            return {"error": f"Column '{column}' not found"}

        series = self.df[column].dropna()
        if not pd.api.types.is_numeric_dtype(series) or len(series) == 0:
            return {"error": f"Column '{column}' is not numeric or empty"}

        values = series.astype(float).values

        fig = go.Figure()

        # Histogram
        fig.add_trace(go.Histogram(
            x=values,
            nbinsx=30,
            marker=dict(color="rgba(79, 70, 229, 0.6)", line=dict(color="rgba(79, 70, 229, 0.8)", width=1)),
            name="Distribution",
            hovertemplate="Range: %{x}<br>Count: %{y}<extra></extra>",
        ))

        # KDE overlay
        try:
            kde = sp_stats.gaussian_kde(values)
            x_range = np.linspace(float(values.min()), float(values.max()), 200)
            kde_y = kde(x_range)
            # Scale KDE to match histogram height
            bin_width = (values.max() - values.min()) / 30
            kde_y_scaled = kde_y * len(values) * bin_width

            fig.add_trace(go.Scatter(
                x=x_range.tolist(),
                y=kde_y_scaled.tolist(),
                mode="lines",
                line=dict(color="rgba(99, 102, 241, 0.8)", width=2),
                name="KDE",
                hoverinfo="skip",
            ))
        except Exception:
            pass  # KDE can fail on degenerate data

        # Mean line
        mean_val = float(np.mean(values))
        fig.add_vline(x=mean_val, line=dict(color="#e11d48", width=1.5, dash="dash"),
                       annotation_text=f"Mean: {mean_val:.2f}",
                       annotation_position="top right",
                       annotation_font_size=10, annotation_font_color="#e11d48")

        # Median line
        median_val = float(np.median(values))
        fig.add_vline(x=median_val, line=dict(color="#059669", width=1.5, dash="dash"),
                       annotation_text=f"Median: {median_val:.2f}",
                       annotation_position="top left",
                       annotation_font_size=10, annotation_font_color="#059669")

        fig.update_layout(
            **PLOTLY_THEME,
            height=280,
            showlegend=True,
            legend=dict(x=1, xanchor="right", y=1, font=dict(size=10, color="#64748b"), bgcolor="rgba(0,0,0,0)"),
            xaxis=dict(title=dict(text=column, font=dict(size=11, color="#94a3b8")),
                       gridcolor="#f1f5f9", zerolinecolor="#e2e8f0"),
            yaxis=dict(title=dict(text="Count", font=dict(size=11, color="#94a3b8")),
                       gridcolor="#f1f5f9", zerolinecolor="#e2e8f0"),
            bargap=0.05,
        )

        return self._to_json(fig)

    # ── 2. Correlation heatmap ───────────────────────────────────────

    def create_correlation_heatmap(self) -> dict[str, Any]:
        """Heatmap with red→white→indigo scale, upper triangle + annotations."""
        numeric_df = self.df.select_dtypes(include=[np.number])
        if numeric_df.shape[1] < 2:
            return {"error": "Need at least 2 numeric columns for correlation"}

        corr = numeric_df.corr()
        cols = corr.columns.tolist()
        n = len(cols)

        # Mask lower triangle and diagonal
        mask = np.triu(np.ones((n, n), dtype=bool), k=1)
        z = corr.values.copy()
        z[~mask] = np.nan

        # Build annotations for strong correlations (|r| > 0.7)
        annotations = []
        for i in range(n):
            for j in range(i + 1, n):
                val = corr.values[i][j]
                if abs(val) > 0.7:
                    annotations.append(dict(
                        x=cols[j], y=cols[i],
                        text=f"{val:.2f}",
                        showarrow=False,
                        font=dict(size=10, color="#1e293b" if abs(val) > 0.5 else "#94a3b8"),
                    ))

        fig = go.Figure(data=go.Heatmap(
            z=z.tolist(),
            x=cols,
            y=cols,
            colorscale=[
                [0, "#ef4444"],
                [0.25, "#fca5a5"],
                [0.5, "#ffffff"],
                [0.75, "#a5b4fc"],
                [1, "#4f46e5"],
            ],
            zmin=-1, zmax=1,
            text=[[f"r = {corr.values[i][j]:.3f}" if mask[i][j] else ""
                   for j in range(n)] for i in range(n)],
            hovertemplate="<b>%{x}</b> vs <b>%{y}</b><br>%{text}<extra></extra>",
            showscale=True,
            colorbar=dict(thickness=14, outlinewidth=0,
                          tickvals=[-1, -0.5, 0, 0.5, 1],
                          tickfont=dict(size=10, color="#64748b")),
        ))

        fig.update_layout(**_themed_layout(
            height=max(400, n * 40),
            margin=dict(l=110, r=30, t=10, b=110),
            xaxis=dict(tickangle=-45, side="bottom"),
            yaxis=dict(autorange="reversed"),
            annotations=annotations,
        ))

        return self._to_json(fig)

    # ── 3. Box plot ──────────────────────────────────────────────────

    def create_box_plot(self, column: str) -> dict[str, Any]:
        """Box plot with outlier markers and quartile tooltips."""
        if column not in self.df.columns:
            return {"error": f"Column '{column}' not found"}

        series = self.df[column].dropna()
        if not pd.api.types.is_numeric_dtype(series) or len(series) == 0:
            return {"error": f"Column '{column}' is not numeric or empty"}

        values = series.astype(float).values
        q1, q3 = float(np.percentile(values, 25)), float(np.percentile(values, 75))
        iqr = q3 - q1
        lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr

        fig = go.Figure()

        fig.add_trace(go.Box(
            y=values.tolist(),
            name=column,
            marker=dict(color="rgba(79, 70, 229, 0.5)",
                        outliercolor="#ef4444", size=4,
                        line=dict(outliercolor="#ef4444", outlierwidth=1.5)),
            boxpoints="outliers",
            line=dict(color="#4f46e5"),
            fillcolor="rgba(79, 70, 229, 0.1)",
            hovertemplate=(
                f"<b>{column}</b><br>"
                f"Value: %{{y}}<br>"
                f"Q1: {q1:.2f} | Q3: {q3:.2f}<br>"
                f"IQR: {iqr:.2f}<br>"
                f"Bounds: [{lower:.2f}, {upper:.2f}]"
                "<extra></extra>"
            ),
        ))

        fig.update_layout(
            **PLOTLY_THEME,
            height=300,
            showlegend=False,
            yaxis=dict(gridcolor="#f1f5f9", zerolinecolor="#e2e8f0",
                       title=dict(text="Value", font=dict(size=11, color="#94a3b8"))),
        )

        return self._to_json(fig)

    # ── 4. Categorical bar chart ─────────────────────────────────────

    def create_categorical_bar(self, column: str, top_n: int = 10) -> dict[str, Any]:
        """Horizontal bar chart of top N values, sorted descending."""
        if column not in self.df.columns:
            return {"error": f"Column '{column}' not found"}

        series = self.df[column].dropna()
        if len(series) == 0:
            return {"error": f"Column '{column}' is empty"}

        vc = series.value_counts().head(top_n)
        labels = [str(v) for v in vc.index.tolist()]
        counts = vc.values.tolist()
        total = len(series)
        pcts = [round(c / total * 100, 1) for c in counts]

        # Reverse for bottom-to-top sort (largest on top)
        labels.reverse()
        counts.reverse()
        pcts.reverse()

        fig = go.Figure()

        fig.add_trace(go.Bar(
            y=labels,
            x=counts,
            orientation="h",
            marker=dict(color="rgba(79, 70, 229, 0.6)",
                        line=dict(color="rgba(79, 70, 229, 0.8)", width=1)),
            text=[f"{p}%" for p in pcts],
            textposition="outside",
            textfont=dict(size=10, color="#64748b"),
            hovertemplate=[
                f"<b>{l}</b><br>Count: {c:,}<br>Percentage: {p}%<extra></extra>"
                for l, c, p in zip(labels, counts, pcts)
            ],
            cliponaxis=False,
        ))

        fig.update_layout(**_themed_layout(
            height=max(200, len(labels) * 28 + 60),
            margin=dict(t=10, r=60, b=30, l=max(60, max((len(l) for l in labels), default=5) * 7)),
            xaxis=dict(title=dict(text="Count", font=dict(size=11, color="#94a3b8")),
                       gridcolor="#f1f5f9", zerolinecolor="#e2e8f0"),
            yaxis=dict(automargin=True, tickfont=dict(size=11)),
            bargap=0.15,
        ))

        return self._to_json(fig)

    # ── 5. Missing data matrix ───────────────────────────────────────

    def create_missing_data_matrix(self) -> dict[str, Any]:
        """Heatmap showing missing data patterns across all columns."""
        missing = self.df.isnull()
        if not missing.any().any():
            return {"error": "No missing data found in this dataset"}

        # Only show columns that have at least 1 missing value
        cols_with_missing = missing.columns[missing.any()].tolist()
        if not cols_with_missing:
            return {"error": "No missing data found"}

        subset = missing[cols_with_missing]

        # Sample rows if dataset is large (max 200 rows for readability)
        if len(subset) > 200:
            step = max(1, len(subset) // 200)
            subset = subset.iloc[::step]

        z = subset.astype(int).values.tolist()
        row_labels = [str(i) for i in subset.index.tolist()]

        fig = go.Figure(data=go.Heatmap(
            z=z,
            x=cols_with_missing,
            y=row_labels,
            colorscale=[[0, "#f8fafc"], [1, "#ef4444"]],
            zmin=0, zmax=1,
            showscale=True,
            colorbar=dict(
                thickness=12, outlinewidth=0,
                tickvals=[0, 1], ticktext=["Present", "Missing"],
                tickfont=dict(size=10, color="#64748b"),
            ),
            hovertemplate="Row %{y}<br>Column: %{x}<br>%{z:d}<extra></extra>",
        ))

        fig.update_layout(**_themed_layout(
            height=max(300, min(600, len(row_labels) * 3 + 80)),
            margin=dict(l=60, r=20, t=10, b=80),
            xaxis=dict(tickangle=-45, side="bottom"),
            yaxis=dict(title=dict(text="Row Index", font=dict(size=11, color="#94a3b8")),
                       autorange="reversed"),
        ))

        return self._to_json(fig)

    # ── 6. Generate all visualizations ───────────────────────────────

    def generate_all_visualizations(self) -> dict[str, Any]:
        """Generate all chart JSONs for the full dataset."""
        charts: dict[str, Any] = {}

        # Correlation heatmap
        charts["correlation_heatmap"] = self.create_correlation_heatmap()

        # Missing data matrix
        charts["missing_data_matrix"] = self.create_missing_data_matrix()

        # Per-column charts
        column_charts: dict[str, Any] = {}
        for col in self.df.columns:
            col_data: dict[str, Any] = {}

            if pd.api.types.is_numeric_dtype(self.df[col]):
                col_data["distribution"] = self.create_distribution_plot(col)
                col_data["box_plot"] = self.create_box_plot(col)
            else:
                col_data["categorical_bar"] = self.create_categorical_bar(col)

            column_charts[col] = col_data

        charts["columns"] = column_charts
        return charts
