"use client";

import React from "react";
import dynamic from "next/dynamic";
import { plotlyConfig, plotlyLayout } from "@/lib/plotly-theme";
import { ColumnStats } from "@/lib/types";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface DistributionChartProps {
  columnName: string;
  stats: ColumnStats;
  preview: Record<string, unknown>[];
}

export function DistributionChart({ columnName, stats, preview }: DistributionChartProps) {
  const values = preview
    .map((row) => row[columnName])
    .filter((v) => v != null && v !== "" && typeof v === "number") as number[];

  if (values.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-xs text-slate-400">
        No numeric data to plot
      </div>
    );
  }

  return (
    <Plot
      data={[
        {
          x: values,
          type: "histogram",
          marker: {
            color: "rgba(79, 70, 229, 0.6)",
            line: { color: "rgba(79, 70, 229, 0.8)", width: 1 },
          },
          nbinsx: Math.min(30, Math.max(10, Math.ceil(Math.sqrt(values.length)))),
          name: "Distribution",
          hovertemplate: "Range: %{x}<br>Count: %{y}<extra></extra>",
        } as Plotly.Data,
        {
          x: [stats.mean, stats.mean],
          y: [0, 1],
          yaxis: "y2",
          type: "scatter",
          mode: "lines",
          line: { color: "#e11d48", width: 1.5, dash: "dash" },
          name: `Mean (${stats.mean})`,
          hoverinfo: "name",
        },
        {
          x: [stats.median, stats.median],
          y: [0, 1],
          yaxis: "y2",
          type: "scatter",
          mode: "lines",
          line: { color: "#059669", width: 1.5, dash: "dash" },
          name: `Median (${stats.median})`,
          hoverinfo: "name",
        },
      ]}
      layout={{
        ...plotlyLayout,
        height: 220,
        margin: { t: 10, r: 20, b: 35, l: 50 },
        showlegend: true,
        legend: {
          x: 1,
          xanchor: "right",
          y: 1,
          font: { size: 10, color: "#64748b" },
          bgcolor: "transparent",
        },
        xaxis: {
          title: { text: columnName, font: { size: 11, color: "#94a3b8" } },
          gridcolor: "#f1f5f9",
          zerolinecolor: "#e2e8f0",
        },
        yaxis: {
          title: { text: "Count", font: { size: 11, color: "#94a3b8" } },
          gridcolor: "#f1f5f9",
          zerolinecolor: "#e2e8f0",
        },
        yaxis2: {
          overlaying: "y",
          visible: false,
          range: [0, 1],
        },
        bargap: 0.05,
      }}
      config={plotlyConfig}
      useResizeHandler
      style={{ width: "100%" }}
    />
  );
}
