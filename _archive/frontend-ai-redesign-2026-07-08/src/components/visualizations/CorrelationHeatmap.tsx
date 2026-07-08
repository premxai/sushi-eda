"use client";

import React from "react";
import dynamic from "next/dynamic";
import { plotlyConfig, plotlyLayout } from "@/lib/plotly-theme";
import { CorrelationMatrix } from "@/lib/types";

const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 items-center justify-center text-xs text-slate-400">
      Loading chart...
    </div>
  ),
});

interface CorrelationHeatmapProps {
  data: CorrelationMatrix;
}

export function CorrelationHeatmap({ data }: CorrelationHeatmapProps) {
  if (data.columns.length === 0) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const annotations: any[] = [];
  for (let i = 0; i < data.columns.length; i++) {
    for (let j = 0; j < data.columns.length; j++) {
      const val = data.matrix[i][j];
      if (Math.abs(val) > 0.7 || i === j) {
        annotations.push({
          x: data.columns[j],
          y: data.columns[i],
          text: val.toFixed(2),
          showarrow: false,
          font: {
            size: Math.min(10, Math.max(7, 120 / data.columns.length)),
            color: Math.abs(val) > 0.5 ? "var(--ink)" : "var(--muted-ink)",
          },
        });
      }
    }
  }

  return (
    <Plot
      data={[
        {
          z: data.matrix,
          x: data.columns,
          y: data.columns,
          type: "heatmap",
          colorscale: [
            [0, "#6E8F2E"],
            [0.25, "#C3D49B"],
            [0.5, "#FBF7EE"],
            [0.75, "#F7B79F"],
            [1, "#F2704A"],
          ],
          zmin: -1,
          zmax: 1,
          text: data.matrix.map((row) => row.map((v) => `r = ${v.toFixed(3)}`)) as unknown as string[],
          hovertemplate: "<b>%{x}</b> vs <b>%{y}</b><br>%{text}<extra></extra>",
          showscale: true,
          colorbar: {
            thickness: 14,
            outlinewidth: 0,
            tickvals: [-1, -0.5, 0, 0.5, 1],
            tickfont: { size: 10, color: "var(--muted-ink)" },
          },
        },
      ]}
      layout={{
        ...plotlyLayout,
        autosize: true,
        height: Math.max(450, data.columns.length * 45),
        margin: { l: 120, r: 40, t: 20, b: 120 },
        xaxis: { tickangle: -45, side: "bottom", automargin: true },
        yaxis: { autorange: "reversed" as const, automargin: true },
        annotations,
      }}
      config={plotlyConfig}
      useResizeHandler
      className="w-full"
      style={{ width: "100%", minHeight: Math.max(450, data.columns.length * 45) }}
    />
  );
}
