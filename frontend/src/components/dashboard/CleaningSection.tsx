"use client";

import React, { useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, Wand2, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { EDAReport } from "@/lib/types";
import { cleanDataset } from "@/lib/api";

interface CleaningSectionProps {
  report: EDAReport;
  onReportUpdate: (report: EDAReport, preview: Record<string, unknown>[]) => void;
}

interface CleaningOp {
  id: string;
  label: string;
  description: string;
  category: string;
  enabled: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config?: Record<string, any>;
}

const defaultOps = (report: EDAReport): CleaningOp[] => {
  const hasNumeric = report.column_analysis.some((c) => c.is_numeric);
  const hasCategorical = report.column_analysis.some((c) => !c.is_numeric);
  const hasMissing = report.basic_info.total_missing > 0;
  const hasDuplicates = report.basic_info.duplicate_rows > 0;
  const hasOutliers = report.outliers.some((o) => o.outlier_count > 0);

  return [
    {
      id: "remove_duplicates",
      label: "Remove duplicate rows",
      description: `${report.basic_info.duplicate_rows.toLocaleString()} duplicate rows detected`,
      category: "Deduplication",
      enabled: hasDuplicates,
    },
    {
      id: "impute_numeric_mean",
      label: "Impute numeric missing → mean",
      description: "Fill missing numbers with each column's mean value",
      category: "Missing Values",
      enabled: hasMissing && hasNumeric,
    },
    {
      id: "impute_numeric_median",
      label: "Impute numeric missing → median",
      description: "Fill missing numbers with each column's median (robust to outliers)",
      category: "Missing Values",
      enabled: false,
    },
    {
      id: "impute_categorical_mode",
      label: "Impute categorical missing → mode",
      description: "Fill missing text/category values with the most frequent value",
      category: "Missing Values",
      enabled: hasMissing && hasCategorical,
    },
    {
      id: "drop_missing_rows",
      label: "Drop rows with any missing values",
      description: "Remove all rows that contain at least one null value",
      category: "Missing Values",
      enabled: false,
    },
    {
      id: "drop_missing_cols_50",
      label: "Drop columns with >50% missing",
      description: "Remove columns that are mostly empty",
      category: "Missing Values",
      enabled: hasMissing,
      config: { drop_missing_cols_threshold: 0.5 },
    },
    {
      id: "cap_outliers",
      label: "Cap outliers (IQR Winsorization)",
      description: "Clip extreme values to the IQR whisker bounds",
      category: "Outliers",
      enabled: hasOutliers,
    },
    {
      id: "drop_constant_columns",
      label: "Drop constant columns",
      description: "Remove columns with only one unique value — they add no information",
      category: "Columns",
      enabled: report.column_analysis.some((c) => c.unique_count <= 1),
    },
    {
      id: "strip_whitespace",
      label: "Strip whitespace from strings",
      description: "Trim leading/trailing spaces from all text columns",
      category: "Strings",
      enabled: hasCategorical,
    },
    {
      id: "lowercase_strings",
      label: "Lowercase all strings",
      description: "Normalize text columns to lowercase",
      category: "Strings",
      enabled: false,
    },
    {
      id: "rename_snake_case",
      label: "Rename columns to snake_case",
      description: "Standardize column names: spaces→underscores, remove special chars",
      category: "Columns",
      enabled: false,
    },
  ];
};

const CATEGORIES = ["Deduplication", "Missing Values", "Outliers", "Columns", "Strings"];

export function CleaningSection({ report, onReportUpdate }: CleaningSectionProps) {
  const [ops, setOps] = useState<CleaningOp[]>(() => defaultOps(report));
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{ log: string[]; rowsBefore: number; rowsAfter: number; colsBefore: number; colsAfter: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORIES));

  const toggleOp = (id: string) => {
    setOps((prev) => prev.map((op) => op.id === id ? { ...op, enabled: !op.enabled } : op));
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleRun = async () => {
    const enabledOps = ops.filter((o) => o.enabled);
    if (enabledOps.length === 0) return;

    setIsRunning(true);
    setError(null);
    setResult(null);

    // Build the operations payload
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: Record<string, any> = {};
    for (const op of enabledOps) {
      switch (op.id) {
        case "remove_duplicates": payload.remove_duplicates = true; break;
        case "impute_numeric_mean": payload.impute_numeric = "mean"; break;
        case "impute_numeric_median": payload.impute_numeric = "median"; break;
        case "impute_categorical_mode": payload.impute_categorical = "mode"; break;
        case "drop_missing_rows": payload.drop_missing_rows = true; break;
        case "drop_missing_cols_50": payload.drop_missing_cols_threshold = 0.5; break;
        case "cap_outliers": payload.cap_outliers = true; break;
        case "drop_constant_columns": payload.drop_constant_columns = true; break;
        case "strip_whitespace": payload.strip_whitespace = true; break;
        case "lowercase_strings": payload.lowercase_strings = true; break;
        case "rename_snake_case": payload.rename_snake_case = true; break;
      }
    }

    try {
      const data = await cleanDataset(payload);
      setResult({
        log: data.cleaning_log,
        rowsBefore: data.rows_before,
        rowsAfter: data.rows_after,
        colsBefore: data.cols_before,
        colsAfter: data.cols_after,
      });
      onReportUpdate(data.report, data.report.preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cleaning failed");
    } finally {
      setIsRunning(false);
    }
  };

  const enabledCount = ops.filter((o) => o.enabled).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Data Cleaning</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Select operations to apply. Changes update the active dataset in memory.
            </p>
          </div>
          <button
            onClick={handleRun}
            disabled={isRunning || enabledCount === 0}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
              enabledCount > 0 && !isRunning
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            )}
          >
            {isRunning ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Running…</>
            ) : (
              <><Wand2 className="h-4 w-4" /> Run {enabledCount} operation{enabledCount !== 1 ? "s" : ""}</>
            )}
          </button>
        </div>
      </div>

      {/* Result banner */}
      {result && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-800">Cleaning complete</p>
              <div className="mt-2 flex gap-4 text-xs text-emerald-700">
                <span>Rows: <strong>{result.rowsBefore.toLocaleString()} → {result.rowsAfter.toLocaleString()}</strong> ({(result.rowsBefore - result.rowsAfter).toLocaleString()} removed)</span>
                <span>Cols: <strong>{result.colsBefore} → {result.colsAfter}</strong></span>
              </div>
              <div className="mt-3 space-y-1">
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

      {/* Operations by category */}
      {CATEGORIES.map((cat) => {
        const catOps = ops.filter((op) => op.category === cat);
        if (catOps.length === 0) return null;
        const isExpanded = expandedCategories.has(cat);
        const enabledInCat = catOps.filter((o) => o.enabled).length;

        return (
          <div key={cat} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <button
              onClick={() => toggleCategory(cat)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                <span className="text-sm font-medium text-slate-900">{cat}</span>
                {enabledInCat > 0 && (
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                    {enabledInCat} selected
                  </span>
                )}
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-slate-100 divide-y divide-slate-50">
                {catOps.map((op) => (
                  <label
                    key={op.id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors",
                      op.enabled ? "bg-indigo-50/40" : "hover:bg-slate-50"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={op.enabled}
                      onChange={() => toggleOp(op.id)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{op.label}</p>
                      <p className="text-xs text-slate-500">{op.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
