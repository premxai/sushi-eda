"use client";

import React from "react";
import {
  Archive,
  BarChart3,
  BookOpen,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronRight,
  Columns3,
  Database,
  FileSpreadsheet,
  FileText,
  GitCompareArrows,
  Home,
  Lightbulb,
  MessageCircleQuestion,
  Plus,
  ShieldCheck,
  Sigma,
  Table2,
  TerminalSquare,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { SushiLogo } from "@/components/sushi/SushiLogo";
import { cn } from "@/lib/utils";

export type NavSection =
  | "overview"
  | "ask"
  | "columns"
  | "statistics"
  | "correlations"
  | "outliers"
  | "insights"
  | "visualizations"
  | "report"
  | "sql"
  | "data";

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.ElementType;
  group: "Guided" | "Advanced";
}

const navItems: NavItem[] = [
  { id: "overview", label: "Data Summary", icon: BarChart3, group: "Guided" },
  { id: "ask", label: "Ask Your Data", icon: MessageCircleQuestion, group: "Guided" },
  { id: "columns", label: "Field Health", icon: Columns3, group: "Guided" },
  { id: "statistics", label: "Compare & Validate", icon: Sigma, group: "Guided" },
  { id: "correlations", label: "What Moves Together", icon: GitCompareArrows, group: "Guided" },
  { id: "outliers", label: "Unusual Values", icon: AlertTriangle, group: "Guided" },
  { id: "report", label: "Reports", icon: FileText, group: "Guided" },
  { id: "visualizations", label: "Charts & Trends", icon: ChartNoAxesCombined, group: "Advanced" },
  { id: "insights", label: "AI Notes", icon: Lightbulb, group: "Advanced" },
  { id: "sql", label: "Advanced Queries", icon: TerminalSquare, group: "Advanced" },
  { id: "data", label: "Raw Table", icon: Table2, group: "Advanced" },
];

const launchFooterLinks = [
  { href: "/datasets", label: "My Datasets", icon: Database },
  { href: "/docs", label: "Docs", icon: BookOpen },
  { href: "/privacy", label: "Privacy", icon: ShieldCheck },
] as const;

interface SidebarProps {
  fileName: string;
  activeSection: NavSection;
  onSectionChange: (section: NavSection) => void;
  onNewFile: () => void;
  onNewFileRequest?: () => void;
  onDatasetPick?: (id: string, filename: string) => void;
  datasetId?: string | null;
  orgId?: string;
  onArchive?: () => void;
}

export function Sidebar({
  fileName,
  activeSection,
  onSectionChange,
  onNewFile,
  onNewFileRequest,
  datasetId,
  onArchive,
}: SidebarProps) {
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const guidedItems = navItems.filter((item) => item.group === "Guided");
  const advancedItems = navItems.filter((item) => item.group === "Advanced");

  const renderNavButton = (item: NavItem) => {
    const isActive = activeSection === item.id;

    return (
      <button
        key={item.id}
        onClick={() => onSectionChange(item.id)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg border-l-2 py-2 pl-2.5 pr-2 text-left text-[13.5px] transition-colors",
          isActive
            ? "border-brand bg-brand/[0.16] font-medium text-brand"
            : "border-transparent text-[#B9B4A4] hover:bg-white/5 hover:text-[#FBF7EE]",
        )}
      >
        <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "opacity-100" : "opacity-50")} />
        {item.label}
        {isActive && (
          <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-brand shadow-[0_0_6px_var(--brand)]" />
        )}
      </button>
    );
  };

  return (
    <aside className="flex h-screen w-[230px] shrink-0 flex-col overflow-y-auto overflow-x-hidden border-r border-black/40 bg-[var(--nori)]">
      <button
        onClick={onNewFile}
        className="flex w-full items-center gap-2.5 border-b border-white/[0.08] px-5 py-5 text-left"
      >
        <SushiLogo size={26} />
        <span className="text-[16px] font-semibold tracking-tight text-[#FBF7EE]">Sushi</span>
      </button>

      <div className="px-3 pb-2 pt-2.5">
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-brand/25 bg-brand/[0.14] px-2.5 py-2">
          <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-brand" />
          <span className="truncate text-[12px] font-medium text-[#FBF7EE]">{fileName}</span>
        </div>

        <div className="flex gap-1.5">
          <button
            onClick={onNewFile}
            title="Back to Home"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-[12.5px] font-medium text-[#B9B4A4] transition-colors hover:bg-white/10"
          >
            <Home className="h-3.5 w-3.5" />
            Home
          </button>
          <button
            onClick={() => (onNewFileRequest ? onNewFileRequest() : onNewFile())}
            title="Start a new saved workspace"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[linear-gradient(135deg,var(--salmon),var(--tuna))] px-2.5 py-1.5 text-[12.5px] font-medium text-white shadow-[0_2px_8px_rgba(242,112,74,0.3)] transition-opacity hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" />
            New Upload
          </button>
        </div>
      </div>

      <nav className="flex-1 px-3 py-1.5">
        <div className="mb-4">
          <p className="mb-1 px-2 font-mono text-[9px] uppercase tracking-[2px] text-[#71695A]">Guided</p>
          <div className="flex flex-col gap-0.5">{guidedItems.map(renderNavButton)}</div>
        </div>

        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowAdvanced((current) => !current)}
            className="flex w-full items-center justify-between rounded-lg px-2 py-1.5"
          >
            <span className="font-mono text-[9px] uppercase tracking-[2px] text-[#71695A]">Advanced</span>
            {showAdvanced ? (
              <ChevronDown className="h-3.5 w-3.5 text-[#71695A]" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-[#71695A]" />
            )}
          </button>
          {showAdvanced && (
            <div className="mt-1 flex flex-col gap-0.5">{advancedItems.map(renderNavButton)}</div>
          )}
        </div>
      </nav>

      <div className="border-t border-white/[0.08] p-3">
        {launchFooterLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-[#B9B4A4] no-underline transition-colors hover:bg-white/5 hover:text-[#FBF7EE]"
          >
            <item.icon className="h-4 w-4 shrink-0 opacity-50" />
            {item.label}
          </Link>
        ))}

        {datasetId && onArchive && (
          <button
            onClick={onArchive}
            className="mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] text-[#B9B4A4] transition-colors hover:bg-white/5 hover:text-[#FBF7EE]"
          >
            <Archive className="h-4 w-4 shrink-0 opacity-50" />
            Archive dataset
          </button>
        )}
      </div>
    </aside>
  );
}
