"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  ArchiveRestore,
  BookOpen,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import {
  DatasetSummary,
  archiveDataset,
  fetchDatasetAnalysis,
  getApiErrorMessage,
  listDatasets,
  renameDataset,
  restoreDataset,
  starDataset,
} from "@/lib/api";
import { SignedIn, UserButton } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Tab = "all" | "starred" | "archived";

const REPORT_KEY = "eda_report";
const FILE_KEY = "eda_filename";
const DATASET_KEY = "eda_dataset_id";

const FILE_TONE: Record<string, string> = {
  csv: "bg-brand-weak text-brand",
  tsv: "bg-brand-weak text-brand",
  xlsx: "bg-ink/8 text-ink",
  xls: "bg-ink/8 text-ink",
  json: "bg-warning/10 text-warning",
  parquet: "bg-success/10 text-success",
  sqlite: "bg-success/10 text-success",
  db: "bg-success/10 text-success",
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function restoreDatasetSession(
  dataset: DatasetSummary,
  report: unknown,
) {
  sessionStorage.setItem(REPORT_KEY, JSON.stringify(report));
  sessionStorage.setItem(FILE_KEY, dataset.original_filename || dataset.name);
  sessionStorage.setItem(DATASET_KEY, dataset.id);
}

export default function DatasetsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (t: Tab) => {
    setLoading(true);
    setError(null);
    try {
      const data = await listDatasets("default", {
        archived: t === "archived",
        starred: t === "starred",
      });
      setDatasets(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load datasets."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(tab); }, [tab, load]);
  useEffect(() => { router.prefetch("/"); }, [router]);

  const handleStar = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActionError(null);
    try {
      await starDataset(id);
      setDatasets((prev) =>
        prev.map((d) => d.id === id ? { ...d, is_starred: !d.is_starred } : d)
      );
    } catch (err) {
      setActionError(getApiErrorMessage(err, "Failed to update star status"));
    }
  };

  const handleArchive = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActionError(null);
    try {
      await archiveDataset(id);
      setDatasets((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setActionError(getApiErrorMessage(err, "Failed to archive dataset"));
    }
  };

  const handleRestore = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActionError(null);
    try {
      await restoreDataset(id);
      setDatasets((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setActionError(getApiErrorMessage(err, "Failed to restore dataset"));
    }
  };

  const handleRename = async (
    e: React.MouseEvent,
    dataset: DatasetSummary,
  ) => {
    e.stopPropagation();
    const nextName = window.prompt("Rename dataset", dataset.name);
    if (nextName == null) return;
    const cleanedName = nextName.trim();
    if (!cleanedName || cleanedName === dataset.name) return;

    setActionError(null);
    try {
      const updated = await renameDataset(dataset.id, cleanedName);
      setDatasets((prev) =>
        prev.map((current) => (current.id === dataset.id ? updated : current)),
      );
    } catch (err) {
      setActionError(getApiErrorMessage(err, "Failed to rename dataset"));
    }
  };

  const handleOpen = async (dataset: DatasetSummary) => {
    if (dataset.status !== "ready") return;
    setOpeningId(dataset.id);
    setActionError(null);
    try {
      const analysis = await fetchDatasetAnalysis(dataset.id);
      restoreDatasetSession(dataset, analysis.report);
      router.push("/");
    } catch (err) {
      setActionError(
        getApiErrorMessage(err, "Failed to reopen dataset analysis"),
      );
      setOpeningId(null);
    }
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "all",      label: "All datasets" },
    { key: "starred",  label: "Starred" },
    { key: "archived", label: "Archived" },
  ];

  return (
    <div className="min-h-screen bg-paper">

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-[100] flex h-[60px] items-center justify-between border-b border-line bg-paper-2/90 px-12 backdrop-blur-xl">
        {/* Accent line */}
        <div className="absolute inset-x-0 top-0 h-0.5 bg-[linear-gradient(90deg,var(--salmon),var(--tuna))]" />

        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <Image src="/sushi-logo.png" alt="Sushi" width={28} height={28} />
          <span className="text-[17px] font-semibold tracking-[-0.3px] text-ink">Sushi</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link href="/compare" className="text-[13px] text-muted-ink no-underline">
            Compare
          </Link>
          <Link href="/docs" className="text-[13px] text-muted-ink no-underline">
            Docs
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg border border-line-2 px-3.5 py-1.5 text-[13px] text-muted-ink no-underline"
          >
            <Plus size={13} />
            New upload
          </Link>
          <SignedIn>
            <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
          </SignedIn>
        </div>
      </nav>

      {/* ── CONTENT ── */}
      <div className="mx-auto max-w-[860px] px-6 py-12">

        {/* Page heading */}
        <div className="mb-9">
          <h1 className="font-display mb-2 text-[38px] font-normal leading-[1.15] text-ink">
            My Datasets
          </h1>
          <p className="text-sm text-muted-ink">
            {datasets.length > 0
              ? `${datasets.length} saved workspace${datasets.length !== 1 ? "s" : ""}`
              : "Every uploaded dataset is saved here automatically."}
          </p>
        </div>

        {actionError && (
          <div className="mb-4 rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger">
            {actionError}
          </div>
        )}

        {/* Toolbar: pill tabs + upload CTA */}
        <div className="mb-5 flex items-center justify-between">
          {/* Pill tabs */}
          <div className="flex gap-1 rounded-xl bg-ink/5 p-[3px]">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "rounded-[9px] px-4 py-1.5 text-[13px] transition-all",
                  tab === t.key
                    ? "bg-surface font-medium text-ink shadow-soft-sm"
                    : "font-normal text-muted-ink",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex gap-2">
            <Link
              href="/compare"
              className="flex items-center gap-[7px] rounded-[10px] border border-line-2 bg-surface/70 px-4 py-2 text-[13.5px] font-medium text-muted-ink no-underline"
            >
              <ArrowUpDown size={13} />
              Compare datasets
            </Link>
            <Link
              href="/docs"
              className="flex items-center gap-[7px] rounded-[10px] border border-line-2 bg-surface/70 px-4 py-2 text-[13.5px] font-medium text-muted-ink no-underline"
            >
              <BookOpen size={13} />
              Sharing guide
            </Link>
            <Link
              href="/"
              className="flex items-center gap-[7px] rounded-[10px] bg-[linear-gradient(135deg,var(--salmon),var(--tuna))] px-[18px] py-2 text-[13.5px] font-medium text-white no-underline shadow-[0_2px_12px_rgba(242,112,74,0.35)]"
            >
              <Plus size={14} />
              Upload dataset
            </Link>
          </div>
        </div>

        {/* ── DATASET LIST ── */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-[22px] w-[22px] animate-spin text-brand" />
          </div>
        ) : error ? (
          <div className="py-20 text-center">
            <div className="mb-3 text-4xl">⚠️</div>
            <p className="text-sm text-muted-ink">{error}</p>
          </div>
        ) : datasets.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mx-auto mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-[20px] bg-brand-weak text-[32px]">
              {tab === "starred" ? "⭐" : tab === "archived" ? "📦" : "📂"}
            </div>
            <p className="mb-2 text-[15px] font-medium text-ink">
              {tab === "starred" ? "No starred datasets yet" :
               tab === "archived" ? "Archive is empty" :
               "No saved datasets yet"}
            </p>
            <p className="mb-5 text-[13px] text-muted-ink">
              {tab === "all" ? "Upload a file to create a saved workspace you can reopen anytime." : ""}
            </p>
            {tab === "all" && (
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-[linear-gradient(135deg,var(--salmon),var(--tuna))] px-5 py-2 text-[13.5px] font-medium text-white no-underline shadow-[0_2px_12px_rgba(242,112,74,0.3)]"
              >
                <Plus size={14} />
                Upload your first dataset
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {datasets.map((d) => {
              const tone = FILE_TONE[d.file_format] ?? "bg-ink/6 text-muted-ink";
              return (
                <div
                  key={d.id}
                  onClick={() => handleOpen(d)}
                  className={cn(
                    "group flex items-center gap-3.5 rounded-card border border-surface bg-surface/70 px-[18px] py-3.5 shadow-soft-sm backdrop-blur-md transition-all hover:border-brand/25 hover:shadow-soft",
                    d.status === "ready" ? "cursor-pointer" : "cursor-default opacity-60",
                  )}
                >
                  {/* Format badge */}
                  <span className={cn(
                    "shrink-0 rounded-md px-2.5 py-[3px] text-[11px] font-semibold uppercase tracking-[0.04em]",
                    tone,
                  )}>
                    {d.file_format}
                  </span>

                  {/* File icon */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-weak">
                    <FileSpreadsheet className="h-4 w-4 text-brand" />
                  </div>

                  {/* Name + meta */}
                  <div className="min-w-0 flex-1">
                    <p className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium text-ink">
                      {d.name}
                    </p>
                    <p className="mt-0.5 text-xs text-faint-ink">
                      {d.row_count != null ? `${d.row_count.toLocaleString()} rows` : "—"}
                      {d.column_count != null ? ` · ${d.column_count} cols` : ""}
                      {" · "}{formatBytes(d.file_size_bytes)}
                      {" · "}{timeAgo(d.created_at)}
                    </p>
                  </div>

                  {/* Processing badge */}
                  {d.status !== "ready" && (
                    <span className={cn(
                      "shrink-0 rounded-pill px-2.5 py-[3px] text-[11px] font-medium",
                      d.status === "processing" || d.status === "pending"
                        ? "bg-warning/10 text-warning"
                        : "bg-danger/10 text-danger",
                    )}>
                      {d.status}
                    </span>
                  )}

                  {/* Opening spinner */}
                  {openingId === d.id && (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand" />
                  )}

                  {/* Hover actions */}
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={(e) => handleRename(e, d)}
                      title="Rename dataset"
                      className="rounded-lg border-none bg-transparent p-[7px] text-faint-ink"
                    >
                      <Pencil className="h-[15px] w-[15px]" />
                    </button>

                    <button
                      onClick={(e) => handleStar(e, d.id)}
                      title={d.is_starred ? "Unstar" : "Star"}
                      className={cn(
                        "rounded-lg border-none bg-transparent p-[7px]",
                        d.is_starred ? "text-warning" : "text-faint-ink",
                      )}
                    >
                      <Star className="h-[15px] w-[15px]" fill={d.is_starred ? "currentColor" : "none"} />
                    </button>

                    {tab === "archived" ? (
                      <button
                        onClick={(e) => handleRestore(e, d.id)}
                        title="Restore"
                        className="rounded-lg border-none bg-transparent p-[7px] text-faint-ink"
                      >
                        <ArchiveRestore className="h-[15px] w-[15px]" />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => handleArchive(e, d.id)}
                        title="Move to archive"
                        className="rounded-lg border-none bg-transparent p-[7px] text-faint-ink"
                      >
                        <Trash2 className="h-[15px] w-[15px]" />
                      </button>
                    )}
                  </div>

                  {/* Persistent star indicator */}
                  {d.is_starred && openingId !== d.id && (
                    <Star className="h-3.5 w-3.5 shrink-0 text-warning group-hover:hidden" fill="currentColor" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
