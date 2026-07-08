"use client";

import React from "react";
import dynamic from "next/dynamic";
import { AlertCircle, Loader2 } from "lucide-react";
import { plotlyConfig, plotlyLayout } from "@/lib/plotly-theme";

const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
  loading: () => (
    <div className="flex h-48 items-center justify-center gap-2 text-[13px] text-ink-tertiary">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading chart…
    </div>
  ),
});

export interface PlotlySpec {
  data?: import("plotly.js").Data[];
  layout?: Partial<import("plotly.js").Layout>;
  error?: string;
}

interface PlotlyChartProps {
  spec: PlotlySpec | null | undefined;
  height?: number;
  className?: string;
}

/** The one chart container every chart in the app renders through. Applies
 * the shared theme, merges any layout overrides from the backend chart
 * spec, and shows a calm, non-alarming "chart unavailable" state instead
 * of a broken render. */
export function PlotlyChart({ spec, height = 280, className }: PlotlyChartProps) {
  if (!spec || spec.error || !spec.data) {
    return (
      <div className={`flex items-center justify-center gap-2 rounded-md border border-dashed border-border-strong bg-surface-2/40 text-[13px] text-ink-tertiary ${className ?? ""}`} style={{ height: Math.min(height, 120) }}>
        <AlertCircle className="h-3.5 w-3.5" />
        {spec?.error ?? "Chart unavailable"}
      </div>
    );
  }

  const layout: Partial<import("plotly.js").Layout> = {
    ...plotlyLayout,
    ...spec.layout,
    autosize: true,
    height,
  };

  return (
    <Plot
      data={spec.data}
      layout={layout}
      config={plotlyConfig}
      useResizeHandler
      style={{ width: "100%" }}
      className={className}
    />
  );
}
