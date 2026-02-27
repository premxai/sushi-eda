"use client";

import React from "react";
import dynamic from "next/dynamic";
import { AlertCircle, BarChart3, Loader2 } from "lucide-react";
import { EDAReport } from "@/lib/types";
import { plotlyConfig } from "@/lib/plotly-theme";

const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
  loading: () => (
    <div className="flex h-48 items-center justify-center text-xs text-slate-400">
      Loading chart...
    </div>
  ),
});

interface VisualizationsSectionProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  visualizations: Record<string, any> | null;
  isLoading: boolean;
  report: EDAReport;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PlotSpec = any;

// Renders a single Plotly figure from a backend-generated JSON spec
function PlotlyChart({ spec, title }: { spec: PlotSpec; title?: string }) {
  if (!spec || spec.error) {
    return (
      <div className="flex h-24 items-center justify-center gap-2 rounded-lg bg-slate-50 text-xs text-slate-400">
        <AlertCircle className="h-3.5 w-3.5" />
        {spec?.error ?? "Chart unavailable"}
      </div>
    );
  }

  // Backend returns fig.to_plotly_json() — use its layout directly,
  // only override cosmetic properties to match the app theme
  const backendLayout = spec.layout ?? {};
  const layout = {
    ...backendLayout,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: "Inter, sans-serif", size: 12, color: "#334155" },
    autosize: true,
  };

  const data = spec.data ?? [];

  return (
    <div>
      {title && (
        <p className="mb-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
          {title}
        </p>
      )}
      <Plot
        data={data}
        layout={layout}
        config={{ ...plotlyConfig, responsive: true }}
        useResizeHandler
        style={{ width: "100%", minHeight: backendLayout.height ?? 280 }}
      />
    </div>
  );
}

export function VisualizationsSection({
  visualizations,
  isLoading,
  report,
}: VisualizationsSectionProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">Generating visualizations…</p>
      </div>
    );
  }

  if (!visualizations) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-400">
        <BarChart3 className="h-8 w-8" />
        <p className="text-sm">Visualizations will appear here.</p>
        <p className="text-xs text-slate-400">
          Navigate away and come back, or re-select this tab to load them.
        </p>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columnCharts: Record<string, { distribution?: any; box_plot?: any; categorical_bar?: any }> =
    visualizations.columns ?? {};

  const numericColumns = report.column_analysis.filter((c) => c.is_numeric);
  const categoricalColumns = report.column_analysis.filter((c) => !c.is_numeric);

  return (
    <div className="space-y-8">
      {/* ── Global charts ─────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-sm font-semibold text-slate-900">Dataset Overview</h2>
        <div className="space-y-6">
          {/* Correlation heatmap */}
          {visualizations.correlation_heatmap && !visualizations.correlation_heatmap.error && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="mb-3 text-sm font-medium text-slate-700">Correlation Heatmap</p>
              <PlotlyChart spec={visualizations.correlation_heatmap} />
            </div>
          )}

          {/* Missing data matrix */}
          {visualizations.missing_data_matrix && !visualizations.missing_data_matrix.error && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="mb-3 text-sm font-medium text-slate-700">Missing Data Matrix</p>
              <PlotlyChart spec={visualizations.missing_data_matrix} />
            </div>
          )}
        </div>
      </section>

      {/* ── Numeric columns ───────────────────────────────────── */}
      {numericColumns.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold text-slate-900">
            Numeric Columns
            <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-normal text-indigo-600">
              {numericColumns.length}
            </span>
          </h2>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {numericColumns.map((col) => {
              const charts = columnCharts[col.name] ?? {};
              return (
                <div
                  key={col.name}
                  className="rounded-lg border border-slate-200 bg-white p-4"
                >
                  <p className="mb-3 font-mono text-sm font-medium text-slate-900">
                    {col.name}
                    <span className="ml-2 font-sans text-[11px] font-normal text-slate-400">
                      {col.dtype}
                    </span>
                  </p>
                  <div className="space-y-4">
                    {charts.distribution && (
                      <PlotlyChart spec={charts.distribution} title="Distribution" />
                    )}
                    {charts.box_plot && (
                      <PlotlyChart spec={charts.box_plot} title="Box Plot" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Categorical columns ───────────────────────────────── */}
      {categoricalColumns.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold text-slate-900">
            Categorical Columns
            <span className="ml-2 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-normal text-violet-600">
              {categoricalColumns.length}
            </span>
          </h2>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {categoricalColumns.map((col) => {
              const charts = columnCharts[col.name] ?? {};
              return (
                <div
                  key={col.name}
                  className="rounded-lg border border-slate-200 bg-white p-4"
                >
                  <p className="mb-3 font-mono text-sm font-medium text-slate-900">
                    {col.name}
                    <span className="ml-2 font-sans text-[11px] font-normal text-slate-400">
                      {col.dtype}
                    </span>
                  </p>
                  {charts.categorical_bar && (
                    <PlotlyChart spec={charts.categorical_bar} />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
