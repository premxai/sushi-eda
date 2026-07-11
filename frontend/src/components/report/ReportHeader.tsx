"use client";

import { useState } from "react";
import Link from "next/link";
import { BookmarkPlus, Check, GitCompare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/common/Logo";
import { AccountMenu } from "@/components/common/AccountMenu";
import { formatNumber } from "@/lib/formatters";
import { getApiErrorMessage, saveDashboardDataset, saveDashboardReport } from "@/lib/api";

interface ReportHeaderProps {
  sectionTitle: string;
  fileName: string;
  rows: number;
  columns: number;
  isSampleMode: boolean;
  datasetId: string | null;
}

export function ReportHeader({ sectionTitle, fileName, rows, columns, isSampleMode, datasetId }: ReportHeaderProps) {
  const [saved, setSaved] = useState<{ dataset: boolean; report: boolean }>({ dataset: false, report: false });
  const [notice, setNotice] = useState<string | null>(null);

  const save = async (kind: "dataset" | "report") => {
    if (!datasetId) return;
    try {
      if (kind === "dataset") await saveDashboardDataset(datasetId);
      else await saveDashboardReport(datasetId);
      setSaved((current) => ({ ...current, [kind]: true }));
      setNotice(`${kind === "dataset" ? "Dataset" : "Report"} saved to your dashboard.`);
    } catch (error) {
      setNotice(getApiErrorMessage(error, "Could not save this item. Try again."));
    }
  };

  return (
    <header className="report-header site-header relative flex shrink-0 items-center justify-between border-b border-border bg-surface/90 px-5 backdrop-blur-xl sm:px-8">
      <div className="flex min-w-0 items-center gap-3 sm:gap-5">
        <Link href="/dashboard" className="report-header-brand flex items-center gap-2.5 no-underline" aria-label="Open overview dashboard">
          <Logo size={34} />
          <span className="hidden text-[19px] font-semibold tracking-[-0.03em] text-ink sm:inline">Sushi</span>
        </Link>
        <span className="hidden h-8 w-px bg-border sm:block" />
        <div className="min-w-0">
          <p className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-brand sm:block">Analysis workspace</p>
          <h1 className="truncate text-[16px] font-semibold tracking-[-0.02em] text-ink sm:text-[18px]">{sectionTitle}</h1>
          <p className="max-w-[47vw] truncate text-[11.5px] leading-tight text-ink-tertiary sm:max-w-none sm:text-[12.5px]">
            {fileName} <span className="hidden sm:inline">· {formatNumber(rows)} rows · {formatNumber(columns)} columns</span>
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {!isSampleMode && datasetId && (
          <div className="hidden items-center gap-1 lg:flex">
            <button type="button" onClick={() => void save("dataset")} disabled={saved.dataset} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-[12px] font-semibold text-ink hover:bg-surface-2 disabled:opacity-60">{saved.dataset ? <Check className="h-3.5 w-3.5 text-success" /> : <BookmarkPlus className="h-3.5 w-3.5" />}Dataset</button>
            <button type="button" onClick={() => void save("report")} disabled={saved.report} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-brand/25 bg-brand-weak px-3 text-[12px] font-semibold text-brand hover:bg-brand hover:text-paper disabled:opacity-60">{saved.report ? <Check className="h-3.5 w-3.5" /> : <BookmarkPlus className="h-3.5 w-3.5" />}Report</button>
          </div>
        )}
        <Link href={isSampleMode ? "/sign-in?next=%2Fcompare" : "/compare"} className="hidden sm:block">
          <Button variant="secondary" size="md" className="rounded-full px-4">
            <GitCompare className="h-4 w-4" /> Compare files
          </Button>
        </Link>
        <Link href={isSampleMode ? "/sign-in?next=%2Fnew-file" : "/new-file"} className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-surface px-3.5 text-[13px] font-semibold text-ink no-underline transition-colors hover:bg-surface-2 sm:px-4"><Plus className="h-4 w-4" /> <span className="hidden sm:inline">New file</span></Link>
        <AccountMenu fallback="sign-in" />
      </div>
      {notice && <p role="status" className="absolute right-6 top-full z-30 mt-2 max-w-sm rounded-xl border border-border bg-surface px-3 py-2 text-[12px] text-ink-secondary shadow-lg">{notice}</p>}
    </header>
  );
}
