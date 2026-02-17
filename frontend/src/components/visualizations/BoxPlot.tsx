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
  if (outliers.length === 0) return null;

  const cols = outliers.filter((o) => o.outlier_count > 0).slice(0, 8);
  if (cols.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-xs text-slate-400">
        No outliers detected to visualize
      </div>
    );
  }

  const traces = cols.map((o) => {
    const values = preview
      .map((row) => row[o.column])
      .filter((v) => v != null && typeof v === "number") as number[];

    return {
      y: values,
      type: "box" as const,
      name: o.column,
      marker: {
        color: "rgba(79, 70, 229, 0.5)",
        outliercolor: "#ef4444",
        size: 4,
        line: { outliercolor: "#ef4444", outlierwidth: 1.5 },
      },
      boxpoints: "outliers" as const,
      line: { color: "#4f46e5" },
      fillcolor: "rgba(79, 70, 229, 0.1)",
      hovertemplate: `<b>${o.column}</b><br>` +
        `Value: %{y}<br>` +
        `IQR: [${o.q1}, ${o.q3}]<br>` +
        `Bounds: [${o.lower_bound}, ${o.upper_bound}]` +
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
        xaxis: {
          tickangle: -30,
        },
      }}
      config={plotlyConfig}
      useResizeHandler
      style={{ width: "100%" }}
    />
  );
}
