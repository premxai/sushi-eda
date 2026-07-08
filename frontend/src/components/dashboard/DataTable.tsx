"use client";

import React, { useState, useMemo } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataTableProps {
  preview: Record<string, unknown>[];
}

type SortDir = "asc" | "desc" | null;

export function DataTable({ preview }: DataTableProps) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const columns = useMemo(() => {
    if (preview.length === 0) return [];
    return Object.keys(preview[0]);
  }, [preview]);

  const sorted = useMemo(() => {
    if (!sortCol || !sortDir) return preview;
    return [...preview].sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const as = String(av);
      const bs = String(bv);
      return sortDir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
    });
  }, [preview, sortCol, sortDir]);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") {
        setSortCol(null);
        setSortDir(null);
      }
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  if (preview.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-slate-200 bg-white p-12">
        <p className="text-sm text-slate-500">No data to preview.</p>
      </div>
    );
  }

  const rows = sorted.slice(0, 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
        <h3 className="text-sm font-medium text-slate-900">Data Preview</h3>
        <span className="text-xs text-slate-500">
          Showing {rows.length} of {preview.length} rows
          {sortCol && (
            <span className="ml-2 text-brand">
              sorted by {sortCol} ({sortDir})
            </span>
          )}
        </span>
      </div>

      <div className="max-h-[600px] overflow-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 w-12">
                #
              </th>
              {columns.map((col) => {
                const isActive = sortCol === col;
                return (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className={cn(
                      "cursor-pointer select-none whitespace-nowrap px-4 py-3 text-xs font-medium transition-colors hover:bg-slate-50",
                      isActive ? "text-brand" : "text-slate-500"
                    )}
                  >
                    <div className="flex items-center gap-1">
                      <span className="font-mono">{col}</span>
                      {isActive && sortDir === "asc" && (
                        <ArrowUp className="h-3 w-3" />
                      )}
                      {isActive && sortDir === "desc" && (
                        <ArrowDown className="h-3 w-3" />
                      )}
                      {!isActive && (
                        <ArrowUpDown className="h-3 w-3 text-slate-300" />
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={idx}
                className={cn(
                  "border-b border-slate-100 transition-colors hover:bg-brand-weak",
                  idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                )}
              >
                <td className="px-4 py-2.5 text-center text-xs text-slate-400 tabular-nums">
                  {idx + 1}
                </td>
                {columns.map((col) => {
                  const val = row[col];
                  const display = val == null || val === "" ? "—" : String(val);
                  const isEmpty = val == null || val === "";
                  return (
                    <td
                      key={col}
                      className={cn(
                        "max-w-[200px] truncate px-4 py-2.5 text-xs tabular-nums",
                        isEmpty ? "text-slate-300" : "text-slate-700",
                        sortCol === col && "bg-brand-weak"
                      )}
                    >
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
