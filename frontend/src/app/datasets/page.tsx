"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Database,
  FileSpreadsheet,
  Loader2,
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
  listDatasets,
  restoreDataset,
  starDataset,
} from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SignedIn, UserButton } from "@clerk/nextjs";

type Tab = "all" | "starred" | "archived";

const FORMAT_COLORS: Record<string, string> = {
  csv: "bg-emerald-100 text-emerald-700",
  xlsx: "bg-blue-100 text-blue-700",
  xls: "bg-blue-100 text-blue-700",
  parquet: "bg-violet-100 text-violet-700",
  json: "bg-amber-100 text-amber-700",
  tsv: "bg-teal-100 text-teal-700",
  sqlite: "bg-orange-100 text-orange-700",
  db: "bg-orange-100 text-orange-700",
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

export default function DatasetsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (t: Tab) => {
    setLoading(true);
    setError(null);
    try {
      const data = await listDatasets("default", {
        archived: t === "archived",
        starred: t === "starred",
      });
      setDatasets(data);
    } catch {
      setError("Failed to load datasets. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(tab); }, [tab, load]);

  const handleStar = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await starDataset(id);
    setDatasets((prev) =>
      prev.map((d) => d.id === id ? { ...d, is_starred: !d.is_starred } : d)
    );
  };

  const handleArchive = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await archiveDataset(id);
    setDatasets((prev) => prev.filter((d) => d.id !== id));
  };

  const handleRestore = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await restoreDataset(id);
    setDatasets((prev) => prev.filter((d) => d.id !== id));
  };

  const handleOpen = async (dataset: DatasetSummary) => {
    if (dataset.status !== "ready") return;
    setOpeningId(dataset.id);
    try {
      const analysis = await fetchDatasetAnalysis(dataset.id);
      sessionStorage.setItem("eda_report", JSON.stringify(analysis.report));
      sessionStorage.setItem("eda_filename", dataset.original_filename);
      router.push("/");
    } catch {
      setOpeningId(null);
    }
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "all", label: "All datasets" },
    { key: "starred", label: "Starred" },
    { key: "archived", label: "Archived" },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <header className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/sushi-logo.png" alt="Sushi" width={28} height={28} />
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">Sushi</span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <SignedIn>
              <UserButton appearance={{ elements: { avatarBox: "w-7 h-7" } }} />
            </SignedIn>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Page title + upload CTA */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">My Datasets</h1>
            <p className="text-sm text-neutral-500 mt-0.5">
              {datasets.length} dataset{datasets.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg bg-neutral-900 dark:bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New upload
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 border-b border-neutral-200 dark:border-neutral-800">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t.key
                  ? "border-neutral-900 dark:border-white text-neutral-900 dark:text-white"
                  : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <Database className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm text-neutral-500">{error}</p>
          </div>
        ) : datasets.length === 0 ? (
          <div className="text-center py-20">
            <FileSpreadsheet className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
              {tab === "starred" ? "No starred datasets yet" :
               tab === "archived" ? "Trash is empty" :
               "No datasets yet"}
            </p>
            {tab === "all" && (
              <Link href="/" className="mt-3 inline-block text-sm text-indigo-600 hover:underline">
                Upload your first dataset →
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {datasets.map((d) => (
              <div
                key={d.id}
                onClick={() => handleOpen(d)}
                className={`group flex items-center gap-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 transition-all ${
                  d.status === "ready"
                    ? "cursor-pointer hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-sm"
                    : "opacity-60 cursor-default"
                }`}
              >
                {/* Format badge */}
                <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${FORMAT_COLORS[d.file_format] ?? "bg-neutral-100 text-neutral-600"}`}>
                  {d.file_format}
                </span>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                    {d.name}
                  </p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {d.row_count != null ? `${d.row_count.toLocaleString()} rows` : "—"}
                    {d.column_count != null ? ` · ${d.column_count} cols` : ""}
                    {" · "}{formatBytes(d.file_size_bytes)}
                    {" · "}{timeAgo(d.created_at)}
                  </p>
                </div>

                {/* Status badge */}
                {d.status !== "ready" && (
                  <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                    d.status === "processing" || d.status === "pending"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700"
                  }`}>
                    {d.status}
                  </span>
                )}

                {/* Loading spinner when opening */}
                {openingId === d.id && (
                  <Loader2 className="h-4 w-4 animate-spin text-neutral-400 shrink-0" />
                )}

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleStar(e, d.id)}
                    title={d.is_starred ? "Unstar" : "Star"}
                    className={`rounded-lg p-1.5 transition-colors ${
                      d.is_starred
                        ? "text-amber-500 hover:text-amber-600"
                        : "text-neutral-300 hover:text-neutral-500"
                    }`}
                  >
                    <Star className="h-4 w-4" fill={d.is_starred ? "currentColor" : "none"} />
                  </button>

                  {tab === "archived" ? (
                    <button
                      onClick={(e) => handleRestore(e, d.id)}
                      title="Restore"
                      className="rounded-lg p-1.5 text-neutral-300 hover:text-emerald-600 transition-colors"
                    >
                      <ArchiveRestore className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => handleArchive(e, d.id)}
                      title="Move to trash"
                      className="rounded-lg p-1.5 text-neutral-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Persistent star for starred items */}
                {d.is_starred && openingId !== d.id && (
                  <Star className="h-3.5 w-3.5 text-amber-400 shrink-0 group-hover:hidden" fill="currentColor" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
