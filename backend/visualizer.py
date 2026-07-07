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

    # ── 6. Violin plot ────────────────────────────────────────────────

    def create_violin_plot(self, column: str) -> dict[str, Any]:
        """Full distribution shape (density) with an embedded box + outliers.

        Complements create_box_plot: a box plot only shows quartiles, a
        violin shows whether the data is bimodal, skewed, etc. — the kind
        of shape an analyst needs to see before trusting an average.
        """
        if column not in self.df.columns:
            return {"error": f"Column '{column}' not found"}

        series = self.df[column].dropna()
        if not pd.api.types.is_numeric_dtype(series) or len(series) == 0:
            return {"error": f"Column '{column}' is not numeric or empty"}
        if series.nunique() < 2:
            return {"error": f"Column '{column}' needs at least 2 distinct values"}

        values = series.astype(float).values

        fig = go.Figure()
        fig.add_trace(go.Violin(
            y=values.tolist(),
            name=column,
            box_visible=True,
            meanline_visible=True,
            fillcolor="rgba(79, 70, 229, 0.25)",
            line=dict(color="#4f46e5"),
            points="outliers",
            marker=dict(color="#4f46e5", outliercolor="#ef4444", size=4),
            hovertemplate=f"<b>{column}</b><br>Value: %{{y}}<extra></extra>",
        ))

        fig.update_layout(
            **PLOTLY_THEME,
            height=300,
            showlegend=False,
            yaxis=dict(gridcolor="#f1f5f9", zerolinecolor="#e2e8f0",
                       title=dict(text="Value", font=dict(size=11, color="#94a3b8"))),
        )

        return self._to_json(fig)

    # ── 7. Pareto chart (80/20 analysis) ─────────────────────────────

    def create_pareto_chart(
        self, category_column: str, value_column: str | None = None, top_n: int = 15
    ) -> dict[str, Any]:
        """Bars sorted descending + cumulative-% line — the classic "which
        20% of categories drive 80% of the total" business/finance view.

        value_column=None sums row counts instead of a numeric measure.
        Categories beyond top_n are folded into "Other" so the cumulative
        line still reads correctly against the true grand total.
        """
        if category_column not in self.df.columns:
            return {"error": f"Column '{category_column}' not found"}

        if value_column is not None:
            if value_column not in self.df.columns:
                return {"error": f"Column '{value_column}' not found"}
            if not pd.api.types.is_numeric_dtype(self.df[value_column]):
                return {"error": f"Column '{value_column}' is not numeric"}
            grouped = self.df.groupby(category_column)[value_column].sum(numeric_only=True)
            axis_label = value_column
        else:
            grouped = self.df[category_column].value_counts()
            axis_label = "Count"

        grouped = grouped.dropna().sort_values(ascending=False)
        if len(grouped) == 0:
            return {"error": "No data to chart"}
        total = float(grouped.sum())
        if total == 0:
            return {"error": "All values are zero — nothing to rank"}

        if len(grouped) > top_n:
            head = grouped.iloc[:top_n]
            other_sum = grouped.iloc[top_n:].sum()
            if other_sum:
                head = pd.concat([head, pd.Series({"Other": other_sum})])
            grouped = head

        labels = [str(x) for x in grouped.index.tolist()]
        values = grouped.values.astype(float).tolist()
        cumulative_pct = (grouped.cumsum() / total * 100).values.astype(float).tolist()

        fig = go.Figure()
        fig.add_trace(go.Bar(
            x=labels, y=values, name=axis_label,
            marker=dict(color="rgba(79, 70, 229, 0.6)", line=dict(color="rgba(79, 70, 229, 0.8)", width=1)),
            yaxis="y1",
            hovertemplate=f"<b>%{{x}}</b><br>{axis_label}: " + "%{y:,.2f}<extra></extra>",
        ))
        fig.add_trace(go.Scatter(
            x=labels, y=cumulative_pct, name="Cumulative %", mode="lines+markers",
            line=dict(color="#e11d48", width=2), marker=dict(size=5, color="#e11d48"),
            yaxis="y2",
            hovertemplate="<b>%{x}</b><br>Cumulative: %{y:.1f}%<extra></extra>",
        ))
        # 80% reference as a flat line on the secondary axis (avoids add_hline's
        # yref quirks across plotly versions).
        fig.add_trace(go.Scatter(
            x=[labels[0], labels[-1]], y=[80, 80], mode="lines",
            line=dict(color="#94a3b8", width=1, dash="dot"),
            yaxis="y2", hoverinfo="skip", showlegend=False,
        ))

        fig.update_layout(**_themed_layout(
            height=360,
            margin=dict(t=40, r=50, b=90, l=60),
            xaxis=dict(tickangle=-40, automargin=True),
            yaxis=dict(title=dict(text=axis_label, font=dict(size=11, color="#94a3b8")), gridcolor="#f1f5f9"),
            yaxis2=dict(title=dict(text="Cumulative %", font=dict(size=11, color="#94a3b8")),
                        overlaying="y", side="right", range=[0, 105], showgrid=False),
            legend=dict(x=0.5, xanchor="center", y=1.15, orientation="h", font=dict(size=10)),
        ))

        return self._to_json(fig)

    # ── 8. Top-N ranking (value-based, not just row counts) ──────────

    def create_top_n_chart(
        self,
        category_column: str,
        value_column: str | None = None,
        agg: str = "sum",
        top_n: int = 10,
        ascending: bool = False,
    ) -> dict[str, Any]:
        """Ranked bar by an aggregated measure — "top products by revenue",
        not just "most frequent category". create_categorical_bar only ever
        counts rows; this is the version finance/PM users actually need.
        """
        if category_column not in self.df.columns:
            return {"error": f"Column '{category_column}' not found"}
        valid_aggs = {"sum", "mean", "count", "max", "min", "median"}
        if agg not in valid_aggs:
            return {"error": f"agg must be one of {sorted(valid_aggs)}"}
        top_n = max(1, min(top_n, 50))

        if value_column is not None:
            if value_column not in self.df.columns:
                return {"error": f"Column '{value_column}' not found"}
            if agg != "count" and not pd.api.types.is_numeric_dtype(self.df[value_column]):
                return {"error": f"Column '{value_column}' is not numeric"}
            grouped = self.df.groupby(category_column)[value_column].agg(agg)
            axis_label = f"{agg.capitalize()} of {value_column}"
        else:
            grouped = self.df[category_column].value_counts()
            axis_label = "Count"

        grouped = grouped.dropna().sort_values(ascending=ascending).head(top_n)
        if len(grouped) == 0:
            return {"error": "No data to chart"}

        labels = [str(x) for x in grouped.index.tolist()]
        values = grouped.values.astype(float).tolist()
        labels.reverse()
        values.reverse()

        bar_color = "rgba(239, 68, 68, 0.6)" if ascending else "rgba(16, 185, 129, 0.65)"
        fig = go.Figure()
        fig.add_trace(go.Bar(
            y=labels, x=values, orientation="h",
            marker=dict(color=bar_color, line=dict(color=bar_color.replace("0.6", "0.9").replace("0.65", "0.9"), width=1)),
            text=[f"{v:,.2f}" if not float(v).is_integer() else f"{int(v):,}" for v in values],
            textposition="outside",
            hovertemplate=f"<b>%{{y}}</b><br>{axis_label}: " + "%{x:,.2f}<extra></extra>",
            cliponaxis=False,
        ))
        fig.update_layout(**_themed_layout(
            height=max(200, len(labels) * 32 + 60),
            margin=dict(t=10, r=60, b=30, l=max(80, max((len(l) for l in labels), default=5) * 7)),
            xaxis=dict(title=dict(text=axis_label, font=dict(size=11, color="#94a3b8")), gridcolor="#f1f5f9"),
            yaxis=dict(automargin=True, tickfont=dict(size=11)),
        ))

        return self._to_json(fig)

    # ── 9. Time-series trend ──────────────────────────────────────────

    def create_trend_chart(
        self, date_column: str, value_column: str | None = None, agg: str = "sum"
    ) -> dict[str, Any]:
        """Line chart bucketed to a sensible granularity (day/week/month/year
        based on the date span) with a rolling-average overlay. The single
        most requested view for PMs and finance tracking a metric over time.
        """
        if date_column not in self.df.columns:
            return {"error": f"Column '{date_column}' not found"}
        if pd.api.types.is_numeric_dtype(self.df[date_column]):
            # pd.to_datetime silently reinterprets plain numbers as
            # nanosecond-epoch timestamps instead of failing, which would
            # otherwise produce a nonsensical single-bucket chart.
            return {"error": f"Column '{date_column}' is numeric, not a date"}

        dates = pd.to_datetime(self.df[date_column], errors="coerce")
        valid_mask = dates.notna()
        if valid_mask.sum() < 2:
            return {"error": f"Column '{date_column}' has fewer than 2 parseable dates"}

        work = pd.DataFrame({"__date__": dates[valid_mask].values})
        if value_column is not None:
            if value_column not in self.df.columns:
                return {"error": f"Column '{value_column}' not found"}
            if not pd.api.types.is_numeric_dtype(self.df[value_column]):
                return {"error": f"Column '{value_column}' is not numeric"}
            work["__value__"] = self.df.loc[valid_mask, value_column].values
            axis_label = f"{agg.capitalize()} of {value_column}"
        else:
            work["__value__"] = 1
            agg = "sum"
            axis_label = "Count"

        span_days = (work["__date__"].max() - work["__date__"].min()).days
        if span_days <= 62:
            freq, fmt = "D", "%b %d"
        elif span_days <= 365 * 2:
            freq, fmt = "W", "%b %d, %Y"
        elif span_days <= 365 * 8:
            freq, fmt = "MS", "%b %Y"
        else:
            freq, fmt = "YS", "%Y"

        bucketed = (
            work.set_index("__date__").sort_index().resample(freq)["__value__"].agg(agg)
        )
        bucketed = bucketed.fillna(0) if agg in ("sum", "count") else bucketed
        bucketed = bucketed.dropna()
        if len(bucketed) == 0:
            return {"error": "Not enough data to build a trend"}

        x = bucketed.index.strftime(fmt).tolist()
        y = bucketed.values.astype(float).tolist()

        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=x, y=y, mode="lines+markers", name=axis_label,
            line=dict(color="#4f46e5", width=2), marker=dict(size=5),
            fill="tozeroy", fillcolor="rgba(79,70,229,0.08)",
            hovertemplate="%{x}<br>" + axis_label + ": %{y:,.2f}<extra></extra>",
        ))

        if len(bucketed) >= 5:
            window = max(2, min(7, len(bucketed) // 4))
            rolling = bucketed.rolling(window=window, min_periods=1).mean()
            fig.add_trace(go.Scatter(
                x=x, y=rolling.values.astype(float).tolist(), mode="lines",
                name=f"{window}-point average",
                line=dict(color="#e11d48", width=1.5, dash="dash"),
                hoverinfo="skip",
            ))

        fig.update_layout(**_themed_layout(
            height=320,
            margin=dict(t=10, r=20, b=50, l=60),
            xaxis=dict(tickangle=-30, gridcolor="#f1f5f9"),
            yaxis=dict(title=dict(text=axis_label, font=dict(size=11, color="#94a3b8")), gridcolor="#f1f5f9"),
            showlegend=True,
            legend=dict(x=1, xanchor="right", y=1.18, orientation="h", font=dict(size=10)),
        ))

        return self._to_json(fig)

    # ── 10. Contribution waterfall ────────────────────────────────────

    def create_waterfall_chart(
        self, category_column: str, value_column: str, top_n: int = 12
    ) -> dict[str, Any]:
        """How each category adds to (or subtracts from) the grand total —
        a revenue/profit "bridge" chart, finance's classic contribution view.
        """
        if category_column not in self.df.columns:
            return {"error": f"Column '{category_column}' not found"}
        if value_column not in self.df.columns:
            return {"error": f"Column '{value_column}' not found"}
        if not pd.api.types.is_numeric_dtype(self.df[value_column]):
            return {"error": f"Column '{value_column}' is not numeric"}

        grouped = self.df.groupby(category_column)[value_column].sum(numeric_only=True).dropna()
        if len(grouped) == 0:
            return {"error": "No data to chart"}
        grouped = grouped.reindex(grouped.abs().sort_values(ascending=False).index)

        if len(grouped) > top_n:
            head = grouped.iloc[:top_n]
            other_sum = grouped.iloc[top_n:].sum()
            if other_sum:
                head = pd.concat([head, pd.Series({"Other": other_sum})])
            grouped = head

        labels = [str(x) for x in grouped.index.tolist()] + ["Total"]
        values = grouped.values.astype(float).tolist() + [0]
        measures = ["relative"] * len(grouped) + ["total"]

        fig = go.Figure(go.Waterfall(
            x=labels, y=values, measure=measures,
            increasing=dict(marker=dict(color="rgba(16, 185, 129, 0.75)")),
            decreasing=dict(marker=dict(color="rgba(239, 68, 68, 0.75)")),
            totals=dict(marker=dict(color="rgba(79, 70, 229, 0.75)")),
            connector=dict(line=dict(color="rgba(148, 163, 184, 0.5)", width=1)),
            hovertemplate="<b>%{x}</b><br>%{y:,.2f}<extra></extra>",
        ))
        fig.update_layout(**_themed_layout(
            height=360,
            margin=dict(t=20, r=20, b=90, l=60),
            xaxis=dict(tickangle=-35, automargin=True),
            yaxis=dict(title=dict(text=value_column, font=dict(size=11, color="#94a3b8")), gridcolor="#f1f5f9"),
            showlegend=False,
        ))

        return self._to_json(fig)

    # ── 11. Quality-score radar ────────────────────────────────────────

    def create_quality_radar(self) -> dict[str, Any]:
        """Radar of the 5 quality-score dimensions. Reuses the exact same
        EDAAnalyzer.detect_outliers() + QualityScorer path the main report
        uses, so these numbers always agree with the report's Quality Score
        card — this is a visual of the canonical score, not a re-estimate.
        """
        from analyzer import EDAAnalyzer
        from quality_score import QualityScorer

        outliers = EDAAnalyzer(self.df).detect_outliers()
        quality = QualityScorer(self.df, outliers).calculate_score()
        breakdown = quality["breakdown"]

        categories = [k.replace("_", " ").title() for k in breakdown.keys()]
        values = [breakdown[k]["score"] for k in breakdown.keys()]
        # Close the loop so the radar polygon connects back to its start.
        categories_closed = categories + [categories[0]]
        values_closed = values + [values[0]]

        fig = go.Figure()
        fig.add_trace(go.Scatterpolar(
            r=values_closed, theta=categories_closed, fill="toself",
            fillcolor="rgba(79, 70, 229, 0.25)",
            line=dict(color="#4f46e5", width=2),
            marker=dict(size=6, color="#4f46e5"),
            hovertemplate="<b>%{theta}</b><br>Score: %{r:.1f}/100<extra></extra>",
        ))
        fig.update_layout(**_themed_layout(
            height=340,
            margin=dict(t=30, r=60, b=30, l=60),
            polar=dict(
                radialaxis=dict(visible=True, range=[0, 100], gridcolor="#f1f5f9", tickfont=dict(size=9)),
                angularaxis=dict(tickfont=dict(size=11, color="#334155")),
                bgcolor="rgba(0,0,0,0)",
            ),
            showlegend=False,
        ))

        return self._to_json(fig)

    # ── 12. Numeric scatter matrix ─────────────────────────────────────

    def create_scatter_matrix(
        self, columns: list[str] | None = None, max_cols: int = 4
    ) -> dict[str, Any]:
        """Pairwise scatter grid — lets an analyst spot relationships across
        several numeric columns at once instead of one pair at a time.

        Points are display-sampled above 2,000 rows purely so the browser
        doesn't have to render an unreadable, sluggish cloud of overlapping
        markers; this never affects any computed statistic, only what's drawn.
        """
        numeric_df = self.df.select_dtypes(include=[np.number])
        if numeric_df.shape[1] < 2:
            return {"error": "Need at least 2 numeric columns for a scatter matrix"}

        max_cols = max(2, min(max_cols, 6))
        if columns:
            missing = [c for c in columns if c not in numeric_df.columns]
            if missing:
                return {"error": f"Columns not found or not numeric: {missing}"}
            selected = list(dict.fromkeys(columns))[:max_cols]
        else:
            variances = numeric_df.var(numeric_only=True).sort_values(ascending=False)
            selected = variances.index[:max_cols].tolist()

        if len(selected) < 2:
            return {"error": "Need at least 2 numeric columns for a scatter matrix"}

        plot_df = numeric_df[selected].dropna()
        if len(plot_df) == 0:
            return {"error": "No complete rows across the selected columns"}
        if len(plot_df) > 2000:
            plot_df = plot_df.sample(2000, random_state=42)

        fig = go.Figure(data=go.Splom(
            dimensions=[dict(label=col, values=plot_df[col].tolist()) for col in selected],
            marker=dict(size=4, color="rgba(79, 70, 229, 0.5)", line=dict(width=0)),
            diagonal=dict(visible=False),
            showupperhalf=True,
        ))
        fig.update_layout(**_themed_layout(
            height=max(400, len(selected) * 150),
            margin=dict(t=20, r=20, b=20, l=20),
        ))

        return self._to_json(fig)

    # ── 13. Generate all visualizations ───────────────────────────────

    def _detect_date_column(self) -> str | None:
        """Best-effort pandas-native date-column heuristic for auto-charts.

        Mirrors type_detector.py's >80%-parseable-sample rule but stays
        pandas-only (Visualizer never touches Polars) and returns the first
        qualifying column rather than a full suggestion list.
        """
        for col in self.df.columns:
            if pd.api.types.is_numeric_dtype(self.df[col]):
                continue
            sample = self.df[col].dropna().head(100)
            if len(sample) == 0:
                continue
            parsed = pd.to_datetime(sample, errors="coerce")
            if parsed.notna().mean() > 0.8:
                return col
        return None

    def _auto_pick_category_and_value(self) -> tuple[str | None, str | None]:
        """Pick a "reasonable" categorical column (2-50 uniques — enough to
        rank, not so many the chart is noise) paired with the highest-variance
        numeric column, for auto-generated business charts (pareto/top-n/
        waterfall). Returns (None, None) when nothing suitable exists.
        """
        n_rows = len(self.df)
        if n_rows == 0:
            return None, None

        candidates = []
        for col in self.df.columns:
            if pd.api.types.is_numeric_dtype(self.df[col]):
                continue
            nunique = self.df[col].nunique(dropna=True)
            if 2 <= nunique <= 50:
                candidates.append((nunique, col))
        if not candidates:
            return None, None
        # Prefer more categories (richer ranking) up to the cap.
        candidates.sort(reverse=True)
        category_col = candidates[0][1]

        numeric_df = self.df.select_dtypes(include=[np.number])
        value_col = None
        if numeric_df.shape[1] > 0:
            variances = numeric_df.var(numeric_only=True).dropna().sort_values(ascending=False)
            if len(variances) > 0:
                value_col = variances.index[0]

        return category_col, value_col

    def generate_all_visualizations(self) -> dict[str, Any]:
        """Generate all chart JSONs for the full dataset."""
        charts: dict[str, Any] = {}

        # Correlation heatmap
        charts["correlation_heatmap"] = self.create_correlation_heatmap()

        # Missing data matrix
        charts["missing_data_matrix"] = self.create_missing_data_matrix()

        # Quality score visualized — always computable, ties every report
        # back to Sushi's core "can I trust this data" promise.
        charts["quality_radar"] = self.create_quality_radar()

        # Scatter matrix when there's enough numeric breadth to be useful.
        if self.df.select_dtypes(include=[np.number]).shape[1] >= 3:
            charts["scatter_matrix"] = self.create_scatter_matrix()

        # Auto business charts: only offered when a sensible category+value
        # pair actually exists, so a dataset without one just omits them
        # rather than showing a noisy/meaningless chart.
        category_col, value_col = self._auto_pick_category_and_value()
        if category_col is not None:
            charts["pareto"] = self.create_pareto_chart(category_col, value_col)
            charts["top_n"] = self.create_top_n_chart(category_col, value_col)
            if value_col is not None:
                charts["waterfall"] = self.create_waterfall_chart(category_col, value_col)

        # Auto trend chart when a good date-like column exists.
        date_col = self._detect_date_column()
        if date_col is not None:
            charts["trend"] = self.create_trend_chart(date_col, value_col)

        # Per-column charts
        column_charts: dict[str, Any] = {}
        for col in self.df.columns:
            col_data: dict[str, Any] = {}

            if pd.api.types.is_numeric_dtype(self.df[col]):
                col_data["distribution"] = self.create_distribution_plot(col)
                col_data["box_plot"] = self.create_box_plot(col)
                col_data["violin"] = self.create_violin_plot(col)
            else:
                col_data["categorical_bar"] = self.create_categorical_bar(col)

            column_charts[col] = col_data

        charts["columns"] = column_charts
        return charts
