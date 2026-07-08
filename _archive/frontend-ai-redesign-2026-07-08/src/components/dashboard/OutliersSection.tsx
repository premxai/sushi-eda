"use client";

import React from "react";
import { OutlierInfo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ShieldAlert } from "lucide-react";
import { BoxPlot } from "@/components/visualizations/BoxPlot";

interface OutliersSectionProps {
  outliers: OutlierInfo[];
  preview: Record<string, unknown>[];
}

function severityColor(pct: number): string {
  if (pct === 0) return "text-emerald-600";
  if (pct < 2) return "text-amber-600";
  if (pct < 5) return "text-orange-600";
  return "text-rose-600";
}

function severityBg(pct: number): string {
  if (pct === 0) return "bg-emerald-50 border-emerald-200";
  if (pct < 2) return "bg-amber-50 border-amber-200";
  if (pct < 5) return "bg-orange-50 border-orange-200";
  return "bg-rose-50 border-rose-200";
}

export function OutliersSection({ outliers, preview }: OutliersSectionProps) {
  if (outliers.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-white p-12">
        <p className="text-sm text-slate-500">
          This view looks for unusually large or small numbers — this dataset has no numeric fields to check.
        </p>
      </div>
    );
  }

  const sorted = [...outliers].sort((a, b) => b.outlier_percent - a.outlier_percent);
  const totalOutliers = sorted.reduce((sum, o) => sum + o.outlier_count, 0);
  const colsWithOutliers = sorted.filter((o) => o.outlier_count > 0).length;

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 leading-5">
        Unusual values are numbers far outside the typical range for their field — a $90,000
        order among $50 orders, or an age of 200. They can be data-entry mistakes or real but
        rare events, and either way they can quietly distort averages and totals.
      </p>

      {/* Summary strip */}
      <div className="flex gap-4">
        <div className="flex-1 rounded-lg border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md">
          <p className="text-xs font-medium text-slate-500">Unusual Values Found</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{totalOutliers.toLocaleString()}</p>
        </div>
        <div className="flex-1 rounded-lg border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md">
          <p className="text-xs font-medium text-slate-500">Fields Affected</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {colsWithOutliers} <span className="text-sm font-normal text-slate-400">/ {sorted.length}</span>
          </p>
        </div>
        <div className="flex-1 rounded-lg border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md">
          <p className="text-xs font-medium text-slate-500">How they&apos;re found</p>
          <p className="mt-1 text-sm font-medium text-slate-900">Far outside the typical range</p>
          <p className="text-[11px] text-slate-400">Statistical rule (IQR × 1.5)</p>
        </div>
      </div>

      {/* Box plot visualization */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md">
        <h3 className="text-sm font-medium text-slate-900">Where the unusual values sit</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Each box shows a field&apos;s typical range; red dots are the values that fall far outside it
        </p>
        <div className="mt-2">
          <BoxPlot outliers={outliers} preview={preview} />
        </div>
      </div>

      {/* Per-column cards */}
      <div className="space-y-2">
        {sorted.map((o) => (
          <div
            key={o.column}
            className="rounded-lg border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("rounded-lg p-2 border", severityBg(o.outlier_percent))}>
                  <ShieldAlert className={cn("h-4 w-4", severityColor(o.outlier_percent))} />
                </div>
                <div>
                  <p className="font-mono text-sm font-medium text-slate-900">{o.column}</p>
                  <p className="text-xs text-slate-500">
                    {o.outlier_count === 0
                      ? "all values look typical"
                      : `${o.outlier_count.toLocaleString()} value${o.outlier_count !== 1 ? "s" : ""} far outside the typical range`}
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-xs font-medium",
                  severityBg(o.outlier_percent),
                  severityColor(o.outlier_percent)
                )}
              >
                {o.outlier_percent}%
              </span>
            </div>

            {o.outlier_count > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-md bg-slate-50 px-3 py-2">
                  <p className="text-[11px] text-slate-400">Typical range</p>
                  <p className="mt-0.5 font-mono text-sm text-slate-900 tabular-nums">{o.q1} – {o.q3}</p>
                </div>
                <div className="rounded-md bg-slate-50 px-3 py-2">
                  <p className="text-[11px] text-slate-400">Flagged below</p>
                  <p className="mt-0.5 font-mono text-sm text-slate-900 tabular-nums">{o.lower_bound}</p>
                </div>
                <div className="rounded-md bg-slate-50 px-3 py-2">
                  <p className="text-[11px] text-slate-400">Flagged above</p>
                  <p className="mt-0.5 font-mono text-sm text-slate-900 tabular-nums">{o.upper_bound}</p>
                </div>
              </div>
            )}

            {/* Visual range bar */}
            {o.outlier_count > 0 && (
              <div className="mt-3">
                <div className="relative h-2 w-full rounded-full bg-slate-100">
                  {(() => {
                    const totalRange = o.upper_bound - o.lower_bound;
                    if (totalRange <= 0) return null;
                    const iqrStart = ((o.q1 - o.lower_bound) / totalRange) * 100;
                    const iqrWidth = ((o.q3 - o.q1) / totalRange) * 100;
                    return (
                      <>
                        <div
                          className="absolute top-0 h-full rounded-full bg-brand/30"
                          style={{ left: `${iqrStart}%`, width: `${iqrWidth}%` }}
                        />
                        <div className="absolute left-0 top-0 h-full w-1 rounded-full bg-rose-400" />
                        <div className="absolute right-0 top-0 h-full w-1 rounded-full bg-rose-400" />
                      </>
                    );
                  })()}
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-slate-400 tabular-nums">
                  <span>{o.lower_bound}</span>
                  <span className="text-brand">typical range</span>
                  <span>{o.upper_bound}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
