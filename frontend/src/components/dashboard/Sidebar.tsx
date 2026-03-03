"use client";

import React from "react";
import {
  BarChart3,
  Columns3,
  GitCompareArrows,
  AlertTriangle,
  Table2,
  Lightbulb,
  FileSpreadsheet,
  Plus,
  ChartNoAxesCombined,
  Sparkles,
  FlaskConical,
  Archive,
  Database,
  Search,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

export type NavSection =
  | "overview"
  | "columns"
  | "correlations"
  | "outliers"
  | "insights"
  | "visualizations"
  | "cleaning"
  | "transforms"
  | "data";

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.ElementType;
  group?: string;
}

const navItems: NavItem[] = [
  { id: "overview",        label: "Overview",        icon: BarChart3,            group: "Analysis" },
  { id: "columns",         label: "Columns",         icon: Columns3,             group: "Analysis" },
  { id: "correlations",    label: "Correlations",    icon: GitCompareArrows,     group: "Analysis" },
  { id: "outliers",        label: "Outliers",        icon: AlertTriangle,        group: "Analysis" },
  { id: "insights",        label: "Insights",        icon: Lightbulb,            group: "Analysis" },
  { id: "visualizations",  label: "Visualizations",  icon: ChartNoAxesCombined,  group: "Analysis" },
  { id: "cleaning",        label: "Data Cleaning",   icon: Sparkles,             group: "Engineering" },
  { id: "transforms",      label: "Transforms",      icon: FlaskConical,         group: "Engineering" },
  { id: "data",            label: "Data Table",      icon: Table2,               group: "Data" },
];

const GROUPS = ["Analysis", "Engineering", "Data"];

interface SidebarProps {
  fileName: string;
  activeSection: NavSection;
  onSectionChange: (section: NavSection) => void;
  onNewFile: () => void;
  datasetId?: string | null;
  onArchive?: () => void;
}

export function Sidebar({ fileName, activeSection, onSectionChange, onNewFile, datasetId, onArchive }: SidebarProps) {
  return (
    <aside className="flex h-screen w-60 flex-col bg-[#1a2035] overflow-y-auto">
      {/* Logo */}
      <div className="px-4 py-5 shrink-0">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/sushi-logo.png" alt="Sushi" width={32} height={32} />
          <span className="text-lg font-bold text-white tracking-tight">Sushi</span>
        </Link>
      </div>

      {/* Search */}
      <div className="px-3 pb-4 shrink-0">
        <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
          <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span className="text-xs text-slate-400">Search here...</span>
        </div>
      </div>

      {/* Dataset name */}
      <div className="px-3 pb-3 shrink-0">
        <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-indigo-500/20">
            <FileSpreadsheet className="h-3.5 w-3.5 text-indigo-400" />
          </div>
          <p className="truncate text-xs font-medium text-slate-300">{fileName}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2">
        {GROUPS.map((group) => {
          const items = navItems.filter((i) => i.group === group);
          return (
            <div key={group} className="mb-5">
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                {group}
              </p>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSectionChange(item.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all",
                        isActive
                          ? "bg-white/10 text-white font-medium"
                          : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      )}
                    >
                      <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-indigo-400" : "text-slate-500")} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 p-3 shrink-0 space-y-1">
        <Link
          href="/datasets"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition-all hover:bg-white/5 hover:text-slate-200"
        >
          <Database className="h-4 w-4 shrink-0 text-slate-500" />
          My Datasets
        </Link>

        {datasetId && onArchive && (
          <button
            onClick={onArchive}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition-all hover:bg-red-500/10 hover:text-red-400"
          >
            <Archive className="h-4 w-4 shrink-0 text-slate-500" />
            Archive dataset
          </button>
        )}

        <button
          onClick={onNewFile}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-medium text-white transition-all hover:bg-indigo-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Analyze New File
        </button>
      </div>
    </aside>
  );
}
