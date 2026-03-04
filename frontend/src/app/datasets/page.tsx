"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  ArchiveRestore,
  FileSpreadsheet,
  Loader2,
  Plus,
  Star,
  Trash2,
  Unplug,
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
import { SignedIn, UserButton } from "@clerk/nextjs";

type Tab = "all" | "starred" | "archived";

const FORMAT_BG: Record<string, string> = {
  csv:     "rgba(16,185,129,0.12)",
  xlsx:    "rgba(59,130,246,0.12)",
  xls:     "rgba(59,130,246,0.12)",
  parquet: "rgba(144,96,248,0.12)",
  json:    "rgba(245,158,11,0.12)",
  tsv:     "rgba(20,184,166,0.12)",
  sqlite:  "rgba(249,115,22,0.12)",
  db:      "rgba(249,115,22,0.12)",
};

const FORMAT_TEXT: Record<string, string> = {
  csv:     "#059669",
  xlsx:    "#2563eb",
  xls:     "#2563eb",
  parquet: "#7c3aed",
  json:    "#d97706",
  tsv:     "#0f766e",
  sqlite:  "#ea580c",
  db:      "#ea580c",
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
      sessionStorage.setItem("eda_dataset_id", dataset.id);
      router.push("/");
    } catch {
      setOpeningId(null);
    }
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "all",      label: "All datasets" },
    { key: "starred",  label: "Starred" },
    { key: "archived", label: "Archived" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f0eee9" }}>

      {/* ── NAV ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(240,238,233,0.88)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0,0,0,0.07)",
        padding: "0 48px",
        height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        {/* Purple accent line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, #9060f8, #e840c8)" }} />

        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <Image src="/sushi-logo.png" alt="Sushi" width={28} height={28} />
          <span style={{ fontWeight: 600, fontSize: 17, color: "#111010", letterSpacing: "-0.3px" }}>Sushi</span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/connectors" style={{ fontSize: 13, color: "#6b6860", textDecoration: "none" }}>
            Connections
          </Link>
          <Link href="/pipelines" style={{ fontSize: 13, color: "#6b6860", textDecoration: "none" }}>
            Pipelines
          </Link>
          <Link href="/" style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 14px", borderRadius: 8, fontSize: 13,
            color: "#6b6860", textDecoration: "none",
            border: "1px solid rgba(0,0,0,0.1)",
          }}>
            <Plus size={13} />
            New upload
          </Link>
          <SignedIn>
            <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
          </SignedIn>
        </div>
      </nav>

      {/* ── CONTENT ── */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "48px 24px" }}>

        {/* Page heading */}
        <div style={{ marginBottom: 36 }}>
          <h1 className="font-display" style={{ fontSize: 38, fontWeight: 400, color: "#111010", lineHeight: 1.15, marginBottom: 8 }}>
            My Datasets
          </h1>
          <p style={{ fontSize: 14, color: "#6b6860" }}>
            {datasets.length > 0
              ? `${datasets.length} dataset${datasets.length !== 1 ? "s" : ""}`
              : "Your uploaded files will appear here."}
          </p>
        </div>

        {/* Toolbar: pill tabs + upload CTA */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          {/* Pill tabs */}
          <div style={{ display: "flex", gap: 4, background: "rgba(0,0,0,0.05)", borderRadius: 12, padding: 3 }}>
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  padding: "6px 16px",
                  borderRadius: 9,
                  fontSize: 13,
                  fontWeight: tab === t.key ? 500 : 400,
                  color: tab === t.key ? "#111010" : "#6b6860",
                  background: tab === t.key ? "white" : "transparent",
                  boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* CTAs */}
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/connectors" style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "8px 16px", borderRadius: 10,
              fontSize: 13.5, fontWeight: 500,
              background: "rgba(255,255,255,0.72)",
              border: "1px solid rgba(0,0,0,0.1)",
              color: "#6b6860", textDecoration: "none",
            }}>
              <Unplug size={13} />
              Connect source
            </Link>
            <Link href="/pipelines" style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "8px 16px", borderRadius: 10,
              fontSize: 13.5, fontWeight: 500,
              background: "rgba(255,255,255,0.72)",
              border: "1px solid rgba(0,0,0,0.1)",
              color: "#6b6860", textDecoration: "none",
            }}>
              <ArrowUpDown size={13} />
              Build pipeline
            </Link>
            <Link href="/" style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "8px 18px", borderRadius: 10,
              fontSize: 13.5, fontWeight: 500,
              background: "linear-gradient(135deg, #9060f8, #e840c8)",
              color: "white", textDecoration: "none",
              boxShadow: "0 2px 12px rgba(144,96,248,0.35)",
            }}>
              <Plus size={14} />
              Upload dataset
            </Link>
          </div>
        </div>

        {/* ── DATASET LIST ── */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
            <Loader2 style={{ width: 22, height: 22, color: "#9060f8", animation: "spin 1s linear infinite" }} />
          </div>
        ) : error ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <p style={{ fontSize: 14, color: "#6b6860" }}>{error}</p>
          </div>
        ) : datasets.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{
              width: 72, height: 72, borderRadius: 20, margin: "0 auto 20px",
              background: "linear-gradient(135deg, rgba(144,96,248,0.12), rgba(232,64,200,0.12))",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 32,
            }}>
              {tab === "starred" ? "⭐" : tab === "archived" ? "📦" : "📂"}
            </div>
            <p style={{ fontSize: 15, fontWeight: 500, color: "#111010", marginBottom: 8 }}>
              {tab === "starred" ? "No starred datasets yet" :
               tab === "archived" ? "Archive is empty" :
               "No datasets yet"}
            </p>
            <p style={{ fontSize: 13, color: "#6b6860", marginBottom: 20 }}>
              {tab === "all" ? "Upload a file to get started with AI-powered analysis." : ""}
            </p>
            {tab === "all" && (
              <Link href="/" style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 20px", borderRadius: 10,
                fontSize: 13.5, fontWeight: 500,
                background: "linear-gradient(135deg, #9060f8, #e840c8)",
                color: "white", textDecoration: "none",
                boxShadow: "0 2px 12px rgba(144,96,248,0.3)",
              }}>
                <Plus size={14} />
                Upload your first dataset
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {datasets.map((d) => (
              <div
                key={d.id}
                onClick={() => handleOpen(d)}
                className="group"
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 18px",
                  background: "rgba(255,255,255,0.72)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.8)",
                  cursor: d.status === "ready" ? "pointer" : "default",
                  boxShadow: "0 2px 16px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)",
                  transition: "all 0.15s ease",
                  opacity: d.status !== "ready" ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (d.status === "ready") {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.09)";
                    (e.currentTarget as HTMLDivElement).style.border = "1px solid rgba(144,96,248,0.25)";
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 16px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)";
                  (e.currentTarget as HTMLDivElement).style.border = "1px solid rgba(255,255,255,0.8)";
                }}
              >
                {/* Format badge */}
                <span style={{
                  flexShrink: 0,
                  padding: "3px 9px",
                  borderRadius: 7,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  background: FORMAT_BG[d.file_format] ?? "rgba(0,0,0,0.06)",
                  color: FORMAT_TEXT[d.file_format] ?? "#6b6860",
                }}>
                  {d.file_format}
                </span>

                {/* File icon */}
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: "linear-gradient(135deg, rgba(144,96,248,0.1), rgba(232,64,200,0.1))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <FileSpreadsheet style={{ width: 16, height: 16, color: "#9060f8" }} />
                </div>

                {/* Name + meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: "#111010", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {d.name}
                  </p>
                  <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                    {d.row_count != null ? `${d.row_count.toLocaleString()} rows` : "—"}
                    {d.column_count != null ? ` · ${d.column_count} cols` : ""}
                    {" · "}{formatBytes(d.file_size_bytes)}
                    {" · "}{timeAgo(d.created_at)}
                  </p>
                </div>

                {/* Processing badge */}
                {d.status !== "ready" && (
                  <span style={{
                    padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 500,
                    background: d.status === "processing" || d.status === "pending"
                      ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.12)",
                    color: d.status === "processing" || d.status === "pending" ? "#b45309" : "#dc2626",
                    flexShrink: 0,
                  }}>
                    {d.status}
                  </span>
                )}

                {/* Opening spinner */}
                {openingId === d.id && (
                  <Loader2 style={{ width: 16, height: 16, color: "#9060f8", flexShrink: 0, animation: "spin 1s linear infinite" }} />
                )}

                {/* Hover actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }} className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleStar(e, d.id)}
                    title={d.is_starred ? "Unstar" : "Star"}
                    style={{
                      padding: 7, borderRadius: 8, border: "none",
                      background: "transparent", cursor: "pointer",
                      color: d.is_starred ? "#f59e0b" : "#d1d5db",
                    }}
                  >
                    <Star style={{ width: 15, height: 15 }} fill={d.is_starred ? "currentColor" : "none"} />
                  </button>

                  {tab === "archived" ? (
                    <button
                      onClick={(e) => handleRestore(e, d.id)}
                      title="Restore"
                      style={{ padding: 7, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", color: "#d1d5db" }}
                    >
                      <ArchiveRestore style={{ width: 15, height: 15 }} />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => handleArchive(e, d.id)}
                      title="Move to archive"
                      style={{ padding: 7, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", color: "#d1d5db" }}
                    >
                      <Trash2 style={{ width: 15, height: 15 }} />
                    </button>
                  )}
                </div>

                {/* Persistent star indicator */}
                {d.is_starred && openingId !== d.id && (
                  <Star className="group-hover:hidden" style={{ width: 14, height: 14, color: "#f59e0b", flexShrink: 0 }} fill="currentColor" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
