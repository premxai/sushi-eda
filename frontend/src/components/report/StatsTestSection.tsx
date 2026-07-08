"use client";

import React, { useMemo, useState } from "react";
import { Loader2, Play, Sigma } from "lucide-react";
import { ColumnAnalysis } from "@/lib/types";
import { getColumnOptions, TEST_REGISTRY, TestSpec } from "@/lib/stats-tests";
import { getApiErrorMessage } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Disclosure } from "@/components/common/Disclosure";
import { cn } from "@/lib/utils";

interface StatsTestSectionProps {
  datasetId: string | null;
  columns: ColumnAnalysis[];
}

export function StatsTestSection({ datasetId, columns }: StatsTestSectionProps) {
  const [testKey, setTestKey] = useState(TEST_REGISTRY[0].key);
  const [advanced, setAdvanced] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<any>(null);

  const test: TestSpec = useMemo(() => TEST_REGISTRY.find((t) => t.key === testKey) ?? TEST_REGISTRY[0], [testKey]);

  const setField = (key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value }));

  const visibleFields = test.fields.filter((f) => advanced || !f.advanced);
  const canRun = datasetId && test.fields.filter((f) => f.kind === "column").every((f) => values[f.key] || getColumnOptions(columns, f.filter)[0]?.value);

  const handleRun = async () => {
    if (!datasetId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const merged: Record<string, string> = {};
      test.fields.forEach((f) => {
        if (values[f.key] != null && values[f.key] !== "") {
          merged[f.key] = values[f.key];
        } else if (f.kind === "column") {
          merged[f.key] = getColumnOptions(columns, f.filter)[0]?.value ?? "";
        } else if (f.defaultValue != null) {
          merged[f.key] = String(f.defaultValue);
        }
      });
      const r = await test.run(datasetId, merged);
      setResult(r);
    } catch (err) {
      setError(getApiErrorMessage(err, "Couldn't run this test — check the columns you picked and try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleTestChange = (key: string) => {
    setTestKey(key);
    setValues({});
    setResult(null);
    setError(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Sigma className="h-4 w-4 text-brand" />
        <h2 className="text-[15px] font-semibold text-ink">Compare & Validate</h2>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TEST_REGISTRY.map((t) => (
          <button
            key={t.key}
            onClick={() => handleTestChange(t.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[12.5px] font-medium",
              t.key === testKey ? "border-brand/30 bg-brand-weak text-brand" : "border-border bg-surface text-ink-secondary hover:border-border-strong",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="text-[13px] text-ink-secondary">{test.description}</p>

        <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visibleFields.map((field) => {
            if (field.kind === "column") {
              const options = getColumnOptions(columns, field.filter);
              return (
                <div key={field.key}>
                  <label className="mb-1 block text-[11.5px] font-medium text-ink-secondary">{field.label}</label>
                  <Select value={values[field.key] || options[0]?.value} onValueChange={(v) => setField(field.key, v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a column" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((o) => (
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

        <div className="mt-4 flex items-center justify-between">
          <button onClick={() => setAdvanced((a) => !a)} className="text-[12px] text-ink-tertiary hover:text-ink-secondary">
            {advanced ? "Hide advanced options" : "Show advanced options"}
          </button>
          <Button size="sm" onClick={handleRun} disabled={!canRun || loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Run
          </Button>
        </div>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {result && (
        <div className="rounded-lg border border-brand/20 bg-brand-weak p-4">
          <p className="text-[13.5px] leading-relaxed text-ink">{test.interpret(result)}</p>
          <Disclosure summary="See the numbers" className="mt-3 bg-surface">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
              {Object.entries(result)
                .filter(([, v]) => typeof v === "number" || typeof v === "string" || typeof v === "boolean")
                .map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[10.5px] uppercase tracking-wide text-ink-tertiary">{k.replace(/_/g, " ")}</dt>
                    <dd className="font-mono text-[12px] text-ink">{String(v)}</dd>
                  </div>
                ))}
            </dl>
          </Disclosure>
        </div>
      )}
    </div>
  );
}
