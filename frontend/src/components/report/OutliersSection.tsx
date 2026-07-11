"use client";

import React, { useCallback, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, SearchX } from "lucide-react";
import { OutlierInfo } from "@/lib/types";
import { fetchColumnVisualization } from "@/lib/api";
import { formatNumber, formatPercent } from "@/lib/formatters";
import { outlierSeverity, outlierSeverityLabel, totalOutliers, columnsWithOutliers, OutlierSeverity } from "@/lib/report-utils";
import { Badge } from "@/components/common/Badge";
import { EmptyState } from "@/components/common/EmptyState";
import { MetricCard } from "@/components/common/MetricCard";
import { PlotlyChart, PlotlySpec } from "@/components/common/PlotlyChart";
import { cn } from "@/lib/utils";
import { ReportSectionHeading } from "@/components/report/ReportSectionHeading";

interface OutliersSectionProps {
  outliers: OutlierInfo[];
  datasetId: string | null;
}

const SEVERITY_TONE: Record<OutlierSeverity, "neutral" | "success" | "warning" | "danger"> = {
  none: "success",
  low: "neutral",
  moderate: "warning",
  high: "danger",
};

function OutlierCard({ outlier, datasetId }: { outlier: OutlierInfo; datasetId: string | null }) {
  const [open, setOpen] = useState(false);
  const [chart, setChart] = useState<PlotlySpec | null>(null);
  const [loadingChart, setLoadingChart] = useState(false);
  const severity = outlierSeverity(outlier.outlier_percent);

  const toggle = useCallback(async () => {
    const next = !open;
    setOpen(next);
    if (next && !chart && !loadingChart && datasetId) {
      setLoadingChart(true);
      try {
        const spec = await fetchColumnVisualization(datasetId, outlier.column, "box_plot");
        setChart(spec);
      } catch {
        setChart({ error: "Chart unavailable" });
      } finally {
        setLoadingChart(false);
      }
    }
  }, [open, chart, loadingChart, datasetId, outlier.column]);

  return (
    <div className="rounded-lg border border-border bg-surface">
      <button onClick={toggle} className="flex w-full items-center justify-between gap-3 p-3.5 text-left">
        <div className="flex min-w-0 items-center gap-2.5">
          {open ? <ChevronDown className="h-4 w-4 shrink-0 text-ink-tertiary" /> : <ChevronRight className="h-4 w-4 shrink-0 text-ink-tertiary" />}
          <span className="truncate font-mono text-[13px] font-medium text-ink">{outlier.column}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge tone={SEVERITY_TONE[severity]}>{outlierSeverityLabel(severity)}</Badge>
          <span className="font-mono text-[12px] tabular-nums text-ink-tertiary">
            {formatNumber(outlier.outlier_count)} ({formatPercent(outlier.outlier_percent)})
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-border p-3.5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Typical range" value={`${formatNumber(outlier.q1, 2)} – ${formatNumber(outlier.q3, 2)}`} />
            <Stat label="Flagged below" value={formatNumber(outlier.lower_bound, 2)} />
            <Stat label="Flagged above" value={formatNumber(outlier.upper_bound, 2)} />
            <Stat label="IQR" value={formatNumber(outlier.iqr, 2)} />
          </div>
          <div className="mt-3">
            {loadingChart ? (
              <div className="flex h-32 items-center justify-center gap-2 text-[12.5px] text-ink-tertiary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading chart…
              </div>
            ) : (
              chart && <PlotlyChart spec={chart} height={220} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-2 px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-tertiary">{label}</p>
      <p className={cn("mt-0.5 text-[12.5px] font-medium text-ink")}>{value}</p>
    </div>
  );
}

export function OutliersSection({ outliers, datasetId }: OutliersSectionProps) {
  const total = totalOutliers(outliers);
  const flaggedColumns = columnsWithOutliers(outliers);

  if (outliers.length === 0 || total === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title="No unusual values were flagged"
        description="That usually means the numeric columns look consistent."
      />
    );
  }

  const sorted = [...outliers].sort((a, b) => b.outlier_percent - a.outlier_percent);

  return (
    <div className="flex flex-col gap-4">
      <ReportSectionHeading icon={SearchX} eyebrow="Data quality" title="Inspect unusual values." description="Review values that sit outside the expected range, then open a field for the evidence behind each flag." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
        <MetricCard label="Unusual values found" value={formatNumber(total)} tone={total > 0 ? "warning" : "neutral"} />
        <MetricCard label="Columns affected" value={`${flaggedColumns} of ${outliers.length}`} />
      </div>

      <div className="flex flex-col gap-2">
        {sorted.map((o) => (
          <OutlierCard key={o.column} outlier={o} datasetId={datasetId} />
        ))}
      </div>
    </div>
  );
}
