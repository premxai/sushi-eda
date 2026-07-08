"use client";

import React from "react";
import dynamic from "next/dynamic";
import { plotlyConfig, plotlyLayout } from "@/lib/plotly-theme";
import { OutlierInfo } from "@/lib/types";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface BoxPlotProps {
  outliers: OutlierInfo[];
  preview: Record<string, unknown>[];
}

// Cap how far an outlier marker can be plotted from the median, in IQR
// units. A single wildly extreme value (e.g. a typo adding a stray zero)
// would otherwise blow out the shared axis range and squash every box's
// typical range into an invisible sliver. Clamped points are drawn as
// triangles pointing further out, with the real value still in the hover.
const OUTLIER_DISPLAY_CAP = 6;

export function BoxPlot({ outliers, preview }: BoxPlotProps) {
  const cols = outliers.filter((o) => o.outlier_count > 0).slice(0, 8);

  if (cols.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-xs text-slate-400">
        No outliers detected to visualize
      </div>
    );
  }

  // Build box traces from the pre-computed 5-number summary (avoids the
  // 50-row preview limitation). Each column is normalized to "IQRs from its
  // own median" so fields on wildly different scales (e.g. revenue in the
  // millions vs. a 1-5 rating) can share one axis meaningfully.
  //
  // Outlier points are rendered as a SEPARATE scatter trace rather than via
  // the box trace's own `y`/`boxpoints`. Plotly's box trace only honors
  // precomputed q1/median/q3/lowerfence/upperfence when no raw `y` sample is
  // given — supplying `y` (even just the outlier subset, for the marker
  // overlay) makes Plotly re-derive whisker/fence geometry from that tiny,
  // extreme subset instead, producing degenerate full-axis-width whiskers.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const traces: any[] = [];

  cols.forEach((o) => {
    const median = (o.q1 + o.q3) / 2; // approximate — actual median isn't stored
    const iqr = o.iqr || o.q3 - o.q1 || 1; // guard against a zero-width IQR
    const norm = (v: number) => (v - median) / iqr;

    traces.push({
      type: "box",
      name: o.column,
      x: [o.column],
      q1: [norm(o.q1)],
      median: [norm(median)],
      q3: [norm(o.q3)],
      lowerfence: [norm(o.lower_bound)],
      upperfence: [norm(o.upper_bound)],
      boxpoints: false,
      marker: { color: "rgba(79, 70, 229, 0.5)" },
      line: { color: "#4f46e5" },
      fillcolor: "rgba(79, 70, 229, 0.35)",
      hovertemplate:
        `<b>${o.column}</b><br>` +
        `Q1: ${o.q1.toFixed(2)}<br>` +
        `Q3: ${o.q3.toFixed(2)}<br>` +
        `IQR: ${o.iqr.toFixed(2)}<br>` +
        `Whiskers: [${o.lower_bound.toFixed(2)}, ${o.upper_bound.toFixed(2)}]<br>` +
        `Outliers: ${o.outlier_count} (${o.outlier_percent}%)` +
        `<extra></extra>`,
    });

    // Overlay actual outlier points from preview data, on their own trace
    const rawValues = preview
      .map((row) => row[o.column])
      .filter((v) => v != null && typeof v === "number") as number[];
    const outlierValues = rawValues.filter(
      (v) => v < o.lower_bound || v > o.upper_bound
    );

    if (outlierValues.length > 0) {
      const points = outlierValues.map((v) => {
        const n = norm(v);
        const clipped = Math.abs(n) > OUTLIER_DISPLAY_CAP;
        const y = clipped ? Math.sign(n) * OUTLIER_DISPLAY_CAP : n;
        return { raw: v, y, symbol: !clipped ? "circle" : n > 0 ? "triangle-up" : "triangle-down" };
      });

      traces.push({
        type: "scatter",
        mode: "markers",
        name: `${o.column} outliers`,
        x: points.map(() => o.column),
        y: points.map((p) => p.y),
        customdata: points.map((p) => [p.raw, p.symbol === "circle" ? "" : " (far beyond chart edge)"]),
        marker: {
          color: "#ef4444",
          size: 6,
          symbol: points.map((p) => p.symbol),
          line: { color: "#fff", width: 1 },
        },
        showlegend: false,
        hovertemplate: `<b>${o.column}</b><br>Value: %{customdata[0]:.2f}%{customdata[1]}<extra></extra>`,
      });
    }
  });

  return (
    <Plot
      data={traces}
      layout={{
        ...plotlyLayout,
        height: 320,
        margin: { t: 10, r: 20, b: 60, l: 60 },
        showlegend: false,
        yaxis: {
          gridcolor: "#f1f5f9",
          zerolinecolor: "#e2e8f0",
          title: { text: "Spread from typical (IQRs)", font: { size: 11, color: "#94a3b8" } },
          range: [-(OUTLIER_DISPLAY_CAP + 1), OUTLIER_DISPLAY_CAP + 1],
        },
        xaxis: { type: "category", tickangle: -30 },
      }}
      config={plotlyConfig}
      useResizeHandler
      style={{ width: "100%" }}
    />
  );
}
