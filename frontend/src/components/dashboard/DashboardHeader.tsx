"use client";

import React from "react";
import Link from "next/link";
import { GitCompare, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/ExportButton";
import { EDAReport } from "@/lib/types";

interface DashboardHeaderProps {
  sectionTitle: string;
  fileName: string;
  rows: number;
  columns: number;
  report: EDAReport;
  aiNarrative?: string | null;
  isPreviewMode: boolean;
}

export function DashboardHeader({
  sectionTitle,
  fileName,
  rows,
  columns,
  report,
  aiNarrative,
  isPreviewMode,
}: DashboardHeaderProps) {
  return (
    <>
      <header className="relative flex shrink-0 items-center justify-between border-b border-line bg-[rgba(251,247,238,0.88)] px-8 py-3.5 backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--salmon),var(--tuna),transparent)]" />
        <div>
          <h1 className="font-display text-[22px] tracking-tight text-ink">{sectionTitle}</h1>
          <p className="mt-0.5 text-[12px] text-muted-ink">
            {fileName} · {rows.toLocaleString()} rows · {columns} columns
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/compare">
            <Button variant="outline" size="sm" className="gap-2 text-xs">
              <GitCompare className="h-3.5 w-3.5" />
              Compare
            </Button>
          </Link>
          <ExportButton report={report} fileName={fileName} aiNarrative={aiNarrative} />
        </div>
      </header>

      {isPreviewMode && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-brand/[0.13] bg-brand/[0.06] px-8 py-2.5">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-brand" />
            <span className="text-[12.5px] text-muted-ink">
              <strong className="text-ink">Preview mode</strong> — save datasets, compare groups, and unlock advanced tools by creating an account.
            </span>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link
              href="/sign-up"
              className="rounded-lg bg-[linear-gradient(135deg,var(--salmon),var(--tuna))] px-3.5 py-1.5 text-[12.5px] font-medium text-white no-underline"
            >
              Get started free
            </Link>
            <Link
              href="/sign-in"
              className="rounded-lg border border-line-2 px-3 py-1.5 text-[12.5px] text-muted-ink no-underline"
            >
              Sign in
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
