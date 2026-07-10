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
    <header className="site-header relative flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface/90 px-5 backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-3">
        <button onClick={onNewFile} className="flex items-center gap-2" aria-label="Back to upload">
          <Logo size={22} />
        </button>
        <span className="h-4 w-px bg-border" />
        <div className="min-w-0">
          <h1 className="text-[14px] font-semibold leading-tight text-ink">{sectionTitle}</h1>
          <p className="max-w-[52vw] truncate text-[11.5px] leading-tight text-ink-tertiary sm:max-w-none">
            {fileName} · {formatNumber(rows)} rows · {formatNumber(columns)} columns
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/compare" className="hidden sm:block">
          <Button variant="secondary" size="sm">
            <GitCompare className="h-3.5 w-3.5" /> Compare
          </Button>
        </Link>
        <Button variant="ghost" size="sm" onClick={onNewFile}>
          <RotateCcw className="h-3.5 w-3.5" /> <span className="hidden sm:inline">New file</span>
        </Button>
      </div>
    </header>
  );
}
