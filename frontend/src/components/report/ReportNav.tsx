"use client";

import React from "react";
import {
  AlertTriangle,
  BarChart3,
  ChartNoAxesCombined,
  Columns3,
  FileSpreadsheet,
  FileText,
  GitCompareArrows,
  Lightbulb,
  MessageSquareText,
  ShieldCheck,
  Sigma,
  Sparkles,
  Table2,
  TerminalSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type NavSection =
  | "ai-summary"
  | "overview"
  | "raw-data"
  | "ask"
  | "fields"
  | "stats"
  | "correlations"
  | "outliers"
  | "charts"
  | "notes"
  | "sql"
  | "reports";

interface NavItem {
  key: NavSection;
  label: string;
  icon: React.ElementType;
}

export const NAV_ITEMS: NavItem[] = [
  { key: "ai-summary", label: "AI Summary", icon: Sparkles },
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "raw-data", label: "Raw Data", icon: Table2 },
  { key: "ask", label: "Ask Your Data", icon: MessageSquareText },
  { key: "fields", label: "Field Health", icon: Columns3 },
  { key: "stats", label: "Compare & Validate", icon: Sigma },
  { key: "correlations", label: "What Moves Together", icon: GitCompareArrows },
  { key: "outliers", label: "Unusual Values", icon: AlertTriangle },
  { key: "charts", label: "Charts & Trends", icon: ChartNoAxesCombined },
  { key: "notes", label: "AI Notes", icon: Lightbulb },
  { key: "sql", label: "Advanced Queries", icon: TerminalSquare },
  { key: "reports", label: "Reports", icon: FileText },
];

interface ReportNavProps {
  active: NavSection;
  onChange: (section: NavSection) => void;
  fileName: string;
  rows: number;
  columns: number;
  qualityScore: number;
}

const NAV_GROUPS = [
  { label: "Explore", keys: ["ai-summary", "overview", "raw-data", "ask"] as NavSection[] },
  { label: "Inspect", keys: ["fields", "stats", "correlations", "outliers", "charts"] as NavSection[] },
  { label: "Create", keys: ["notes", "sql", "reports"] as NavSection[] },
];

export function ReportNav({ active, onChange, fileName, rows, columns, qualityScore }: ReportNavProps) {
  return (
    <nav aria-label="Report sections" className="report-nav">
      <div className="report-nav-dataset">
        <span className="report-nav-dataset-icon"><FileSpreadsheet aria-hidden /></span>
        <div className="min-w-0">
          <p className="eyebrow">Current dataset</p>
          <p className="truncate text-[13px] font-semibold text-ink">{fileName}</p>
          <p className="mt-0.5 text-[11.5px] text-ink-tertiary">{rows.toLocaleString()} rows · {columns} fields</p>
        </div>
      </div>

      <div className="report-nav-quality">
        <ShieldCheck aria-hidden />
        <div>
          <p>Data quality</p>
          <strong>{Math.round(qualityScore)}<small>/100</small></strong>
        </div>
      </div>

      <div className="report-nav-sections">
        {NAV_GROUPS.map((group) => (
          <div className="report-nav-group" key={group.label}>
            <p className="report-nav-group-label">{group.label}</p>
            {group.keys.map((key) => {
              const item = NAV_ITEMS.find((navItem) => navItem.key === key)!;
              const isActive = item.key === active;
              return (
                <button
                  key={item.key}
                  onClick={() => onChange(item.key)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn("report-nav-item", isActive && "is-active")}
                >
                  <item.icon aria-hidden />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
