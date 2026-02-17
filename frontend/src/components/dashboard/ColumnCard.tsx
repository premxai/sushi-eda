"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ColumnAnalysis } from "@/lib/types";
import { DistributionChart } from "@/components/visualizations/DistributionChart";
import { CategoricalBar } from "@/components/visualizations/CategoricalBar";

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

export function ColumnCard({ column, preview, totalRows }: ColumnCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-lg border border-slate-200 bg-white transition-shadow hover:shadow-md">
      {/* Header — always visible */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
          )}
          <span className="truncate font-mono text-sm font-medium text-slate-900">
            {column.name}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-xs font-medium",
              dtypeBadgeColor(column.dtype)
            )}
          >
            {column.dtype}
          </span>
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-xs font-medium",
              missingBadge(column.missing_percent)
            )}
          >
            {column.missing_percent}% missing
          </span>
        </div>
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div className="border-t border-slate-100 p-4">
          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCell label="Unique" value={column.unique_count.toLocaleString()} />
            <StatCell label="Missing" value={`${column.missing_count.toLocaleString()} (${column.missing_percent}%)`} />
            <StatCell label="Type" value={column.dtype} mono />
          </div>

          {/* Numeric stats + sparkline */}
          {column.is_numeric && column.stats && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCell label="Mean" value={column.stats.mean.toLocaleString()} />
                <StatCell label="Median" value={column.stats.median.toLocaleString()} />
                <StatCell label="Std Dev" value={column.stats.std.toLocaleString()} />
                <StatCell label="Skewness" value={column.stats.skewness.toLocaleString()} />
                <StatCell label="Min" value={column.stats.min.toLocaleString()} />
                <StatCell label="Q1" value={column.stats.q1.toLocaleString()} />
                <StatCell label="Q3" value={column.stats.q3.toLocaleString()} />
                <StatCell label="Max" value={column.stats.max.toLocaleString()} />
              </div>

              {/* Interactive histogram */}
              <div className="rounded-md border border-slate-100 bg-white">
                <DistributionChart
                  columnName={column.name}
                  stats={column.stats}
                  preview={preview}
                />
              </div>
            </div>
          )}

          {/* Categorical: interactive bar chart */}
          {!column.is_numeric && column.top_values && column.top_values.length > 0 && (
            <div className="mt-4 rounded-md border border-slate-100 bg-white">
              <CategoricalBar
                columnName={column.name}
                topValues={column.top_values}
                totalRows={totalRows}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCell({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-sm font-medium text-slate-900 tabular-nums",
          mono && "font-mono"
        )}
      >
        {value}
      </p>
    </div>
  );
}
