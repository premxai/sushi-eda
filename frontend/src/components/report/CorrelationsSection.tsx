"use client";

import React, { useEffect, useState } from "react";
import { Network } from "lucide-react";
import { CorrelationMatrix } from "@/lib/types";
import { fetchDatasetVisualizations } from "@/lib/api";
import { rankCorrelations, describeCorrelation } from "@/lib/report-utils";
import { formatNumber } from "@/lib/formatters";
import { EmptyState } from "@/components/common/EmptyState";
import { PlotlyChart, PlotlySpec } from "@/components/common/PlotlyChart";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

interface CorrelationsSectionProps {
  matrix: CorrelationMatrix;
  datasetId: string | null;
}

export function CorrelationsSection({ matrix, datasetId }: CorrelationsSectionProps) {
  const [heatmap, setHeatmap] = useState<PlotlySpec | null>(null);
  const [loading, setLoading] = useState(false);
  const pairs = rankCorrelations(matrix);

  useEffect(() => {
    if (!datasetId || matrix.columns.length < 2) return;
    let cancelled = false;
    setLoading(true);
    fetchDatasetVisualizations(datasetId)
      .then((all) => {
        if (!cancelled) setHeatmap(all.correlation_heatmap ?? { error: "Chart unavailable" });
      })
      .catch(() => {
        if (!cancelled) setHeatmap({ error: "Chart unavailable" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [datasetId, matrix.columns.length]);

  if (matrix.columns.length < 2) {
    return (
      <EmptyState
        icon={Network}
        title="Not enough numeric columns"
        description="This dataset does not have enough numeric columns to compare relationships."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Network className="h-4 w-4 text-brand" />
        <h2 className="text-[15px] font-semibold text-ink">What Moves Together</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Correlation heatmap</CardTitle>
        </CardHeader>
        {loading ? (
          <div className="flex h-48 items-center justify-center text-[13px] text-ink-tertiary">Loading chart…</div>
        ) : (
          <PlotlyChart spec={heatmap} height={Math.max(320, matrix.columns.length * 40)} />
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Strongest relationships</CardTitle>
        </CardHeader>
        {pairs.length === 0 ? (
          <p className="text-[13px] text-ink-secondary">No relationships stand out between the numeric columns in this dataset.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {pairs.slice(0, 10).map((pair) => (
              <div key={`${pair.col1}-${pair.col2}`} className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-2/40 px-3 py-2">
                <p className="text-[13px] text-ink">{describeCorrelation(pair)}</p>
                <span className="shrink-0 font-mono text-[12px] tabular-nums text-ink-tertiary">r = {formatNumber(pair.r, 3)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
