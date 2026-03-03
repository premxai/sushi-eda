"use client";

import React from "react";
import {
  Rows3,
  Columns3,
  HardDrive,
  CopyMinus,
  AlertTriangle,
  Hash,
} from "lucide-react";
import { BasicInfo, QualityScore } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface OverviewSectionProps {
  info: BasicInfo;
  qualityScore?: QualityScore;
}

interface StatCardData {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  accent: string;
  iconBg: string;
  iconGradient?: string;
}

function buildStats(info: BasicInfo): StatCardData[] {
  return [
    {
      label: "Rows",
      value: info.rows.toLocaleString(),
      icon: Rows3,
      accent: "text-white",
      iconBg: "",
      iconGradient: "linear-gradient(135deg, #9060f8, #7040d8)",
    },
    {
      label: "Columns",
      value: info.columns.toLocaleString(),
      icon: Columns3,
      accent: "text-white",
      iconBg: "",
      iconGradient: "linear-gradient(135deg, #e840c8, #c020a8)",
    },
    {
      label: "Memory",
      value: `${info.memory_usage_mb} MB`,
      sub: `${info.memory_usage_bytes.toLocaleString()} bytes`,
      icon: HardDrive,
      accent: "text-white",
      iconBg: "",
      iconGradient: "linear-gradient(135deg, #10b981, #059669)",
    },
    {
      label: "Duplicates",
      value: info.duplicate_rows.toLocaleString(),
      sub: info.rows > 0
        ? `${((info.duplicate_rows / info.rows) * 100).toFixed(1)}% of rows`
        : undefined,
      icon: CopyMinus,
      accent: "text-white",
      iconBg: "",
      iconGradient: "linear-gradient(135deg, #f59e0b, #d97706)",
    },
    {
      label: "Missing Values",
      value: info.total_missing.toLocaleString(),
      sub:
        info.rows > 0 && info.columns > 0
          ? `${((info.total_missing / (info.rows * info.columns)) * 100).toFixed(1)}% of cells`
          : undefined,
      icon: AlertTriangle,
      accent: "text-white",
      iconBg: "",
      iconGradient: "linear-gradient(135deg, #f43f5e, #e11d48)",
    },
    {
      label: "Data Types",
      value: Object.keys(info.dtypes_summary).length.toString(),
      sub: Object.entries(info.dtypes_summary)
        .map(([k, v]) => `${v} ${k}`)
        .join(", "),
      icon: Hash,
      accent: "text-white",
      iconBg: "",
      iconGradient: "linear-gradient(135deg, #64748b, #475569)",
    },
  ];
}

export function OverviewSection({ info, qualityScore }: OverviewSectionProps) {
  const stats = buildStats(info);

  return (
    <div className="space-y-6">
      {/* Quality Score Card */}
      {qualityScore && (
        <div className="rounded-2xl p-6 shadow-lg text-white" style={{ background: "linear-gradient(135deg, #9060f8, #e840c8)" }}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.65)" }}>Data Quality Score</h3>
              <div className="mt-3 flex items-baseline gap-4">
                <span className="text-6xl font-bold tracking-tight">{qualityScore.overall_score}</span>
                <span className="rounded-full px-3 py-1 text-base font-semibold" style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)" }}>
                  Grade {qualityScore.grade}
                </span>
              </div>
            </div>
          </div>

          {/* Breakdown */}
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {Object.entries(qualityScore.breakdown).map(([key, val]) => (
              <div key={key} className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.6)" }}>
                  {key.replace(/_/g, " ")}
                </p>
                <p className="mt-0.5 text-sm font-bold text-white">{val.score}</p>
              </div>
            ))}
          </div>

          {/* Recommendations */}
          {qualityScore.recommendations.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {qualityScore.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2 text-xs" style={{ color: "rgba(255,255,255,0.8)" }}>
                  <span className="mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>✦</span>
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stat cards grid */}
      <TooltipProvider>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
          {stats.map((s) => (
            <Tooltip key={s.label}>
              <TooltipTrigger asChild>
                <div className="rounded-2xl bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{s.label}</p>
                      <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                        {s.value}
                      </p>
                      {s.sub && (
                        <p className="mt-1 text-[11px] text-slate-400">{s.sub}</p>
                      )}
                    </div>
                    <div
                      className="rounded-xl p-3 shrink-0"
                      style={s.iconGradient ? { background: s.iconGradient } : undefined}
                    >
                      <s.icon className={cn("h-5 w-5", s.accent)} />
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{s.sub || s.label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>

      {/* Data types breakdown */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Column Types</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(info.dtypes_summary).map(([dtype, count]) => (
            <span
              key={dtype}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs"
              style={{ background: "rgba(144,96,248,0.08)", border: "1px solid rgba(144,96,248,0.15)" }}
            >
              <span className="font-mono" style={{ color: "#7c3aed" }}>{dtype}</span>
              <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(144,96,248,0.15)", color: "#6d28d9" }}>
                {count}
              </span>
            </span>
          ))}
        </div>
        <div className="mt-4">
          <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
            {Object.entries(info.dtypes_summary).map(([dtype, count], i) => {
              const gradients = [
                "#9060f8", "#e840c8", "#10b981", "#f59e0b", "#f43f5e", "#64748b",
              ];
              const pct = (count / info.columns) * 100;
              return (
                <div
                  key={dtype}
                  className="transition-all"
                  style={{ width: `${pct}%`, background: gradients[i % gradients.length] }}
                  title={`${dtype}: ${count} columns (${pct.toFixed(0)}%)`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Column list */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">All Columns</h3>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {info.column_names.map((name) => (
            <span
              key={name}
              className="rounded-lg px-2.5 py-1 font-mono text-xs"
              style={{ background: "rgba(0,0,0,0.04)", color: "#374151", border: "1px solid rgba(0,0,0,0.06)" }}
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
