import Link from "next/link";
import { GitCompare, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/common/Logo";
import { formatNumber } from "@/lib/formatters";

interface ReportHeaderProps {
  sectionTitle: string;
  fileName: string;
  rows: number;
  columns: number;
  onNewFile: () => void;
}

export function ReportHeader({ sectionTitle, fileName, rows, columns, onNewFile }: ReportHeaderProps) {
  return (
    <header className="report-header site-header relative flex shrink-0 items-center justify-between border-b border-border bg-surface/90 px-5 backdrop-blur-xl sm:px-8">
      <div className="flex min-w-0 items-center gap-3 sm:gap-5">
        <button onClick={onNewFile} className="report-header-brand flex items-center gap-2.5" aria-label="Back to upload">
          <Logo size={34} />
          <span className="hidden text-[19px] font-semibold tracking-[-0.03em] text-ink sm:inline">Sushi</span>
        </button>
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
        <Link href="/compare" className="hidden sm:block">
          <Button variant="secondary" size="md" className="rounded-full px-4">
            <GitCompare className="h-4 w-4" /> Compare files
          </Button>
        </Link>
        <Button variant="ghost" size="md" className="rounded-full" onClick={onNewFile}>
          <RotateCcw className="h-4 w-4" /> <span className="hidden sm:inline">New file</span>
        </Button>
      </div>
    </header>
  );
}
