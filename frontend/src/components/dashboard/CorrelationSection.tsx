"use client";

import React from "react";
import { CorrelationMatrix } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CorrelationHeatmap } from "@/components/visualizations/CorrelationHeatmap";

interface CorrelationSectionProps {
  data: CorrelationMatrix;
}

export function CorrelationSection({ data }: CorrelationSectionProps) {
  if (data.columns.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-white p-12">
        <p className="text-sm text-slate-500">No numeric columns found for correlation analysis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Heatmap */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md">
        <h3 className="text-sm font-medium text-slate-900">Correlation Heatmap</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Pearson correlation · Red (negative) → White (0) → Indigo (positive) · Strong correlations (|r| &gt; 0.7) annotated
        </p>
        <div className="mt-4 w-full" style={{ minHeight: Math.max(400, data.columns.length * 40) + 20 }}>
          <CorrelationHeatmap data={data} />
        </div>
      </div>

      {/* Top correlations table */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md">
        <h3 className="text-sm font-medium text-slate-900">Strongest Correlations</h3>
        <div className="mt-3">
          <TopCorrelations data={data} />
        </div>
      </div>
    </div>
  );
}

function TopCorrelations({ data }: { data: CorrelationMatrix }) {
  const pairs: { col1: string; col2: string; value: number }[] = [];
  for (let i = 0; i < data.columns.length; i++) {
    for (let j = i + 1; j < data.columns.length; j++) {
      pairs.push({
        col1: data.columns[i],
        col2: data.columns[j],
        value: data.matrix[i][j],
      });
    }
  }
  const sorted = pairs.sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 10);

  if (sorted.length === 0) {
    return <p className="text-xs text-slate-400">Not enough column pairs.</p>;
  }

  return (
    <div className="space-y-1.5">
      {sorted.map((p, i) => (
        <div key={i} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-slate-50">
          <span className="w-32 shrink-0 truncate font-mono text-xs text-slate-700">{p.col1}</span>
          <span className="text-xs text-slate-400">&harr;</span>
          <span className="w-32 shrink-0 truncate font-mono text-xs text-slate-700">{p.col2}</span>
          <div className="flex-1">
            <div className="h-1.5 w-full rounded-full bg-slate-100">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  p.value >= 0 ? "bg-indigo-400" : "bg-rose-400"
                )}
                style={{ width: `${Math.abs(p.value) * 100}%` }}
              />
            </div>
          </div>
          <span
            className={cn(
              "w-14 shrink-0 text-right font-mono text-xs font-medium tabular-nums",
              Math.abs(p.value) > 0.7
                ? "text-slate-900"
                : "text-slate-500"
            )}
          >
            {p.value > 0 ? "+" : ""}
            {p.value.toFixed(3)}
          </span>
        </div>
      ))}
    </div>
  );
}
