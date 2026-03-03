"use client";

import React, { useState, useCallback } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ColumnAnalysis } from "@/lib/types";
import { fetchColumnVisualization } from "@/lib/api";
import dynamic from "next/dynamic";
import { plotlyConfig } from "@/lib/plotly-theme";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface ColumnCardProps {
  column: ColumnAnalysis;
  preview: Record<string, unknown>[];
  totalRows: number;
}

function dtypeBadgeColor(dtype: string): string {
  if (dtype.includes("int") || dtype.includes("float")) return "bg-indigo-50 text-indigo-700 border-indigo-200";
  if (dtype.includes("object") || dtype.includes("str")) return "bg-amber-50 text-amber-700 border-amber-200";
  if (dtype.includes("bool")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (dtype.includes("datetime") || dtype.includes("date")) return "bg-violet-50 text-violet-700 border-violet-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function missingBadge(pct: number): string {
  if (pct === 0) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (pct < 5) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BackendChart({ spec }: { spec: any }) {
  if (!spec || spec.error) return null;
  const layout = {
    ...(spec.layout ?? {}),
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: "Inter, sans-serif", size: 11, color: "#334155" },
    autosize: true,
    margin: { t: 10, r: 20, b: 40, l: 55 },
  };
  return (
    <Plot
      data={spec.data ?? []}
      layout={layout}
      config={{ ...plotlyConfig, responsive: true }}
      useResizeHandler
      style={{ width: "100%", minHeight: layout.height ?? 220 }}
    />
  );
}

export function ColumnCard({ column, totalRows }: ColumnCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [chartSpec, setChartSpec] = useState<Record<string, any> | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [boxSpec, setBoxSpec] = useState<Record<string, any> | null>(null);

  const handleToggle = useCallback(async () => {
    const opening = !isOpen;
    setIsOpen(opening);
    if (opening && !chartSpec && !chartLoading) {
      setChartLoading(true);
      try {
        // Primary chart: distribution for numeric, categorical_bar for text
        const primary = await fetchColumnVisualization(column.name, "auto");
        setChartSpec(primary);
        // For numeric columns, also fetch box plot
        if (column.is_numeric) {
          const box = await fetchColumnVisualization(column.name, "box_plot");
          setBoxSpec(box);
        }
      } catch {
        // backend not available — chart stays null, stats still visible
      } finally {
        setChartLoading(false);
      }
    }
  }, [isOpen, chartSpec, chartLoading, column.name, column.is_numeric]);

  return (
    <div className="rounded-2xl bg-white transition-shadow hover:shadow-md" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
      {/* Header — always visible */}
      <button
        onClick={handleToggle}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "#9060f8" }} />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
          )}
          <span className="truncate font-mono text-sm font-medium text-slate-900">
            {column.name}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", dtypeBadgeColor(column.dtype))}>
            {column.dtype}
          </span>
          <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", missingBadge(column.missing_percent))}>
            {column.missing_percent}% missing
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div className="p-4" style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <StatCell label="Unique" value={column.unique_count.toLocaleString()} />
            <StatCell label="Missing" value={`${column.missing_count.toLocaleString()} (${column.missing_percent}%)`} />
            <StatCell label="Type" value={column.dtype} mono />
          </div>

          {/* Numeric stats */}
          {column.is_numeric && column.stats && (
            <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <StatCell label="Mean" value={column.stats.mean.toLocaleString()} />
              <StatCell label="Median" value={column.stats.median.toLocaleString()} />
              <StatCell label="Std Dev" value={column.stats.std.toLocaleString()} />
              <StatCell label="Skewness" value={column.stats.skewness.toLocaleString()} />
              <StatCell label="Min" value={column.stats.min.toLocaleString()} />
              <StatCell label="Q1" value={column.stats.q1.toLocaleString()} />
              <StatCell label="Q3" value={column.stats.q3.toLocaleString()} />
              <StatCell label="Max" value={column.stats.max.toLocaleString()} />
            </div>
          )}

          {/* Top values for categorical */}
          {!column.is_numeric && column.top_values && column.top_values.length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Top Values</p>
              <div className="space-y-1.5">
                {column.top_values.slice(0, 8).map((tv) => {
                  const pct = ((tv.count / totalRows) * 100).toFixed(1);
                  return (
                    <div key={tv.value} className="flex items-center gap-2">
                      <span className="w-32 shrink-0 truncate font-mono text-xs text-slate-700">{tv.value}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(100, (tv.count / totalRows) * 100)}%`, background: "linear-gradient(90deg, #9060f8, #e840c8)" }}
                        />
                      </div>
                      <span className="w-16 shrink-0 text-right font-mono text-xs text-slate-500 tabular-nums">
                        {tv.count.toLocaleString()} ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Charts */}
          <div className="mt-4 space-y-3">
            {chartLoading && (
              <div className="flex h-32 items-center justify-center gap-2 text-xs text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: "#9060f8" }} />
                Loading chart…
              </div>
            )}
            {!chartLoading && chartSpec && (
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
                <BackendChart spec={chartSpec} />
              </div>
            )}
            {!chartLoading && boxSpec && (
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.05)" }}>
                <BackendChart spec={boxSpec} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.04)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={cn("mt-0.5 text-sm font-semibold text-slate-800 tabular-nums", mono && "font-mono")}>
        {value}
      </p>
    </div>
  );
}
