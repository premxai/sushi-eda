"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CorrelationMatrix } from "@/lib/types";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface CorrelationPanelProps {
  data: CorrelationMatrix;
}

export function CorrelationPanel({ data }: CorrelationPanelProps) {
  if (data.columns.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">No numeric columns found for correlation analysis.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Correlation Heatmap</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full overflow-x-auto">
          <Plot
            data={[
              {
                z: data.matrix,
                x: data.columns,
                y: data.columns,
                type: "heatmap",
                colorscale: [
                  [0, "#6366f1"],
                  [0.5, "#fafafa"],
                  [1, "#f43f5e"],
                ],
                zmin: -1,
                zmax: 1,
                text: data.matrix.map((row) =>
                  row.map((v) => v.toFixed(2))
                ) as unknown as string[],
                hovertemplate: "%{x} vs %{y}<br>r = %{text}<extra></extra>",
              },
            ]}
            layout={{
              autosize: true,
              height: Math.max(400, data.columns.length * 40),
              margin: { l: 120, r: 40, t: 20, b: 120 },
              paper_bgcolor: "transparent",
              plot_bgcolor: "transparent",
              font: { family: "Inter, system-ui, sans-serif", size: 11, color: "#71717a" },
              xaxis: { tickangle: -45 },
              yaxis: { autorange: "reversed" as const },
            }}
            config={{ displayModeBar: false, responsive: true }}
            className="w-full"
            useResizeHandler
            style={{ width: "100%" }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
