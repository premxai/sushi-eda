"use client";

import * as React from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  FileText,
  GitCompare,
  Home,
  Layers,
  Search,
  TrendingUp,
  Table,
  Download,
} from "lucide-react";

interface CommandPaletteProps {
  onSectionChange?: (section: string) => void;
  sections?: string[];
}

export function CommandPalette({ onSectionChange, sections = [] }: CommandPaletteProps) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
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

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="fixed left-1/2 top-1/2 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 px-4">
        <Command
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center border-b border-slate-200 px-4">
            <Search className="mr-2 h-4 w-4 shrink-0 text-slate-400" />
            <Command.Input
              placeholder="Type a command or search..."
              className="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-slate-500">
              No results found.
            </Command.Empty>

            {sections.length > 0 && (
              <Command.Group heading="Navigate" className="mb-2">
                <Command.Item
                  onSelect={() => handleSelect(() => onSectionChange?.("overview"))}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  <Home className="h-4 w-4" />
                  <span>Overview</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => handleSelect(() => onSectionChange?.("columns"))}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  <Layers className="h-4 w-4" />
                  <span>Column Analysis</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => handleSelect(() => onSectionChange?.("correlations"))}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>Correlations</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => handleSelect(() => onSectionChange?.("outliers"))}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  <TrendingUp className="h-4 w-4" />
                  <span>Outliers</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => handleSelect(() => onSectionChange?.("insights"))}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  <FileText className="h-4 w-4" />
                  <span>Insights</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => handleSelect(() => onSectionChange?.("data"))}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                >
                  <Table className="h-4 w-4" />
                  <span>Data Table</span>
                </Command.Item>
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
                onSelect={() => handleSelect(() => document.querySelector<HTMLButtonElement>('[aria-label*="Export"]')?.click())}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                <Download className="h-4 w-4" />
                <span>Export PDF</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
          <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
            Press <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">⌘K</kbd> to toggle
          </div>
        </Command>
      </div>
    </div>
  );
}
