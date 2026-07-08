"use client";

import React, { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useDropzone } from "react-dropzone";
import {
  ArrowRight,
  FileText,
  MessageSquareText,
  ShieldCheck,
  Share2,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { Button, Card, Container, Eyebrow, LinkButton } from "@/components/sushi/primitives";
import { SushiLogo } from "@/components/sushi/SushiLogo";
import { DataGrain } from "@/components/sushi/DataGrain";
import { HankoStamp } from "@/components/sushi/HankoStamp";
import { ConveyorLoader } from "@/components/sushi/ConveyorLoader";
import { ThemeToggle } from "@/components/ThemeToggle";

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
    body: "A CSV, Excel, or JSON export straight from your tool. Up to 25 MB, nothing to configure.",
    icon: UploadCloud,
  },
  {
    n: "02",
    title: "Sushi reads it",
    body: "It grades data quality, finds the patterns that matter, and writes a plain-English summary you can trust.",
    icon: Sparkles,
  },
  {
    n: "03",
    title: "Share the answer",
    body: "Send a link or export a PDF your whole team can read, without any spreadsheet spelunking.",
    icon: Share2,
  },
];

const FEATURES = [
  {
    title: "A trust score, up front",
    body: "Every report opens with a 0 to 100 quality grade and a plain verdict, so you know whether to trust the numbers before you present them.",
    icon: ShieldCheck,
    stamp: true,
  },
  {
    title: "Written like an analyst would",
    body: "Not a wall of charts, just a short executive summary of what the data says, what changed, and what to watch out for.",
    icon: FileText,
  },
  {
    title: "Ask in plain English",
    body: "“Which region grew fastest?” Sushi answers, and shows the exact query behind it so you can trust the result.",
    icon: MessageSquareText,
  },
];

// ── Animated ambient background ───────────────────────────────────────────────

function AmbientBackground() {
  return (
    <div className="sushi-bg" aria-hidden>
      <div className="sushi-orb sushi-orb-1" />
      <div className="sushi-orb sushi-orb-2" />
      <div className="sushi-orb sushi-orb-3" />
      <div className="sushi-grid" />
    </div>
  );
}

// ── Top nav — brand + auth on the right ───────────────────────────────────────

function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-line bg-[rgba(251,247,238,0.72)] backdrop-blur-xl">
      <Container size="xl" className="flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 no-underline" aria-label="Sushi home">
          <SushiLogo size={30} />
          <span className="text-[17px] font-semibold tracking-tight text-ink">Sushi</span>
        </Link>
        <div className="flex items-center gap-2.5">
          <Link href="/docs" className="rounded-full px-3 py-2 text-[13.5px] text-muted-ink no-underline transition-colors hover:bg-ink/5 hover:text-ink">
            Docs
          </Link>
          <ThemeToggle />
          <span className="mx-1 h-5 w-px bg-line-2" />
          <LinkButton href="/sign-in" variant="ghost" size="sm">
            Log in
          </LinkButton>
          <LinkButton href="/sign-up" variant="primary" size="sm">
            Sign up
          </LinkButton>
        </div>
      </Container>
    </nav>
  );
}

// ── Upload panel ──────────────────────────────────────────────────────────────

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
        <p className="text-[15px] font-medium text-ink">Reading your data</p>
        <p className="mt-1 text-[13px] text-muted-ink">This usually takes 5 to 30 seconds.</p>
        <ConveyorLoader progress={uploadProgress} className="mx-auto mt-5 max-w-sm" />
      </Card>
    );
  }

  return (
    <Card
      {...getRootProps()}
      className={`sushi-board cursor-default border-dashed p-10 text-center transition-colors ${
        isDragActive ? "border-brand bg-brand-weak" : "border-line-2"
      }`}
    >
      <input {...getInputProps()} />
      <div className="sushi-float mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-weak">
        <UploadCloud className="h-6 w-6 text-brand" />
      </div>
      <p className="mt-5 font-display text-[24px] leading-tight text-ink">Drop a file on the board</p>
      <p className="mt-1.5 text-[14px] text-muted-ink">Drag it here, or choose a file from your computer.</p>

      <div className="mt-6 flex items-center justify-center gap-3">
        <Button size="lg" onClick={open}>
          Choose file
        </Button>
        <button
          onClick={onLoadSample}
          className="rounded-full px-4 py-3 text-[14px] font-medium text-brand transition-colors hover:bg-brand-weak"
        >
          or try the Sales sample
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

// ── Page ────────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
};

export default function SushiHome({
  onFileAccepted,
  isUploading,
  uploadProgress,
  error,
  onClearError,
  onLoadSample,
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
    <div className="relative min-h-screen bg-paper">
      <AmbientBackground />

      <div className="relative z-10">
        <Nav />

        {/* Hero */}
        <Container size="lg" className="relative pt-16 pb-4 text-center sm:pt-24">
          <div className="pointer-events-none absolute -left-2 top-14 hidden opacity-70 md:block" aria-hidden>
            <DataGrain count={12} cols={3} cell={13} grainSize={8} seed={3} />
          </div>
          <div className="pointer-events-none absolute -right-2 top-20 hidden opacity-70 md:block" aria-hidden>
            <DataGrain count={9} cols={3} cell={13} grainSize={8} seed={11} />
          </div>

          <motion.div
            initial="hidden"
            animate="show"
            transition={{ staggerChildren: 0.08 }}
          >
            <motion.div variants={fadeUp} transition={{ duration: 0.5 }}>
              <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-pill border border-line bg-surface px-3 py-1 shadow-soft-sm">
                <Sparkles className="h-3.5 w-3.5 text-brand" />
                <span className="text-[12.5px] text-muted-ink">Omakase for your data</span>
              </div>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              transition={{ duration: 0.55 }}
              className="mx-auto max-w-3xl font-display text-[clamp(42px,6.4vw,76px)] leading-[1.02] tracking-[-0.02em] text-ink text-balance"
            >
              Your raw data,{" "}
              <em className="italic text-brand">served perfectly.</em>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              transition={{ duration: 0.55 }}
              className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-muted-ink"
            >
              Drop in a dataset and get a clear, shareable report in seconds. No code, no analyst required.
            </motion.p>
          </motion.div>
        </Container>

        {/* Upload */}
        <Container size="sm" className="pb-2">
          {error && (
            <div className="mb-4 flex items-start gap-3 rounded-card border border-danger/25 bg-danger/[0.06] px-4 py-3">
              <p className="flex-1 text-[13.5px] text-danger">{error}</p>
              <button onClick={onClearError} aria-label="Dismiss error" className="text-danger/70 hover:text-danger">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
          >
            <UploadPanel
              onFileAccepted={onFileAccepted}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
              onLoadSample={onLoadSample}
            />
          </motion.div>
          <p className="mt-3 text-center text-[12.5px] text-faint-ink">
            Files are private and auto-deleted after 7 days.{" "}
            <Link href="/privacy" className="text-muted-ink underline decoration-line-2 underline-offset-2 hover:text-ink">
              How we handle your data
            </Link>
          </p>
        </Container>

        {/* How it works */}
        <Container size="xl" className="pt-28">
          <div className="text-center">
            <Eyebrow className="justify-center">How it works</Eyebrow>
            <h2 className="mx-auto mt-3 max-w-lg font-display text-[clamp(28px,4vw,44px)] leading-tight tracking-[-0.01em] text-ink">
              From raw file to shareable answer
            </h2>
          </div>

          <div className="relative mt-16 grid grid-cols-1 gap-5 md:grid-cols-3">
            {/* connecting line on desktop */}
            <div className="pointer-events-none absolute left-[16%] right-[16%] top-[38px] hidden h-px bg-line-2 md:block" />
            {STEPS.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <Card className="relative h-full p-7">
                  <div className="flex items-center justify-between">
                    <span className="relative z-10 grid h-12 w-12 place-items-center rounded-full border border-line bg-surface shadow-soft-sm">
                      <s.icon className="h-5 w-5 text-brand" />
                    </span>
                    <span className="font-mono text-[12px] font-medium text-faint-ink">{s.n}</span>
                  </div>
                  <h3 className="mt-5 font-display text-[22px] leading-tight text-ink">{s.title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-muted-ink">{s.body}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </Container>

        {/* Features */}
        <Container size="xl" className="pt-28">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="px-1"
              >
                {"stamp" in f && f.stamp ? (
                  <HankoStamp value={92} label="Grade A" tone="tuna" size={56} rotation={-10} />
                ) : (
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface shadow-soft-sm">
                    <f.icon className="h-5 w-5 text-ink" />
                  </span>
                )}
                <h3 className="mt-4 text-[16px] font-semibold text-ink">{f.title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted-ink">{f.body}</p>
              </motion.div>
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
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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
              <SushiLogo size={22} /> Sushi
            </div>
            <div className="flex items-center gap-6 text-[13px]">
              <Link href="/docs" className="text-muted-ink no-underline hover:text-ink">Docs</Link>
              <Link href="/privacy" className="text-muted-ink no-underline hover:text-ink">Privacy</Link>
              <a href="https://github.com/premxai/sushi-eda" target="_blank" rel="noopener noreferrer" className="text-muted-ink no-underline hover:text-ink">GitHub</a>
            </div>
          </Container>
        </footer>
      </div>
    </div>
  );
}
