"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useDropzone } from "react-dropzone";
import {
  ArrowRight,
  ArrowUpRight,
  FileText,
  Loader2,
  MessageSquareText,
  ShieldCheck,
  Share2,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { DatasetSummary, listDatasets } from "@/lib/api";
import { Button, Card, Container, Eyebrow, LinkButton } from "@/components/sushi/primitives";

interface SushiHomeProps {
  onFileAccepted: (file: File) => void;
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
  onClearError: () => void;
  onLoadSample: () => void;
  onOpenDataset?: (id: string, filename?: string) => void;
  refreshKey?: number;
}

const FORMATS = ["CSV", "Excel", "JSON", "Parquet", "TSV", "SQLite"];

const DROPZONE_ACCEPT: Record<string, string[]> = {
  "text/csv": [".csv"],
  "text/tab-separated-values": [".tsv"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/json": [".json"],
  "application/octet-stream": [".parquet", ".db", ".sqlite", ".sqlite3"],
};

const STEPS = [
  {
    n: "01",
    title: "Drop your file",
    body: "A CSV, Excel, or JSON export straight from your tool. Up to 25 MB. Nothing to configure.",
    icon: UploadCloud,
  },
  {
    n: "02",
    title: "Sushi reads it",
    body: "It scores data quality, finds the patterns that matter, and writes a plain-English summary.",
    icon: Sparkles,
  },
  {
    n: "03",
    title: "Share the answer",
    body: "Send a link or export a PDF your whole team can read — no spreadsheet spelunking required.",
    icon: Share2,
  },
];

const FEATURES = [
  {
    title: "A trust score, up front",
    body: "Every report opens with a 0–100 quality grade and a plain verdict, so you know whether to trust the numbers before you present them.",
    icon: ShieldCheck,
  },
  {
    title: "Written like an analyst would",
    body: "Not a wall of charts — a short executive summary of what the data says, what changed, and what to watch out for.",
    icon: FileText,
  },
  {
    title: "Ask in plain English",
    body: "“Which region grew fastest?” Sushi answers, and shows the exact query behind it so you can trust the result.",
    icon: MessageSquareText,
  },
];

function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-line bg-[rgba(250,249,245,0.8)] backdrop-blur-xl">
      <Container size="xl" className="flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-ink text-[15px] text-paper">
            🍣
          </span>
          <span className="text-[17px] font-semibold tracking-tight text-ink">Sushi</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link href="/examples" className="rounded-full px-3.5 py-2 text-[13.5px] text-muted-ink no-underline transition-colors hover:bg-[rgba(26,25,23,0.05)] hover:text-ink">
            Examples
          </Link>
          <Link href="/docs" className="rounded-full px-3.5 py-2 text-[13.5px] text-muted-ink no-underline transition-colors hover:bg-[rgba(26,25,23,0.05)] hover:text-ink">
            Docs
          </Link>
          <Link href="/datasets" className="ml-1 rounded-full px-3.5 py-2 text-[13.5px] text-muted-ink no-underline transition-colors hover:bg-[rgba(26,25,23,0.05)] hover:text-ink">
            My data
          </Link>
        </div>
      </Container>
    </nav>
  );
}

function UploadPanel({
  onFileAccepted,
  isUploading,
  uploadProgress,
  onLoadSample,
}: Pick<SushiHomeProps, "onFileAccepted" | "isUploading" | "uploadProgress" | "onLoadSample">) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) onFileAccepted(accepted[0]);
    },
    [onFileAccepted],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: DROPZONE_ACCEPT,
    maxSize: 25 * 1024 * 1024,
    multiple: false,
    noClick: true,
    noKeyboard: true,
    disabled: isUploading,
  });

  if (isUploading) {
    return (
      <Card className="p-10 text-center">
        <Loader2 className="mx-auto h-7 w-7 animate-spin text-brand" />
        <p className="mt-4 text-[15px] font-medium text-ink">Reading your data…</p>
        <p className="mt-1 text-[13px] text-muted-ink">This usually takes 5–30 seconds.</p>
        <div className="mx-auto mt-5 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-paper-2">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,var(--brand),#8B6FF0)] transition-[width] duration-500"
            style={{ width: `${Math.max(8, uploadProgress)}%` }}
          />
        </div>
      </Card>
    );
  }

  return (
    <Card
      {...getRootProps()}
      className={`cursor-default border-dashed p-10 text-center transition-colors ${
        isDragActive ? "border-brand bg-brand-weak" : "border-line-2"
      }`}
    >
      <input {...getInputProps()} />
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-weak">
        <UploadCloud className="h-6 w-6 text-brand" />
      </div>
      <p className="mt-5 font-display text-[24px] leading-tight text-ink">
        Drop a data file to begin
      </p>
      <p className="mt-1.5 text-[14px] text-muted-ink">
        Drag it here, or choose a file from your computer.
      </p>

      <div className="mt-6 flex items-center justify-center gap-3">
        <Button size="lg" onClick={open}>
          Choose file
        </Button>
        <button
          onClick={onLoadSample}
          className="rounded-full px-4 py-3 text-[14px] font-medium text-brand transition-colors hover:bg-brand-weak"
        >
          or try the Sales sample →
        </button>
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-1.5">
        {FORMATS.map((f) => (
          <span
            key={f}
            className="rounded-pill border border-line bg-surface-2 px-2.5 py-1 text-[11.5px] font-medium text-muted-ink"
          >
            {f}
          </span>
        ))}
      </div>
    </Card>
  );
}

function RecentDatasets({
  refreshKey,
  onOpenDataset,
}: Pick<SushiHomeProps, "refreshKey" | "onOpenDataset">) {
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    listDatasets("default")
      .then((rows) => {
        if (!cancelled) setDatasets(rows.filter((d) => d.status === "ready").slice(0, 4));
      })
      .catch(() => {
        /* saved datasets unavailable in this environment — hide the section */
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (datasets.length === 0) return null;

  return (
    <section className="mt-16">
      <div className="mb-4 flex items-end justify-between">
        <Eyebrow>Pick up where you left off</Eyebrow>
        <Link href="/datasets" className="text-[13px] font-medium text-brand no-underline hover:underline">
          View all
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {datasets.map((d) => (
          <button
            key={d.id}
            onClick={() => onOpenDataset?.(d.id, d.original_filename)}
            className="group text-left"
          >
            <Card hover className="h-full p-4">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-brand-weak px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand">
                  {d.file_format}
                </span>
                <ArrowUpRight className="ml-auto h-4 w-4 text-faint-ink transition-colors group-hover:text-brand" />
              </div>
              <p className="mt-3 truncate text-[14px] font-medium text-ink">{d.name}</p>
              <p className="mt-1 text-[12px] text-muted-ink">
                {d.row_count?.toLocaleString() ?? "—"} rows · {d.column_count ?? "—"} cols
              </p>
            </Card>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function SushiHome({
  onFileAccepted,
  isUploading,
  uploadProgress,
  error,
  onClearError,
  onLoadSample,
  onOpenDataset,
  refreshKey,
}: SushiHomeProps) {
  // Deep-link from /examples (?demo=1) auto-opens the sample report once.
  const firedDemo = useRef(false);
  useEffect(() => {
    if (firedDemo.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "1" || params.get("example") === "1") {
      firedDemo.current = true;
      onLoadSample();
    }
  }, [onLoadSample]);

  return (
    <div className="min-h-screen bg-paper">
      <Nav />

      {/* Hero */}
      <Container size="lg" className="pt-16 pb-4 text-center sm:pt-24">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-pill border border-line bg-surface px-3 py-1 shadow-soft-sm">
          <Sparkles className="h-3.5 w-3.5 text-brand" />
          <span className="text-[12.5px] text-muted-ink">Your AI data analyst</span>
        </div>
        <h1 className="mx-auto max-w-3xl font-display text-[clamp(40px,6vw,72px)] leading-[1.03] tracking-[-0.02em] text-ink text-balance">
          Understand any data file in <em className="italic text-brand">60 seconds</em>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-[16.5px] leading-relaxed text-muted-ink">
          Drop in a spreadsheet — survey results, usage exports, A/B tests — and get a
          plain-English report you can trust and share. No code, no analyst required.
        </p>
      </Container>

      {/* Upload */}
      <Container size="sm" className="pb-2">
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-card border border-[rgba(207,84,57,0.25)] bg-[rgba(207,84,57,0.06)] px-4 py-3">
            <p className="flex-1 text-[13.5px] text-danger">{error}</p>
            <button onClick={onClearError} aria-label="Dismiss error" className="text-danger/70 hover:text-danger">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <UploadPanel
          onFileAccepted={onFileAccepted}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
          onLoadSample={onLoadSample}
        />
        <p className="mt-3 text-center text-[12.5px] text-faint-ink">
          Files are private and auto-deleted after 7 days. <Link href="/privacy" className="text-muted-ink underline decoration-line-2 underline-offset-2 hover:text-ink">How we handle your data →</Link>
        </p>

        <RecentDatasets refreshKey={refreshKey} onOpenDataset={onOpenDataset} />
      </Container>

      {/* How it works */}
      <Container size="xl" className="pt-28">
        <Eyebrow className="text-center">How it works</Eyebrow>
        <h2 className="mx-auto mt-3 max-w-lg text-center font-display text-[clamp(28px,4vw,44px)] leading-tight tracking-[-0.01em] text-ink">
          From raw file to shareable answer
        </h2>
        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
          {STEPS.map((s) => (
            <Card key={s.n} className="p-7">
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-weak">
                  <s.icon className="h-5 w-5 text-brand" />
                </span>
                <span className="font-mono text-[12px] text-faint-ink">{s.n}</span>
              </div>
              <h3 className="mt-5 font-display text-[22px] leading-tight text-ink">{s.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-ink">{s.body}</p>
            </Card>
          ))}
        </div>
      </Container>

      {/* Features */}
      <Container size="xl" className="pt-28">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="px-1">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface shadow-soft-sm">
                <f.icon className="h-5 w-5 text-ink" />
              </span>
              <h3 className="mt-4 text-[16px] font-semibold text-ink">{f.title}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted-ink">{f.body}</p>
            </div>
          ))}
        </div>
      </Container>

      {/* Closing CTA */}
      <Container size="lg" className="pt-28 pb-24">
        <Card className="relative overflow-hidden px-8 py-16 text-center">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--brand),transparent)]" />
          <Eyebrow className="justify-center">Ready when you are</Eyebrow>
          <h2 className="mx-auto mt-3 max-w-md font-display text-[clamp(30px,4vw,48px)] leading-tight tracking-[-0.01em] text-ink">
            See what your data has been trying to tell you
          </h2>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button size="lg" variant="brand" onClick={onLoadSample}>
              <Sparkles className="h-4 w-4" /> Try the sample report
            </Button>
            <LinkButton href="/examples" size="lg" variant="secondary">
              Browse examples <ArrowRight className="h-4 w-4" />
            </LinkButton>
          </div>
        </Card>
      </Container>

      {/* Footer */}
      <footer className="border-t border-line bg-surface-2">
        <Container size="xl" className="flex flex-col items-center justify-between gap-4 py-8 sm:flex-row">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
            <span>🍣</span> Sushi
          </div>
          <div className="flex items-center gap-6 text-[13px]">
            <Link href="/docs" className="text-muted-ink no-underline hover:text-ink">Docs</Link>
            <Link href="/examples" className="text-muted-ink no-underline hover:text-ink">Examples</Link>
            <Link href="/privacy" className="text-muted-ink no-underline hover:text-ink">Privacy</Link>
            <a href="https://github.com/premxai/sushi-eda" target="_blank" rel="noopener noreferrer" className="text-muted-ink no-underline hover:text-ink">GitHub</a>
          </div>
        </Container>
      </footer>
    </div>
  );
}
