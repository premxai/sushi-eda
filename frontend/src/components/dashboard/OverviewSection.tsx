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

interface OverviewSectionProps {
  info: BasicInfo;
  qualityScore?: QualityScore;
}

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

interface StatCardData {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  glow: string;
  dot: string;
}

function buildStats(info: BasicInfo): StatCardData[] {
  return [
    {
      label: "Rows",
      value: info.rows.toLocaleString(),
      icon: Rows3,
      glow: "#9060f8",
      dot: "#9060f8",
    },
    {
      label: "Columns",
      value: info.columns.toLocaleString(),
      icon: Columns3,
      glow: "#e840c8",
      dot: "#e840c8",
    },
    {
      label: "Memory",
      value: `${info.memory_usage_mb} MB`,
      sub: `${info.memory_usage_bytes.toLocaleString()} bytes`,
      icon: HardDrive,
      glow: "#00d4e8",
      dot: "#00d4e8",
    },
    {
      label: "Duplicates",
      value: info.duplicate_rows.toLocaleString(),
      sub: info.rows > 0
        ? `${((info.duplicate_rows / info.rows) * 100).toFixed(1)}% of rows`
        : undefined,
      icon: CopyMinus,
      glow: "#f8d030",
      dot: "#f8d030",
    },
    {
      label: "Missing Values",
      value: info.total_missing.toLocaleString(),
      sub:
        info.rows > 0 && info.columns > 0
          ? `${((info.total_missing / (info.rows * info.columns)) * 100).toFixed(1)}% of cells`
          : undefined,
      icon: AlertTriangle,
      glow: "#ff7040",
      dot: "#ff7040",
    },
    {
      label: "Data Types",
      value: Object.keys(info.dtypes_summary).length.toString(),
      sub: Object.entries(info.dtypes_summary)
        .map(([k, v]) => `${v} ${k}`)
        .join(", "),
      icon: Hash,
      glow: "#00e8a0",
      dot: "#00e8a0",
    },
  ];
}

export function OverviewSection({ info, qualityScore }: OverviewSectionProps) {
  const stats = buildStats(info);

  return (
    <div className="space-y-5">

      {/* ── Quality Score Card — dark glass ── */}
      {qualityScore && (
        <div style={{
          borderRadius: 18, padding: 24,
          background: "linear-gradient(145deg, rgba(14,14,22,0.93), rgba(8,8,16,0.97))",
          border: "1px solid rgba(255,255,255,0.1)",
          position: "relative", overflow: "hidden",
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          color: "white",
        }}>
          {/* Iridescent top stripe */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 1,
            background: "linear-gradient(90deg, transparent, rgba(0,212,232,0.7), rgba(144,96,248,0.7), rgba(232,64,200,0.7), transparent)",
          }} />
          {/* Glow pool */}
          <div style={{
            position: "absolute", bottom: 0, left: "15%", right: "15%", height: 60,
            background: "radial-gradient(ellipse, rgba(144,96,248,0.12) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />

          <div className="flex items-start justify-between">
            <div>
              <p style={{ fontSize: 9, fontFamily: "ui-monospace, Menlo, monospace", letterSpacing: "2px", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>
                Data Quality Score
              </p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                <span className="font-display" style={{ fontSize: 56, lineHeight: 1, letterSpacing: "-2px", color: "rgba(255,255,255,0.92)" }}>
                  {qualityScore.overall_score}
                </span>
                <span style={{
                  padding: "4px 14px", borderRadius: 99, fontSize: 14, fontWeight: 500,
                  background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.15)",
                }}>
                  Grade {qualityScore.grade}
                </span>
              </div>
              <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.55)", marginTop: 10, maxWidth: 480, lineHeight: 1.5 }}>
                {gradeVerdict(qualityScore.grade)}
              </p>
            </div>
          </div>

          {/* Breakdown pills */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginTop: 20 }}>
            {Object.entries(qualityScore.breakdown).map(([key, val]) => (
              <div key={key} title={val.details} style={{
                borderRadius: 10, padding: "10px 12px",
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.1)",
                cursor: "help",
              }}>
                <p style={{ fontSize: 9, fontFamily: "ui-monospace, Menlo, monospace", letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 4 }}>
                  {key.replace(/_/g, " ")}
                </p>
                <p style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.88)" }}>{val.score}</p>
              </div>
            ))}
          </div>

          {/* Recommendations */}
          {qualityScore.recommendations.length > 0 && (
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
              {qualityScore.recommendations.map((rec, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                  <span style={{ color: "rgba(144,96,248,0.8)", marginTop: 1, flexShrink: 0 }}>✦</span>
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Stat cards — warm glass ── */}
      <TooltipProvider>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {stats.map((s) => (
            <Tooltip key={s.label}>
              <TooltipTrigger asChild>
                <div style={{
                  background: "rgba(255,255,255,0.72)",
                  border: "1px solid rgba(255,255,255,0.8)",
                  borderRadius: 16,
                  padding: "22px 22px 18px",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  boxShadow: "0 2px 16px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)",
                  position: "relative", overflow: "hidden",
                  cursor: "default",
                }}>
                  {/* Colored glow blob */}
                  <div style={{
                    position: "absolute", top: -24, right: -24, width: 72, height: 72, borderRadius: "50%",
                    background: s.glow, opacity: 0.1, pointerEvents: "none",
                    boxShadow: `0 0 30px ${s.glow}`,
                  }} />

                  {/* Label row with colored dot */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: s.dot, boxShadow: `0 0 6px ${s.dot}`,
                      flexShrink: 0,
                    }} />
                    <p style={{
                      fontSize: 10, fontFamily: "ui-monospace, Menlo, monospace",
                      letterSpacing: "1.5px", textTransform: "uppercase", color: "#9a9690",
                    }}>
                      {s.label}
                    </p>
                  </div>

                  {/* Value — Instrument Serif */}
                  <p className="font-display" style={{ fontSize: 36, lineHeight: 1, letterSpacing: "-1px", color: "#111010", marginBottom: 6 }}>
                    {s.value}
                  </p>

                  {s.sub && (
                    <p style={{ fontSize: 11, color: "#9a9690" }}>{s.sub}</p>
                  )}
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
      <div style={{
        background: "rgba(255,255,255,0.72)",
        border: "1px solid rgba(255,255,255,0.8)",
        borderRadius: 16, padding: 20,
        backdropFilter: "blur(12px)",
        boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
      }}>
        <p style={{ fontWeight: 500, fontSize: 14, color: "#111010", marginBottom: 12 }}>Column Types</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {Object.entries(info.dtypes_summary).map(([dtype, count]) => (
            <span
              key={dtype}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "4px 10px", borderRadius: 99, fontSize: 12,
                background: "rgba(144,96,248,0.08)", border: "1px solid rgba(144,96,248,0.15)",
              }}
            >
              <span style={{ fontFamily: "ui-monospace, Menlo, monospace", color: "#7c3aed", fontSize: 11 }}>{dtype}</span>
              <span style={{
                padding: "1px 6px", borderRadius: 99, fontSize: 10, fontWeight: 600,
                background: "rgba(144,96,248,0.15)", color: "#6d28d9",
              }}>
                {count}
              </span>
            </span>
          ))}
        </div>
        {/* Segmented bar */}
        <div style={{ height: 4, borderRadius: 2, overflow: "hidden", display: "flex", background: "rgba(0,0,0,0.06)" }}>
          {Object.entries(info.dtypes_summary).map(([dtype, count], i) => {
            const colors = ["#9060f8", "#e840c8", "#00d4e8", "#f8d030", "#ff7040", "#00e8a0"];
            const pct = (count / info.columns) * 100;
            return (
              <div
                key={dtype}
                style={{ width: `${pct}%`, background: colors[i % colors.length] }}
                title={`${dtype}: ${count} (${pct.toFixed(0)}%)`}
              />
            );
          })}
        </div>
      </div>

      {/* ── All Columns ── */}
      <div style={{
        background: "rgba(255,255,255,0.72)",
        border: "1px solid rgba(255,255,255,0.8)",
        borderRadius: 16, padding: 20,
        backdropFilter: "blur(12px)",
        boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
      }}>
        <p style={{ fontWeight: 500, fontSize: 14, color: "#111010", marginBottom: 12 }}>All Columns</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {info.column_names.map((name) => (
            <span
              key={name}
              style={{
                padding: "4px 10px", borderRadius: 7,
                fontFamily: "ui-monospace, Menlo, monospace",
                fontSize: 11, color: "#6b6860",
                background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.07)",
              }}
            >
              {name}
            </span>
          ))}
        </div>
      </div>

    </div>
  );
}
