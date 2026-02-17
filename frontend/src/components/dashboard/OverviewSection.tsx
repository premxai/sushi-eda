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
}

function buildStats(info: BasicInfo): StatCardData[] {
  return [
    {
      label: "Rows",
      value: info.rows.toLocaleString(),
      icon: Rows3,
      accent: "text-indigo-600",
      iconBg: "bg-indigo-50",
    },
    {
      label: "Columns",
      value: info.columns.toLocaleString(),
      icon: Columns3,
      accent: "text-violet-600",
      iconBg: "bg-violet-50",
    },
    {
      label: "Memory",
      value: `${info.memory_usage_mb} MB`,
      sub: `${info.memory_usage_bytes.toLocaleString()} bytes`,
      icon: HardDrive,
      accent: "text-emerald-600",
      iconBg: "bg-emerald-50",
    },
    {
      label: "Duplicates",
      value: info.duplicate_rows.toLocaleString(),
      sub: info.rows > 0
        ? `${((info.duplicate_rows / info.rows) * 100).toFixed(1)}% of rows`
        : undefined,
      icon: CopyMinus,
      accent: "text-amber-600",
      iconBg: "bg-amber-50",
    },
    {
      label: "Missing Values",
      value: info.total_missing.toLocaleString(),
      sub:
        info.rows > 0 && info.columns > 0
          ? `${((info.total_missing / (info.rows * info.columns)) * 100).toFixed(1)}% of cells`
          : undefined,
      icon: AlertTriangle,
      accent: "text-rose-600",
      iconBg: "bg-rose-50",
    },
    {
      label: "Data Types",
      value: Object.keys(info.dtypes_summary).length.toString(),
      sub: Object.entries(info.dtypes_summary)
        .map(([k, v]) => `${v} ${k}`)
        .join(", "),
      icon: Hash,
      accent: "text-slate-600",
      iconBg: "bg-slate-100",
    },
  ];
}

export function OverviewSection({ info, qualityScore }: OverviewSectionProps) {
  const stats = buildStats(info);

  return (
    <div className="space-y-6">
      {/* Quality Score Card */}
      {qualityScore && (
        <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 transition-shadow hover:shadow-md">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-medium text-slate-500">Data Quality Score</h3>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-5xl font-bold tracking-tight text-slate-900">
                  {qualityScore.overall_score}
                </span>
                <span className={cn(
                  "rounded-full px-3 py-1 text-lg font-semibold",
                  qualityScore.grade === "A" && "bg-emerald-100 text-emerald-700",
                  qualityScore.grade === "B" && "bg-indigo-100 text-indigo-700",
                  qualityScore.grade === "C" && "bg-amber-100 text-amber-700",
                  (qualityScore.grade === "D" || qualityScore.grade === "F") && "bg-rose-100 text-rose-700"
                )}>
                  Grade {qualityScore.grade}
                </span>
              </div>
            </div>
          </div>
          
          {/* Breakdown */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {Object.entries(qualityScore.breakdown).map(([key, val]) => (
              <div key={key} className="rounded-md bg-white px-3 py-2 border border-slate-100">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">
                  {key.replace(/_/g, " ")}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">{val.score}</p>
              </div>
            ))}
          </div>

          {/* Recommendations */}
          {qualityScore.recommendations.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {qualityScore.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-slate-600">
                  <span className="mt-0.5 text-indigo-500">•</span>
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
                <div className="rounded-lg border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-500">{s.label}</p>
                      <p className={cn("mt-1 text-2xl font-semibold tracking-tight text-slate-900")}>
                        {s.value}
                      </p>
                      {s.sub && (
                        <p className="mt-0.5 text-[11px] text-slate-400">{s.sub}</p>
                      )}
                    </div>
                    <div className={cn("rounded-lg p-2", s.iconBg)}>
                      <s.icon className={cn("h-4 w-4", s.accent)} />
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
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-medium text-slate-900">Column Types</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(info.dtypes_summary).map(([dtype, count]) => (
            <span
              key={dtype}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-xs"
            >
              <span className="font-mono text-slate-600">{dtype}</span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                {count}
              </span>
            </span>
          ))}
        </div>
        <div className="mt-4">
          <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
            {Object.entries(info.dtypes_summary).map(([dtype, count], i) => {
              const colors = [
                "bg-indigo-500",
                "bg-violet-500",
                "bg-emerald-500",
                "bg-amber-500",
                "bg-rose-500",
                "bg-slate-400",
              ];
              const pct = (count / info.columns) * 100;
              return (
                <div
                  key={dtype}
                  className={cn("transition-all", colors[i % colors.length])}
                  style={{ width: `${pct}%` }}
                  title={`${dtype}: ${count} columns (${pct.toFixed(0)}%)`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Column list */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-medium text-slate-900">All Columns</h3>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {info.column_names.map((name) => (
            <span
              key={name}
              className="rounded-md bg-slate-50 px-2 py-1 font-mono text-xs text-slate-600"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
