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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HankoStamp } from "@/components/sushi/HankoStamp";
import { cn } from "@/lib/utils";

interface OverviewSectionProps {
  info: BasicInfo;
  qualityScore?: QualityScore;
}

const DTYPE_COLORS = ["var(--salmon)", "var(--tuna)", "var(--wasabi)", "#B48A3C", "#6D5AE6", "#3C8FA0"];

/** One-line plain-English verdict for the quality grade. */
function gradeVerdict(grade: string): string {
  switch (grade) {
    case "A":
      return "This data looks clean and trustworthy — you can present numbers from it with confidence.";
    case "B":
      return "Broadly trustworthy — skim the notes below before presenting exact totals.";
    case "C":
      return "Usable with care — several issues below could shift totals and averages.";
    case "D":
      return "Treat conclusions from this data as rough estimates until the issues below are fixed.";
    default:
      return "This data has serious quality problems — clean it up before trusting any numbers from it.";
  }
}

function stampTone(grade: string): "wasabi" | "salmon" | "tuna" {
  if (grade === "A" || grade === "B") return "wasabi";
  if (grade === "C") return "salmon";
  return "tuna";
}

interface StatCardData {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  dot: string;
}

function buildStats(info: BasicInfo): StatCardData[] {
  return [
    { label: "Rows", value: info.rows.toLocaleString(), icon: Rows3, dot: "var(--salmon)" },
    { label: "Columns", value: info.columns.toLocaleString(), icon: Columns3, dot: "var(--tuna)" },
    {
      label: "Memory",
      value: `${info.memory_usage_mb} MB`,
      sub: `${info.memory_usage_bytes.toLocaleString()} bytes`,
      icon: HardDrive,
      dot: "var(--wasabi)",
    },
    {
      label: "Duplicates",
      value: info.duplicate_rows.toLocaleString(),
      sub: info.rows > 0
        ? `${((info.duplicate_rows / info.rows) * 100).toFixed(1)}% of rows`
        : undefined,
      icon: CopyMinus,
      dot: "#B48A3C",
    },
    {
      label: "Missing Values",
      value: info.total_missing.toLocaleString(),
      sub:
        info.rows > 0 && info.columns > 0
          ? `${((info.total_missing / (info.rows * info.columns)) * 100).toFixed(1)}% of cells`
          : undefined,
      icon: AlertTriangle,
      dot: "var(--tuna)",
    },
    {
      label: "Data Types",
      value: Object.keys(info.dtypes_summary).length.toString(),
      sub: Object.entries(info.dtypes_summary)
        .map(([k, v]) => `${v} ${k}`)
        .join(", "),
      icon: Hash,
      dot: "var(--wasabi)",
    },
  ];
}

export function OverviewSection({ info, qualityScore }: OverviewSectionProps) {
  const stats = buildStats(info);

  return (
    <div className="space-y-5">

      {/* ── Quality Score Card — nori glass ── */}
      {qualityScore && (
        <div className="relative overflow-hidden rounded-card-lg border border-white/10 bg-[linear-gradient(145deg,rgba(21,19,15,0.95),rgba(10,9,7,0.98))] p-6 text-white shadow-soft-lg">
          <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--wasabi),var(--salmon),var(--tuna),transparent)] opacity-70" />
          <div className="pointer-events-none absolute inset-x-[15%] bottom-0 h-14 bg-[radial-gradient(ellipse,rgba(242,112,74,0.14)_0%,transparent_70%)]" />

          <div className="flex items-start justify-between">
            <div>
              <p className="mb-3 font-mono text-[9px] uppercase tracking-[2px] text-white/30">Data Quality Score</p>
              <div className="flex items-baseline gap-3.5">
                <span className="font-display text-[56px] leading-none tracking-[-2px] text-white/92">
                  {qualityScore.overall_score}
                </span>
                <span className="rounded-pill border border-white/15 bg-white/10 px-3.5 py-1 text-[14px] font-medium backdrop-blur-sm">
                  Grade {qualityScore.grade}
                </span>
              </div>
              <p className="mt-2.5 max-w-[480px] text-[12.5px] leading-relaxed text-white/55">
                {gradeVerdict(qualityScore.grade)}
              </p>
            </div>
            <HankoStamp
              value={qualityScore.overall_score}
              label={`Grade ${qualityScore.grade}`}
              tone={stampTone(qualityScore.grade)}
              size={68}
              className="shrink-0"
            />
          </div>

          {/* Breakdown pills */}
          <div className="mt-5 grid grid-cols-5 gap-2">
            {Object.entries(qualityScore.breakdown).map(([key, val]) => (
              <div key={key} title={val.details} className="cursor-help rounded-lg border border-white/10 bg-white/[0.07] px-3 py-2.5">
                <p className="mb-1 font-mono text-[9px] uppercase tracking-[1.5px] text-white/35">
                  {key.replace(/_/g, " ")}
                </p>
                <p className="text-[15px] font-semibold text-white/88">{val.score}</p>
              </div>
            ))}
          </div>

          {/* Recommendations */}
          {qualityScore.recommendations.length > 0 && (
            <div className="mt-4 flex flex-col gap-1.5">
              {qualityScore.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2 text-[12px] text-white/60">
                  <span className="mt-px shrink-0 text-brand">✦</span>
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Stat cards ── */}
      <TooltipProvider>
        <div className="grid grid-cols-3 gap-4">
          {stats.map((s) => (
            <Tooltip key={s.label}>
              <TooltipTrigger asChild>
                <div className="relative cursor-default overflow-hidden rounded-card border border-line bg-surface px-[22px] pb-[18px] pt-[22px] shadow-soft-sm">
                  <div className="mb-2.5 flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: s.dot, boxShadow: `0 0 6px ${s.dot}` }}
                    />
                    <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-muted-ink">{s.label}</p>
                  </div>
                  <p className="font-display text-[36px] leading-none tracking-[-1px] text-ink mb-1.5">{s.value}</p>
                  {s.sub && <p className="text-[11px] text-muted-ink">{s.sub}</p>}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{s.sub || s.label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>

      {/* ── Column Types ── */}
      <div className="rounded-card border border-line bg-surface p-5 shadow-soft-sm">
        <p className="mb-3 text-[14px] font-medium text-ink">Column Types</p>
        <div className="mb-3.5 flex flex-wrap gap-2">
          {Object.entries(info.dtypes_summary).map(([dtype, count]) => (
            <span
              key={dtype}
              className="inline-flex items-center gap-1.5 rounded-pill border border-brand/15 bg-brand-weak px-2.5 py-1 text-[12px]"
            >
              <span className="font-mono text-[11px] text-brand">{dtype}</span>
              <span className="rounded-pill bg-brand/[0.15] px-1.5 py-px text-[10px] font-semibold text-brand-hover">
                {count}
              </span>
            </span>
          ))}
        </div>
        <div className="flex h-1 overflow-hidden rounded-full bg-ink/[0.06]">
          {Object.entries(info.dtypes_summary).map(([dtype, count], i) => {
            const pct = (count / info.columns) * 100;
            return (
              <div
                key={dtype}
                style={{ width: `${pct}%`, background: DTYPE_COLORS[i % DTYPE_COLORS.length] }}
                title={`${dtype}: ${count} (${pct.toFixed(0)}%)`}
              />
            );
          })}
        </div>
      </div>

      {/* ── All Columns ── */}
      <div className="rounded-card border border-line bg-surface p-5 shadow-soft-sm">
        <p className="mb-3 text-[14px] font-medium text-ink">All Columns</p>
        <div className="flex flex-wrap gap-1.5">
          {info.column_names.map((name) => (
            <span
              key={name}
              className={cn(
                "rounded-md border border-line bg-ink/[0.04] px-2.5 py-1 font-mono text-[11px] text-muted-ink",
              )}
            >
              {name}
            </span>
          ))}
        </div>
      </div>

    </div>
  );
}
