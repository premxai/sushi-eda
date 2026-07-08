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
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-5">
      <div className="flex items-center gap-3">
        <button onClick={onNewFile} className="flex items-center gap-2" aria-label="Back to upload">
          <Logo size={22} />
        </button>
        <span className="h-4 w-px bg-border" />
        <div>
          <h1 className="text-[14px] font-semibold leading-tight text-ink">{sectionTitle}</h1>
          <p className="text-[11.5px] leading-tight text-ink-tertiary">
            {fileName} · {formatNumber(rows)} rows · {formatNumber(columns)} columns
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/compare">
          <Button variant="secondary" size="sm">
            <GitCompare className="h-3.5 w-3.5" /> Compare
          </Button>
        </Link>
        <Button variant="ghost" size="sm" onClick={onNewFile}>
          <RotateCcw className="h-3.5 w-3.5" /> New file
        </Button>
      </div>
    </header>
  );
}
