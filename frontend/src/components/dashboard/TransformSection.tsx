"use client";

import React, { useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { EDAReport } from "@/lib/types";
import { transformColumn } from "@/lib/api";

interface TransformSectionProps {
  report: EDAReport;
  onReportUpdate: (report: EDAReport, preview: Record<string, unknown>[]) => void;
}

type TransformType =
  | "log_transform"
  | "normalize"
  | "standardize"
  | "bin_equal_width"
  | "bin_equal_freq"
  | "one_hot_encode"
  | "label_encode"
  | "extract_datetime";

interface TransformConfig {
  type: TransformType;
  columns: string[];
  n_bins?: number;
}

const TRANSFORM_META: Record<TransformType, { label: string; description: string; forNumeric: boolean; forCategorical: boolean; forDatetime: boolean }> = {
  log_transform: {
    label: "Log Transform (log1p)",
    description: "Reduce right skew. Creates new column with `_log` suffix. Auto-shifts negatives.",
    forNumeric: true, forCategorical: false, forDatetime: false,
  },
  normalize: {
    label: "Min-Max Normalize [0, 1]",
    description: "Scale values to 0–1 range. Creates `_norm` column.",
    forNumeric: true, forCategorical: false, forDatetime: false,
  },
  standardize: {
    label: "Z-Score Standardize",
    description: "Mean=0, Std=1. Creates `_std` column. Good for ML.",
    forNumeric: true, forCategorical: false, forDatetime: false,
  },
  bin_equal_width: {
    label: "Bin — Equal Width",
    description: "Discretize into N equal-width buckets. Creates `_bin` column.",
    forNumeric: true, forCategorical: false, forDatetime: false,
  },
  bin_equal_freq: {
    label: "Bin — Equal Frequency (Quantile)",
    description: "Discretize into N equal-count buckets. Creates `_qbin` column.",
    forNumeric: true, forCategorical: false, forDatetime: false,
  },
  one_hot_encode: {
    label: "One-Hot Encode",
    description: "Create binary indicator columns for each category (max 20 unique values).",
    forNumeric: false, forCategorical: true, forDatetime: false,
  },
  label_encode: {
    label: "Label Encode",
    description: "Convert categories to integers. Creates `_enc` column.",
    forNumeric: false, forCategorical: true, forDatetime: false,
  },
  extract_datetime: {
    label: "Extract Datetime Features",
    description: "Create year, month, day, dayofweek, hour columns from a datetime.",
    forNumeric: false, forCategorical: false, forDatetime: true,
  },
};

export function TransformSection({ report, onReportUpdate }: TransformSectionProps) {
  const [configs, setConfigs] = useState<TransformConfig[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{ log: string[]; totalColumns: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const numericCols = report.column_analysis.filter((c) => c.is_numeric).map((c) => c.name);
  const categoricalCols = report.column_analysis.filter((c) => !c.is_numeric && c.dtype === "object").map((c) => c.name);
  const datetimedCols = report.column_analysis.filter((c) => c.dtype.includes("datetime")).map((c) => c.name);

  const addTransform = (type: TransformType) => {
    setConfigs((prev) => [...prev, { type, columns: [], n_bins: 5 }]);
  };

  const removeTransform = (idx: number) => {
    setConfigs((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateColumns = (idx: number, cols: string[]) => {
    setConfigs((prev) => prev.map((c, i) => i === idx ? { ...c, columns: cols } : c));
  };

  const updateBins = (idx: number, n: number) => {
    setConfigs((prev) => prev.map((c, i) => i === idx ? { ...c, n_bins: n } : c));
  };

  const toggleColumn = (idx: number, col: string) => {
    const current = configs[idx].columns;
    const next = current.includes(col) ? current.filter((c) => c !== col) : [...current, col];
    updateColumns(idx, next);
  };

  const handleRun = async () => {
    const ready = configs.filter((c) => c.columns.length > 0);
    if (ready.length === 0) return;

    setIsRunning(true);
    setError(null);
    setResult(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: Record<string, any> = {};
    for (const cfg of ready) {
      if (cfg.type === "bin_equal_width" || cfg.type === "bin_equal_freq") {
        // These ops take one column at a time — use the first selected
        payload[cfg.type] = { column: cfg.columns[0], n_bins: cfg.n_bins ?? 5 };
      } else {
        payload[cfg.type] = cfg.columns;
      }
    }

    try {
      const data = await transformColumn(payload);
      setResult({ log: data.transform_log, totalColumns: data.total_columns });
      onReportUpdate(data.report, data.report.preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transform failed");
    } finally {
      setIsRunning(false);
    }
  };

  const readyCount = configs.filter((c) => c.columns.length > 0).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Feature Engineering & Transforms</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Add new derived columns. Original columns are preserved.
            </p>
          </div>
          <button
            onClick={handleRun}
            disabled={isRunning || readyCount === 0}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
              readyCount > 0 && !isRunning
                ? "bg-violet-600 text-white hover:bg-violet-700"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            )}
          >
            {isRunning ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Running…</>
            ) : (
              <><FlaskConical className="h-4 w-4" /> Apply {readyCount} transform{readyCount !== 1 ? "s" : ""}</>
            )}
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-800">Transforms applied — dataset now has {result.totalColumns} columns</p>
              <div className="mt-2 space-y-1">
                {result.log.map((entry, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-emerald-700">
                    <span className="mt-0.5 text-emerald-400">•</span>
                    <span>{entry}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-500 mt-0.5" />
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      )}

      {/* Add transform buttons */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-400">Add a transform</p>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(TRANSFORM_META) as [TransformType, typeof TRANSFORM_META[TransformType]][]).map(([type, meta]) => {
            const available =
              (meta.forNumeric && numericCols.length > 0) ||
              (meta.forCategorical && categoricalCols.length > 0) ||
              (meta.forDatetime && datetimedCols.length > 0);
            return (
              <button
                key={type}
                onClick={() => addTransform(type)}
                disabled={!available}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                  available
                    ? "border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                    : "border-slate-100 text-slate-300 cursor-not-allowed"
                )}
              >
                + {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Configured transforms */}
      {configs.map((cfg, idx) => {
        const meta = TRANSFORM_META[cfg.type];
        const availableCols = meta.forNumeric
          ? numericCols
          : meta.forCategorical
          ? categoricalCols
          : datetimedCols;
        const isBinOp = cfg.type === "bin_equal_width" || cfg.type === "bin_equal_freq";

        return (
          <div key={idx} className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{meta.label}</p>
                <p className="text-xs text-slate-500">{meta.description}</p>
              </div>
              <button
                onClick={() => removeTransform(idx)}
                className="text-xs text-slate-400 hover:text-rose-500 transition-colors ml-4 shrink-0"
              >
                Remove
              </button>
            </div>

            {/* Column selector */}
            <div>
              <p className="mb-2 text-xs font-medium text-slate-600">
                {isBinOp ? "Select one column:" : "Select columns:"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {availableCols.map((col) => {
                  const selected = cfg.columns.includes(col);
                  const disabled = isBinOp && cfg.columns.length >= 1 && !selected;
                  return (
                    <button
                      key={col}
                      onClick={() => !disabled && toggleColumn(idx, col)}
                      className={cn(
                        "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors",
                        selected
                          ? "border-indigo-400 bg-indigo-100 text-indigo-800"
                          : disabled
                          ? "border-slate-100 text-slate-300 cursor-not-allowed"
                          : "border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-white"
                      )}
                    >
                      {col}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bins config */}
            {isBinOp && (
              <div className="mt-3 flex items-center gap-3">
                <label className="text-xs text-slate-600">Number of bins:</label>
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={cfg.n_bins ?? 5}
                  onChange={(e) => updateBins(idx, parseInt(e.target.value) || 5)}
                  className="w-16 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-900 focus:border-indigo-400 focus:outline-none"
                />
              </div>
            )}
          </div>
        );
      })}

      {configs.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 bg-white py-12 text-slate-400">
          <FlaskConical className="h-8 w-8" />
          <p className="text-sm">No transforms added yet</p>
          <p className="text-xs">Click a transform above to add it</p>
        </div>
      )}
    </div>
  );
}
