"use client";

import React, { useCallback, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Wand2 } from "lucide-react";
import { ColumnAnalysis, TypeSuggestion } from "@/lib/types";
import { fetchColumnVisualization } from "@/lib/api";
import { formatNumber, formatPercent } from "@/lib/formatters";
import { Badge } from "@/components/common/Badge";
import { PlotlyChart, PlotlySpec } from "@/components/common/PlotlyChart";
import { cn } from "@/lib/utils";

interface ColumnHealthCardProps {
  column: ColumnAnalysis;
  totalRows: number;
  datasetId: string | null;
  typeSuggestion?: TypeSuggestion;
}

function missingTone(pct: number): "success" | "warning" | "danger" {
  if (pct === 0) return "success";
  if (pct < 10) return "warning";
  return "danger";
}

export function ColumnHealthCard({ column, totalRows, datasetId, typeSuggestion }: ColumnHealthCardProps) {
  const [open, setOpen] = useState(false);
  const [chart, setChart] = useState<PlotlySpec | null>(null);
  const [loadingChart, setLoadingChart] = useState(false);

  const toggle = useCallback(async () => {
    const next = !open;
    setOpen(next);
    if (next && !chart && !loadingChart && datasetId) {
      setLoadingChart(true);
      try {
        const spec = await fetchColumnVisualization(datasetId, column.name, "auto");
        setChart(spec);
      } catch {
        setChart({ error: "Chart unavailable" });
      } finally {
        setLoadingChart(false);
      }
    }
  }, [open, chart, loadingChart, datasetId, column.name]);

  return (
    <div className="rounded-lg border border-border bg-surface">
      <button onClick={toggle} className="flex w-full items-center justify-between gap-3 p-3.5 text-left">
        <div className="flex min-w-0 items-center gap-2.5">
          {open ? <ChevronDown className="h-4 w-4 shrink-0 text-ink-tertiary" /> : <ChevronRight className="h-4 w-4 shrink-0 text-ink-tertiary" />}
          <span className="truncate font-mono text-[13px] font-medium text-ink">{column.name}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge tone={column.is_numeric ? "brand" : "neutral"}>{column.is_numeric ? "numeric" : "categorical"}</Badge>
          <Badge tone={missingTone(column.missing_percent)}>{formatPercent(column.missing_percent)} missing</Badge>
        </div>
      </button>

      {open && (
        <div className={cn("border-t border-border p-3.5")}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Unique" value={formatNumber(column.unique_count)} />
            <Stat label="Missing" value={`${formatNumber(column.missing_count)} (${formatPercent(column.missing_percent)})`} />
            <Stat label="Type" value={column.dtype} mono />
          </div>

          {column.is_numeric && column.stats && (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Mean" value={formatNumber(column.stats.mean, 2)} />
              <Stat label="Median" value={formatNumber(column.stats.median, 2)} />
              <Stat label="Std dev" value={formatNumber(column.stats.std, 2)} />
              <Stat label="Skew" value={formatNumber(column.stats.skewness, 2)} />
              <Stat label="Min" value={formatNumber(column.stats.min, 2)} />
              <Stat label="Q1" value={formatNumber(column.stats.q1, 2)} />
              <Stat label="Q3" value={formatNumber(column.stats.q3, 2)} />
              <Stat label="Max" value={formatNumber(column.stats.max, 2)} />
            </div>
          )}

          {!column.is_numeric && column.top_values && column.top_values.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">Top values</p>
              <div className="flex flex-col gap-1">
                {column.top_values.slice(0, 10).map((tv) => {
                  const pct = totalRows > 0 ? (tv.count / totalRows) * 100 : 0;
                  return (
                    <div key={tv.value} className="flex items-center gap-2">
                      <span className="w-28 shrink-0 truncate font-mono text-[11.5px] text-ink-secondary">{tv.value}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <span className="w-16 shrink-0 text-right font-mono text-[11px] tabular-nums text-ink-tertiary">
                        {formatNumber(tv.count)} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {typeSuggestion && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-brand/20 bg-brand-weak px-2.5 py-2 text-[12px]">
              <Wand2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
              <p className="text-ink-secondary">
                Consider treating this as <strong className="text-ink">{typeSuggestion.suggested_type}</strong> instead of {typeSuggestion.current_type}
                {typeSuggestion.confidence != null && ` (${Math.round(typeSuggestion.confidence * 100)}% confidence)`}. {typeSuggestion.reason}
              </p>
            </div>
          )}

          <div className="mt-3">
            {loadingChart ? (
              <div className="flex h-32 items-center justify-center gap-2 text-[12.5px] text-ink-tertiary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading chart…
              </div>
            ) : (
              chart && <PlotlyChart spec={chart} height={200} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md bg-surface-2 px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-tertiary">{label}</p>
      <p className={cn("mt-0.5 text-[12.5px] font-medium text-ink", mono && "font-mono")}>{value}</p>
    </div>
  );
}
