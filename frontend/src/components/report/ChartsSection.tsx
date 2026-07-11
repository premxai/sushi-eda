"use client";

import React, { useMemo, useState } from "react";
import { BarChart3, Loader2, Play } from "lucide-react";
import { ColumnAnalysis } from "@/lib/types";
import { CHART_REGISTRY, ChartSpec, getChartColumnOptions } from "@/lib/chart-specs";
import { getApiErrorMessage } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { PlotlyChart, PlotlySpec } from "@/components/common/PlotlyChart";
import { cn } from "@/lib/utils";
import { ReportSectionHeading } from "@/components/report/ReportSectionHeading";

interface ChartsSectionProps {
  datasetId: string | null;
  columns: ColumnAnalysis[];
}

const NONE_SENTINEL = "__none__";

export function ChartsSection({ datasetId, columns }: ChartsSectionProps) {
  const [chartKey, setChartKey] = useState(CHART_REGISTRY[0].key);
  const [advanced, setAdvanced] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlotlySpec | null>(null);

  const chart: ChartSpec = useMemo(() => CHART_REGISTRY.find((c) => c.key === chartKey) ?? CHART_REGISTRY[0], [chartKey]);

  const setField = (key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value }));

  const visibleFields = chart.fields.filter((f) => advanced || !f.advanced);
  const canRun = datasetId && chart.fields.filter((f) => f.kind === "column" && !f.optional).every((f) => values[f.key] || getChartColumnOptions(columns, f.filter)[0]?.value);

  const handleRun = async () => {
    if (!datasetId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const merged: Record<string, string> = {};
      chart.fields.forEach((f) => {
        if (values[f.key] != null) {
          merged[f.key] = values[f.key] === NONE_SENTINEL ? "" : values[f.key];
        } else if (f.kind === "column") {
          merged[f.key] = f.optional ? "" : (getChartColumnOptions(columns, f.filter)[0]?.value ?? "");
        } else if (f.defaultValue != null) {
          merged[f.key] = String(f.defaultValue);
        }
      });
      const spec = await chart.run(datasetId, merged);
      setResult(spec);
    } catch (err) {
      setError(getApiErrorMessage(err, "Couldn't build this chart. Check the columns you picked and try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleChartChange = (key: string) => {
    setChartKey(key);
    setValues({});
    setResult(null);
    setError(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <ReportSectionHeading icon={BarChart3} eyebrow="Visual analysis" title="Build the right view." description="Choose a chart, set the fields, and turn this dataset into a clear visual answer." />

      <div className="flex flex-wrap gap-1.5">
        {CHART_REGISTRY.map((c) => (
          <button
            key={c.key}
            onClick={() => handleChartChange(c.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[12.5px] font-medium",
              c.key === chartKey ? "border-brand/30 bg-brand-weak text-brand" : "border-border bg-surface text-ink-secondary hover:border-border-strong",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="text-[13px] text-ink-secondary">{chart.description}</p>

        {visibleFields.length > 0 && (
          <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {visibleFields.map((field) => {
              if (field.kind === "column") {
                const options = getChartColumnOptions(columns, field.filter);
                const withNone = field.optional ? [{ label: "(count of rows)", value: NONE_SENTINEL }, ...options] : options;
                const current = values[field.key] ?? (field.optional ? NONE_SENTINEL : options[0]?.value);
                return (
                  <div key={field.key}>
                    <label className="mb-1 block text-[11.5px] font-medium text-ink-secondary">{field.label}</label>
                    <Select value={current} onValueChange={(v) => setField(field.key, v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a column" />
                      </SelectTrigger>
                      <SelectContent>
                        {withNone.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              }
              if (field.kind === "select") {
                return (
                  <div key={field.key}>
                    <label className="mb-1 block text-[11.5px] font-medium text-ink-secondary">{field.label}</label>
                    <Select value={values[field.key] || String(field.defaultValue)} onValueChange={(v) => setField(field.key, v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options?.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              }
              return (
                <div key={field.key}>
                  <label className="mb-1 block text-[11.5px] font-medium text-ink-secondary">{field.label}</label>
                  <Input
                    type="number"
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    value={values[field.key] ?? String(field.defaultValue ?? "")}
                    onChange={(e) => setField(field.key, e.target.value)}
                  />
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          {chart.fields.some((f) => f.advanced) ? (
            <button onClick={() => setAdvanced((a) => !a)} className="text-[12px] text-ink-tertiary hover:text-ink-secondary">
              {advanced ? "Hide advanced options" : "Show advanced options"}
            </button>
          ) : (
            <span />
          )}
          <Button size="sm" onClick={handleRun} disabled={!canRun || loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Build chart
          </Button>
        </div>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {(loading || result) && (
        <div className="rounded-lg border border-border bg-surface p-4">
          {loading ? (
            <div className="flex h-48 items-center justify-center gap-2 text-[13px] text-ink-tertiary">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Building chart…
            </div>
          ) : (
            <PlotlyChart spec={result} height={360} />
          )}
        </div>
      )}
    </div>
  );
}
