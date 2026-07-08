"use client";

import * as React from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Download,
  FileText,
  GitCompare,
  Home,
  Layers,
  Search,
  Sparkles,
  Table,
  TrendingUp,
} from "lucide-react";

interface CommandPaletteProps {
  onSectionChange?: (section: string) => void;
  sections?: string[];
}

const isMac =
  typeof navigator !== "undefined" && navigator.platform.includes("Mac");

const NAV_ITEMS = [
  { id: "overview", label: "Data Summary", icon: Home, advanced: false },
  { id: "columns", label: "Field Health", icon: Layers, advanced: false },
  { id: "statistics", label: "Compare & Validate", icon: BarChart3, advanced: false },
  { id: "correlations", label: "What Moves Together", icon: TrendingUp, advanced: false },
  { id: "outliers", label: "Unusual Values", icon: TrendingUp, advanced: false },
  { id: "report", label: "Reports", icon: FileText, advanced: false },
  { id: "visualizations", label: "Charts & Trends", icon: BarChart3, advanced: true },
  { id: "insights", label: "AI Notes", icon: Sparkles, advanced: true },
  { id: "cleaning", label: "Clean & Improve", icon: FileText, advanced: true },
  { id: "transforms", label: "Derived Fields", icon: GitCompare, advanced: true },
  { id: "sql", label: "Advanced Queries", icon: Table, advanced: true },
  { id: "data", label: "Raw Table", icon: Table, advanced: true },
];

export function CommandPalette({
  onSectionChange,
  sections = [],
}: CommandPaletteProps) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((current) => !current);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (callback: () => void) => {
    setOpen(false);
    callback();
  };

  if (!open) return null;

  const availableItems = NAV_ITEMS.filter((item) => sections.includes(item.id));
  const guidedItems = availableItems.filter((item) => !item.advanced);
  const advancedItems = availableItems.filter((item) => item.advanced);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div className="fixed left-1/2 top-1/2 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 px-4">
        <Command
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center border-b border-slate-200 px-4">
            <Search className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
            <Command.Input
              placeholder="Search sections or actions..."
              className="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-slate-500">
              No results found.
            </Command.Empty>

            {guidedItems.length > 0 && (
              <Command.Group heading="Guided Sections" className="mb-2">
                {guidedItems.map((item) => (
                  <Command.Item
                    key={item.id}
                    onSelect={() => handleSelect(() => onSectionChange?.(item.id))}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {advancedItems.length > 0 && (
              <Command.Group heading="Advanced" className="mb-2">
                {advancedItems.map((item) => (
                  <Command.Item
                    key={item.id}
                    onSelect={() => handleSelect(() => onSectionChange?.(item.id))}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            <Command.Group heading="Actions" className="mb-2">
              <Command.Item
                onSelect={() => handleSelect(() => router.push("/compare"))}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                <GitCompare className="h-4 w-4" />
                <span>Compare Datasets</span>
              </Command.Item>
              <Command.Item
                onSelect={() =>
                  handleSelect(() =>
                    document
                      .querySelector<HTMLButtonElement>("[data-export-pdf]")
                      ?.click(),
                  )
                }
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                <Download className="h-4 w-4" />
                <span>Export PDF</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
          <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
            Press{" "}
            <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">
              {isMac ? "⌘K" : "Ctrl+K"}
            </kbd>{" "}
            to toggle
          </div>
        </Command>
      </div>
    </div>
  );
}
