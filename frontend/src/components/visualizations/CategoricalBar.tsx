"use client";

import React from "react";
import dynamic from "next/dynamic";
import { plotlyConfig, plotlyLayout } from "@/lib/plotly-theme";
import { TopValue } from "@/lib/types";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface CategoricalBarProps {
  columnName: string;
  topValues: TopValue[];
  totalRows: number;
}

export function CategoricalBar({ topValues, totalRows }: CategoricalBarProps) {
  if (topValues.length === 0) return null;

  const sorted = [...topValues].sort((a, b) => a.count - b.count);
  const labels = sorted.map((v) => v.value);
  const counts = sorted.map((v) => v.count);
  const pcts = sorted.map((v) => ((v.count / totalRows) * 100).toFixed(1));

  return (
    <Plot
      data={[
        {
          y: labels,
          x: counts,
          type: "bar",
          orientation: "h",
          marker: {
            color: "rgba(242, 112, 74, 0.6)",
            line: { color: "rgba(242, 112, 74, 0.8)", width: 1 },
          },
          text: pcts.map((p) => `${p}%`),
          textposition: "outside",
          textfont: { size: 10, color: "var(--muted-ink)" },
          hovertemplate: sorted.map(
            (v, i) =>
              `<b>${v.value}</b><br>Count: ${v.count.toLocaleString()}<br>` +
              `Percentage: ${pcts[i]}%<extra></extra>`
          ),
          cliponaxis: false,
        },
      ]}
      layout={{
        ...plotlyLayout,
        height: Math.max(180, sorted.length * 28 + 60),
        margin: { t: 10, r: 60, b: 30, l: Math.min(140, Math.max(60, sorted.reduce((m, v) => Math.max(m, v.value.length), 0) * 7)) },
        xaxis: {
          title: { text: "Count", font: { size: 11, color: "var(--faint-ink)" } },
          gridcolor: "var(--line)",
          zerolinecolor: "var(--line-2)",
        },
        yaxis: {
          automargin: true,
          tickfont: { size: 11 },
        },
        bargap: 0.15,
      }}
      config={plotlyConfig}
      useResizeHandler
      style={{ width: "100%" }}
    />
  );
}
