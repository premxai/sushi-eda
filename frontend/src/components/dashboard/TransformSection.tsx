"use client";

import React, { useState } from "react";
import { CheckCircle2, AlertTriangle, FlaskConical, Loader2, X } from "lucide-react";
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
  | "extract_datetime"
  | "interaction_product"
  | "interaction_ratio"
  | "rolling_stats"
  | "lag_features";

interface TransformConfig {
  type: TransformType;
  columns: string[];
  col2?: string;        // for interaction transforms
  n_bins?: number;
  window?: number;
  lags?: number[];
}

interface TransformMeta {
  label: string;
  description: string;
  group: string;
  forNumeric: boolean;
  forCategorical: boolean;
  forDatetime: boolean;
  twoColumn?: boolean;
  needsWindow?: boolean;
  needsLags?: boolean;
}

const TRANSFORM_META: Record<TransformType, TransformMeta> = {
  log_transform:       { label: "Log (log1p)",           description: "Reduce right skew. Auto-shifts negatives.", group: "Scaling", forNumeric: true, forCategorical: false, forDatetime: false },
  normalize:           { label: "Min-Max [0,1]",          description: "Scale to 0–1 range.",                      group: "Scaling", forNumeric: true, forCategorical: false, forDatetime: false },
  standardize:         { label: "Z-Score",                description: "Mean=0, Std=1. Good for ML.",              group: "Scaling", forNumeric: true, forCategorical: false, forDatetime: false },
  bin_equal_width:     { label: "Bin Equal-Width",        description: "Equal-width buckets.",                     group: "Binning", forNumeric: true, forCategorical: false, forDatetime: false },
  bin_equal_freq:      { label: "Bin Equal-Freq",         description: "Equal-frequency (quantile) buckets.",      group: "Binning", forNumeric: true, forCategorical: false, forDatetime: false },
  one_hot_encode:      { label: "One-Hot Encode",         description: "Binary indicators per category (≤20 unique).", group: "Encoding", forNumeric: false, forCategorical: true, forDatetime: false },
  label_encode:        { label: "Label Encode",           description: "Categories to integers.",                  group: "Encoding", forNumeric: false, forCategorical: true, forDatetime: false },
  extract_datetime:    { label: "Extract Datetime",       description: "Year, month, day, dow, hour.",             group: "Datetime", forNumeric: false, forCategorical: false, forDatetime: true },
  interaction_product: { label: "A × B Product",         description: "Multiply two numeric columns.",            group: "Interactions", forNumeric: true, forCategorical: false, forDatetime: false, twoColumn: true },
  interaction_ratio:   { label: "A ÷ B Ratio",           description: "Divide col1 by col2 (zero-safe).",         group: "Interactions", forNumeric: true, forCategorical: false, forDatetime: false, twoColumn: true },
  rolling_stats:       { label: "Rolling Stats",          description: "Rolling mean + std over a window.",        group: "Time-Series", forNumeric: true, forCategorical: false, forDatetime: false, needsWindow: true },
  lag_features:        { label: "Lag Features",           description: "Shift column N steps back (lag-1,2,3).",  group: "Time-Series", forNumeric: true, forCategorical: false, forDatetime: false, needsLags: true },
};

const GROUPS = ["Scaling", "Binning", "Encoding", "Datetime", "Interactions", "Time-Series"];

export function TransformSection({ report, onReportUpdate }: TransformSectionProps) {
  const [configs, setConfigs] = useState<TransformConfig[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{ log: string[]; totalColumns: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const numericCols = report.column_analysis.filter((c) => c.is_numeric).map((c) => c.name);
  const categoricalCols = report.column_analysis.filter((c) => !c.is_numeric && c.dtype === "object").map((c) => c.name);
  const datetimeCols = report.column_analysis.filter((c) => c.dtype.includes("datetime")).map((c) => c.name);

  const colsFor = (meta: TransformMeta) =>
    meta.forNumeric ? numericCols : meta.forCategorical ? categoricalCols : datetimeCols;

  const addTransform = (type: TransformType) =>
    setConfigs((prev) => [...prev, { type, columns: [], n_bins: 5, window: 3, lags: [1, 2, 3] }]);

  const removeTransform = (idx: number) =>
    setConfigs((prev) => prev.filter((_, i) => i !== idx));

  const toggleColumn = (idx: number, col: string) => {
    const cfg = configs[idx];
    const meta = TRANSFORM_META[cfg.type];
    const isSingle = meta.twoColumn || cfg.type === "bin_equal_width" || cfg.type === "bin_equal_freq" || meta.needsWindow || meta.needsLags;
    setConfigs((prev) => prev.map((c, i) => {
      if (i !== idx) return c;
      const has = c.columns.includes(col);
      const next = has ? c.columns.filter((x) => x !== col) : isSingle ? [col] : [...c.columns, col];
      return { ...c, columns: next };
    }));
  };

  const handleRun = async () => {
    const ready = configs.filter((c) => c.columns.length > 0);
    if (ready.length === 0) return;
    setIsRunning(true); setError(null); setResult(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: Record<string, any> = {};
    for (const cfg of ready) {
      switch (cfg.type) {
        case "bin_equal_width":
        case "bin_equal_freq":
          payload[cfg.type] = { column: cfg.columns[0], n_bins: cfg.n_bins ?? 5 };
          break;
        case "interaction_product":
        case "interaction_ratio":
          if (cfg.columns.length >= 1 && cfg.col2) {
            payload[cfg.type] = { col1: cfg.columns[0], col2: cfg.col2 };
          }
          break;
        case "rolling_stats":
          payload.rolling_stats = { column: cfg.columns[0], window: cfg.window ?? 3 };
          break;
        case "lag_features":
          payload.lag_features = { column: cfg.columns[0], lags: cfg.lags ?? [1, 2, 3] };
          break;
        default:
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

  const readyCount = configs.filter((c) => {
    const meta = TRANSFORM_META[c.type];
    return c.columns.length > 0 && (!meta.twoColumn || c.col2);
  }).length;

  const inputStyle: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,0.12)", borderRadius: 6, padding: "4px 8px",
    fontSize: 12, background: "rgba(255,255,255,0.9)", color: "#111010", outline: "none",
  };

  return (
    <div style={{ padding: "24px 32px", maxWidth: 820, margin: "0 auto" }}>
      <style>{`@keyframes shimmer { 0%{background-position:0% 0} 100%{background-position:200% 0} } @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111010", margin: 0 }}>Feature Engineering</h2>
          <p style={{ fontSize: 13, color: "#9a9690", margin: "4px 0 0" }}>
            Add derived columns. Original columns are always preserved.
          </p>
        </div>
        <button
          onClick={handleRun}
          disabled={isRunning || readyCount === 0}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "9px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
            border: "none", cursor: readyCount > 0 && !isRunning ? "pointer" : "not-allowed",
            background: readyCount > 0 && !isRunning
              ? "linear-gradient(135deg, #9060f8, #e840c8)"
              : "rgba(0,0,0,0.08)",
            color: readyCount > 0 && !isRunning ? "#fff" : "#9a9690",
            opacity: isRunning ? 0.7 : 1,
          }}
        >
          {isRunning
            ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Running…</>
            : <><FlaskConical size={13} /> Apply {readyCount} transform{readyCount !== 1 ? "s" : ""}</>}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div style={{
          background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.2)",
          borderRadius: 12, padding: "12px 16px", marginBottom: 16,
          display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <CheckCircle2 size={16} style={{ color: "#22c55e", flexShrink: 0, marginTop: 2 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#15803d", margin: 0 }}>
              Done — dataset now has {result.totalColumns} columns
            </p>
            <div style={{ marginTop: 6 }}>
              {result.log.map((entry, i) => (
                <p key={i} style={{ fontSize: 11, color: "#166534", margin: "2px 0",
                  fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace" }}>• {entry}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: 12, padding: "12px 16px", marginBottom: 16,
          display: "flex", gap: 10, alignItems: "flex-start",
        }}>
          <AlertTriangle size={16} style={{ color: "#ef4444", flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 13, color: "#991b1b", margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Transform type picker */}
      <div style={{
        background: "rgba(255,255,255,0.72)", border: "1px solid rgba(0,0,0,0.07)",
        borderRadius: 14, overflow: "hidden", marginBottom: 16,
      }}>
        <div style={{ height: 3, background: "linear-gradient(90deg,#9060f8,#e840c8,#00d4e8,#9060f8)", backgroundSize: "200% 100%", animation: "shimmer 4s linear infinite" }} />
        <div style={{ padding: "14px 18px" }}>
          <p style={{
            fontSize: 9, letterSpacing: "1.5px", textTransform: "uppercase",
            color: "#9a9690", fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
            fontWeight: 600, marginBottom: 14,
          }}>Add a transform</p>
          {GROUPS.map((group) => {
            const items = (Object.entries(TRANSFORM_META) as [TransformType, TransformMeta][])
              .filter(([, m]) => m.group === group);
            return (
              <div key={group} style={{ marginBottom: 12 }}>
                <p style={{
                  fontSize: 9, letterSpacing: "1px", textTransform: "uppercase",
                  color: "#c8c4be", fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
                  marginBottom: 6,
                }}>{group}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {items.map(([type, meta]) => {
                    const cols = colsFor(meta);
                    const available = cols.length >= (meta.twoColumn ? 2 : 1);
                    return (
                      <button
                        key={type}
                        onClick={() => available && addTransform(type)}
                        disabled={!available}
                        style={{
                          padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 500,
                          border: `1px solid ${available ? "rgba(144,96,248,0.25)" : "rgba(0,0,0,0.06)"}`,
                          background: available ? "rgba(144,96,248,0.06)" : "transparent",
                          color: available ? "#9060f8" : "#c8c4be",
                          cursor: available ? "pointer" : "not-allowed",
                        }}
                      >
                        + {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Configured transforms */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {configs.map((cfg, idx) => {
          const meta = TRANSFORM_META[cfg.type];
          const cols = colsFor(meta);
          const isBinOp = cfg.type === "bin_equal_width" || cfg.type === "bin_equal_freq";
          const isSingleSel = isBinOp || meta.twoColumn || meta.needsWindow || meta.needsLags;

          return (
            <div key={idx} style={{
              background: "rgba(255,255,255,0.72)", border: "1px solid rgba(144,96,248,0.15)",
              borderRadius: 14, overflow: "hidden",
            }}>
              <div style={{ height: 3, background: "linear-gradient(90deg,#9060f8,#e840c8)", backgroundSize: "200% 100%", animation: "shimmer 4s linear infinite" }} />
              <div style={{ padding: "14px 18px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 14, color: "#111010", margin: 0 }}>{meta.label}</p>
                    <p style={{ fontSize: 12, color: "#9a9690", margin: "2px 0 0" }}>{meta.description}</p>
                  </div>
                  <button onClick={() => removeTransform(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9a9690", padding: 4 }}>
                    <X size={14} />
                  </button>
                </div>

                {/* Column selector - primary */}
                <div style={{ marginBottom: 10 }}>
                  <p style={{
                    fontSize: 9, letterSpacing: "1px", textTransform: "uppercase",
                    color: "#9a9690", fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
                    marginBottom: 6,
                  }}>
                    {meta.twoColumn ? "Column A (numerator / left)" : isSingleSel ? "Select one column" : "Select columns"}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {cols.map((col) => {
                      const selected = cfg.columns.includes(col);
                      const disabled = isSingleSel && cfg.columns.length >= 1 && !selected;
                      return (
                        <button
                          key={col}
                          onClick={() => !disabled && toggleColumn(idx, col)}
                          style={{
                            padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 500,
                            border: `1px solid ${selected ? "rgba(144,96,248,0.5)" : disabled ? "rgba(0,0,0,0.05)" : "rgba(0,0,0,0.12)"}`,
                            background: selected ? "rgba(144,96,248,0.1)" : "transparent",
                            color: selected ? "#9060f8" : disabled ? "#d1c8f8" : "#6b6860",
                            cursor: disabled ? "not-allowed" : "pointer",
                            fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
                          }}
                        >{col}</button>
                      );
                    })}
                  </div>
                </div>

                {/* Column B for interaction transforms */}
                {meta.twoColumn && (
                  <div style={{ marginBottom: 10 }}>
                    <p style={{
                      fontSize: 9, letterSpacing: "1px", textTransform: "uppercase",
                      color: "#9a9690", fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
                      marginBottom: 6,
                    }}>Column B (denominator / right)</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {cols.filter((c) => !cfg.columns.includes(c)).map((col) => {
                        const selected = cfg.col2 === col;
                        return (
                          <button
                            key={col}
                            onClick={() => setConfigs((prev) => prev.map((c, i) => i === idx ? { ...c, col2: col } : c))}
                            style={{
                              padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 500,
                              border: `1px solid ${selected ? "rgba(232,64,200,0.5)" : "rgba(0,0,0,0.12)"}`,
                              background: selected ? "rgba(232,64,200,0.1)" : "transparent",
                              color: selected ? "#e840c8" : "#6b6860",
                              cursor: "pointer",
                              fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
                            }}
                          >{col}</button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Bins config */}
                {isBinOp && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 12, color: "#6b6860" }}>Bins:</label>
                    <input
                      type="number" min={2} max={20}
                      value={cfg.n_bins ?? 5}
                      onChange={(e) => setConfigs((prev) => prev.map((c, i) => i === idx ? { ...c, n_bins: parseInt(e.target.value) || 5 } : c))}
                      style={{ ...inputStyle, width: 56 }}
                    />
                  </div>
                )}

                {/* Window config */}
                {meta.needsWindow && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 12, color: "#6b6860" }}>Window size:</label>
                    <input
                      type="number" min={2} max={100}
                      value={cfg.window ?? 3}
                      onChange={(e) => setConfigs((prev) => prev.map((c, i) => i === idx ? { ...c, window: parseInt(e.target.value) || 3 } : c))}
                      style={{ ...inputStyle, width: 56 }}
                    />
                  </div>
                )}

                {/* Lags config */}
                {meta.needsLags && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ fontSize: 12, color: "#6b6860" }}>Lags (comma-separated):</label>
                    <input
                      type="text"
                      value={(cfg.lags ?? [1, 2, 3]).join(",")}
                      onChange={(e) => {
                        const lags = e.target.value.split(",").map((v) => parseInt(v.trim())).filter((n) => !isNaN(n) && n > 0);
                        setConfigs((prev) => prev.map((c, i) => i === idx ? { ...c, lags } : c));
                      }}
                      style={{ ...inputStyle, width: 120 }}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {configs.length === 0 && (
          <div style={{
            background: "rgba(255,255,255,0.72)", border: "1px dashed rgba(0,0,0,0.12)",
            borderRadius: 16, padding: 48,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
          }}>
            <FlaskConical size={32} style={{ color: "#d1c8f8", opacity: 0.7 }} />
            <p style={{ fontWeight: 600, fontSize: 14, color: "#111010", margin: 0 }}>No transforms added</p>
            <p style={{ fontSize: 13, color: "#9a9690", margin: 0 }}>Click a transform above to add it to the pipeline</p>
          </div>
        )}
      </div>
    </div>
  );
}
