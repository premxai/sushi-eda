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

export function BoxPlot({ outliers, preview }: BoxPlotProps) {
  const cols = outliers.filter((o) => o.outlier_count > 0).slice(0, 8);

  if (cols.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-xs text-slate-400">
        No outliers detected to visualize
      </div>
    );
  }

  // Build box traces using the full 5-number summary from outlier metadata.
  // This avoids the 50-row preview limitation — we use the pre-computed stats.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const traces: any[] = cols.map((o) => {
    // Collect raw values from preview for individual point scatter (best-effort)
    const rawValues = preview
      .map((row) => row[o.column])
      .filter((v) => v != null && typeof v === "number") as number[];

    // Detect outlier values from preview to show as red dots
    const outlierValues = rawValues.filter(
      (v) => v < o.lower_bound || v > o.upper_bound
    );

    // Use pre-computed 5-number summary as the box
    const median = (o.q1 + o.q3) / 2; // approximate — actual median isn't stored
    return {
      type: "box",
      name: o.column,
      // Plotly box with pre-set quartiles
      q1: [o.q1],
      median: [median],
      q3: [o.q3],
      lowerfence: [o.lower_bound],
      upperfence: [o.upper_bound],
      // Overlay actual outlier points from preview data
      ...(outlierValues.length > 0 && {
        y: outlierValues,
        boxpoints: "outliers",
      }),
      marker: {
        color: "rgba(79, 70, 229, 0.5)",
        outliercolor: "#ef4444",
        size: 4,
        line: { outliercolor: "#ef4444", outlierwidth: 1.5 },
      },
      line: { color: "#4f46e5" },
      fillcolor: "rgba(79, 70, 229, 0.1)",
      hovertemplate:
        `<b>${o.column}</b><br>` +
        `Q1: ${o.q1.toFixed(2)}<br>` +
        `Q3: ${o.q3.toFixed(2)}<br>` +
        `IQR: ${o.iqr.toFixed(2)}<br>` +
        `Whiskers: [${o.lower_bound.toFixed(2)}, ${o.upper_bound.toFixed(2)}]<br>` +
        `Outliers: ${o.outlier_count} (${o.outlier_percent}%)` +
        `<extra></extra>`,
    };
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
          title: { text: "Value", font: { size: 11, color: "#94a3b8" } },
        },
        xaxis: { tickangle: -30 },
      }}
      config={plotlyConfig}
      useResizeHandler
      style={{ width: "100%" }}
    />
  );
}
