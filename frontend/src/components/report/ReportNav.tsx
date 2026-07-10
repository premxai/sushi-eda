"use client";

import React from "react";
import {
  AlertTriangle,
  ChartNoAxesCombined,
  Columns3,
  FileText,
  GitCompareArrows,
  Lightbulb,
  MessageSquareText,
  Sigma,
  Sparkles,
  TerminalSquare,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type NavSection =
  | "ai-summary"
  | "overview"
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
}

export function ReportNav({ active, onChange }: ReportNavProps) {
  return (
    <nav aria-label="Report sections" className="report-nav flex flex-col gap-0.5 p-2">
      {NAV_ITEMS.map((item) => {
        const isActive = item.key === active;
        return (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md border-l-2 px-2.5 py-2 text-left text-[13px] transition-colors",
              isActive ? "border-brand bg-brand-weak font-medium text-brand" : "border-transparent text-ink-secondary hover:bg-surface-2 hover:text-ink",
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" aria-hidden />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
