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
} from "lucide-react";
import { cn } from "@/lib/utils";

export type NavSection =
  | "overview"
  | "columns"
  | "correlations"
  | "outliers"
  | "insights"
  | "data";

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "columns", label: "Columns", icon: Columns3 },
  { id: "correlations", label: "Correlations", icon: GitCompareArrows },
  { id: "outliers", label: "Outliers", icon: AlertTriangle },
  { id: "insights", label: "Insights", icon: Lightbulb },
  { id: "data", label: "Data Table", icon: Table2 },
];

interface SidebarProps {
  fileName: string;
  activeSection: NavSection;
  onSectionChange: (section: NavSection) => void;
  onNewFile: () => void;
}

export function Sidebar({
  fileName,
  activeSection,
  onSectionChange,
  onNewFile,
}: SidebarProps) {
  return (
    <aside className="flex h-screen w-60 flex-col border-r border-slate-200 bg-white">
      {/* Dataset header */}
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
            <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">
              {fileName}
            </p>
            <p className="text-[11px] text-slate-500">Dataset</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {navItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-indigo-50 font-medium text-indigo-600"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "text-indigo-600" : "text-slate-400")} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* New file button */}
      <div className="border-t border-slate-200 p-3">
        <button
          onClick={onNewFile}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:shadow-md"
        >
          <Plus className="h-3.5 w-3.5" />
          Analyze New File
        </button>
      </div>
    </aside>
  );
}
