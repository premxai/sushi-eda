"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useUser, UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Upload,
  FileSpreadsheet,
  Star,
  TrendingUp,
  Database,
  ArrowRight,
  Folder,
  Layers,
  Zap,
  AlertCircle,
  X,
  Clock,
} from "lucide-react";
import { DatasetSummary, listDatasets } from "@/lib/api";
import { useDropzone } from "react-dropzone";
import { Progress } from "@/components/ui/progress";

/* ─── Types ───────────────────────────────────────────────── */
interface UserDashboardProps {
  onFileAccepted: (file: File) => void;
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
  onClearError: () => void;
  onLoadSample: () => void;
}

/* ─── Helpers ─────────────────────────────────────────────── */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatRowsShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
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

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const FORMAT_COLORS: Record<string, { bg: string; color: string; gradient: string }> = {
  csv:     { bg: "rgba(144,96,248,0.12)",  color: "#7a40e8", gradient: "linear-gradient(135deg,#9060f8,#7c4ddb)" },
  xlsx:    { bg: "rgba(64,128,255,0.12)",  color: "#3060e0", gradient: "linear-gradient(135deg,#4080ff,#3060cc)" },
  xls:     { bg: "rgba(64,128,255,0.12)",  color: "#3060e0", gradient: "linear-gradient(135deg,#4080ff,#3060cc)" },
  json:    { bg: "rgba(232,160,32,0.12)",  color: "#c88010", gradient: "linear-gradient(135deg,#e8a020,#c88010)" },
  parquet: { bg: "rgba(232,64,200,0.12)",  color: "#c030a8", gradient: "linear-gradient(135deg,#e840c8,#c030a8)" },
  tsv:     { bg: "rgba(0,212,232,0.12)",   color: "#00a0b8", gradient: "linear-gradient(135deg,#00d4e8,#00a0b8)" },
  sqlite:  { bg: "rgba(32,192,96,0.12)",   color: "#189050", gradient: "linear-gradient(135deg,#20c060,#189050)" },
  db:      { bg: "rgba(32,192,96,0.12)",   color: "#189050", gradient: "linear-gradient(135deg,#20c060,#189050)" },
};

function getFormatStyle(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "csv";
  return { ext, ...(FORMAT_COLORS[ext] || FORMAT_COLORS.csv) };
}

function statusDot(status: string): { dot: string; label: string } {
  const map: Record<string, { dot: string; label: string }> = {
    ready:      { dot: "#20c060", label: "Ready" },
    processing: { dot: "#e8a020", label: "Processing" },
    failed:     { dot: "#e85454", label: "Failed" },
    pending:    { dot: "#9a9690", label: "Pending" },
  };
  return map[status] || map.ready;
}

/* ─── Toast ───────────────────────────────────────────────── */
function Toast({ msg }: { msg: string }) {
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      zIndex: 9999, background: "#141414",
      border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10,
      padding: "11px 18px", color: "#fff", fontSize: 13,
      boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
      display: "flex", alignItems: "center", gap: 10,
      animation: "toastSlide .3s ease-out",
      whiteSpace: "nowrap",
    }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#00c8d8", flexShrink: 0 }} />
      {msg}
    </div>
  );
}

/* ─── Dataset Card ─────────────────────────────────────────── */
function DatasetCard({ ds, onClick }: { ds: DatasetSummary; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  const fmt = getFormatStyle(ds.original_filename);
  const st = statusDot(ds.status);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", flexDirection: "column",
        padding: "18px 20px",
        background: hov ? "#fff" : "rgba(255,255,255,0.72)",
        border: hov ? "1px solid rgba(144,96,248,0.28)" : "1px solid rgba(0,0,0,0.07)",
        borderRadius: 14, textAlign: "left", cursor: "pointer",
        transition: "all 0.18s ease",
        boxShadow: hov ? "0 4px 20px rgba(144,96,248,0.1)" : "none",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{
          padding: "5px 10px", borderRadius: 6,
          background: fmt.gradient,
          fontSize: 11, fontWeight: 700, color: "#fff",
          letterSpacing: "0.5px", textTransform: "uppercase",
        }}>
          {fmt.ext}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {ds.is_starred && <Star size={13} style={{ color: "#e8a020", fill: "#e8a020" }} />}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: st.dot }} />
            <span style={{ fontSize: 10, color: "#9a9690", fontFamily: "ui-monospace, monospace" }}>{st.label}</span>
          </div>
        </div>
      </div>
      <p style={{
        fontSize: 13, fontWeight: 500, color: "#111010",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        marginBottom: 6,
      }}>
        {ds.original_filename}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {ds.row_count != null && (
          <span style={{ fontSize: 11, color: "#9a9690", display: "flex", alignItems: "center", gap: 3 }}>
            <Layers size={10} style={{ opacity: 0.6 }} />
            {formatRowsShort(ds.row_count)} rows
          </span>
        )}
        {ds.column_count != null && (
          <span style={{ fontSize: 11, color: "#9a9690" }}>{ds.column_count} cols</span>
        )}
        <span style={{ fontSize: 11, color: "#9a9690" }}>{formatBytes(ds.file_size_bytes)}</span>
        <span style={{ fontSize: 11, color: "#b8b4ae", marginLeft: "auto" }}>{timeAgo(ds.created_at)}</span>
      </div>
    </button>
  );
}

/* ─── Upload Panel ─────────────────────────────────────────── */
interface UploadPanelProps extends UserDashboardProps {
  datasets: DatasetSummary[];
  onDatasetPick: (id: string) => void;
}

function UploadPanel({
  onFileAccepted, isUploading, uploadProgress, error, onClearError, onLoadSample,
  datasets, onDatasetPick,
}: UploadPanelProps) {
  const [tab, setTab] = useState<"upload" | "datasets">("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) {
      setSelectedFile(accepted[0]);
      onFileAccepted(accepted[0]);
    }
  }, [onFileAccepted]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "text/tab-separated-values": [".tsv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "application/json": [".json"],
      "application/vnd.apache.parquet": [".parquet"],
      "application/x-sqlite3": [".db", ".sqlite", ".sqlite3"],
    },
    maxFiles: 1,
    disabled: isUploading,
    maxSize: 100 * 1024 * 1024,
  });

  const handleClearError = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    onClearError();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Tab switcher */}
      <div style={{ display: "flex", marginBottom: 14, background: "rgba(0,0,0,0.05)", borderRadius: 10, padding: 3, gap: 2 }}>
        {(["upload", "datasets"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: "7px 0", borderRadius: 8,
            fontSize: 12.5, fontWeight: tab === t ? 600 : 400,
            background: tab === t ? "#fff" : "transparent",
            border: "none", cursor: "pointer",
            color: tab === t ? "#111010" : "#9a9690",
            boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
            transition: "all 0.15s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            {t === "upload" ? <><Upload size={12} />Upload File</> : <><Folder size={12} />My Datasets</>}
          </button>
        ))}
      </div>

      {/* Upload tab */}
      {tab === "upload" && (
        <>
          <div
            {...getRootProps()}
            style={{
              background: isDragActive ? "rgba(144,96,248,0.07)" : "rgba(255,255,255,0.72)",
              border: isDragActive ? "2px dashed rgba(144,96,248,0.55)" : "1.5px dashed rgba(0,0,0,0.13)",
              borderRadius: 16, padding: "42px 24px",
              textAlign: "center", cursor: isUploading ? "default" : "pointer",
              transition: "all 0.2s ease", minHeight: 190,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            }}
          >
            <input {...getInputProps()} />
            {isUploading && selectedFile ? (
              <div style={{ width: "100%", maxWidth: 340 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}>
                  <FileSpreadsheet size={15} style={{ color: "#9060f8" }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#111010" }}>{selectedFile.name}</span>
                  <span style={{ fontSize: 11, color: "#9a9690" }}>{formatBytes(selectedFile.size)}</span>
                </div>
                <Progress value={uploadProgress} className="h-[5px]" />
                <p style={{ fontSize: 11, color: "#9a9690", marginTop: 8, fontFamily: "ui-monospace, monospace" }}>
                  {uploadProgress === 0 ? "Connecting…" : uploadProgress < 50 ? `Uploading… ${Math.round(uploadProgress)}%` : uploadProgress < 90 ? "Analyzing…" : "Almost done…"}
                </p>
              </div>
            ) : error ? (
              <div style={{ textAlign: "center" }}>
                <AlertCircle size={26} style={{ color: "#e85454", margin: "0 auto 8px" }} />
                <p style={{ fontSize: 14, fontWeight: 500, color: "#e85454" }}>Upload failed</p>
                <p style={{ fontSize: 12, color: "#9a9690", marginTop: 4 }}>{error}</p>
                <button onClick={handleClearError} style={{ fontSize: 12, color: "#9060f8", background: "none", border: "none", cursor: "pointer", marginTop: 10, fontWeight: 500 }}>
                  Try again
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {[
                    ["CSV",  "linear-gradient(135deg,#9060f8,#7c4ddb)"],
                    ["XLS",  "linear-gradient(135deg,#e840c8,#c836ab)"],
                    ["JSON", "linear-gradient(135deg,#00d4e8,#00a0b8)"],
                    ["PARQ", "linear-gradient(135deg,#e8a020,#c88010)"],
                  ].map(([l, g]) => (
                    <span key={l} style={{ padding: "5px 11px", borderRadius: 7, fontSize: 11, fontWeight: 700, color: "#fff", background: g }}>{l}</span>
                  ))}
                </div>
                <p style={{ fontSize: 14, color: "#111010" }}>
                  Drop files or <span style={{ color: "#9060f8", fontWeight: 600, cursor: "pointer" }}>browse</span>
                </p>
                <p style={{ fontSize: 12, color: "#9a9690", marginTop: 4 }}>CSV, JSON, Excel, Parquet, SQLite — up to 100 MB</p>
              </>
            )}
          </div>

          {!isUploading && !selectedFile && (
            <button onClick={onLoadSample} style={{ display: "block", margin: "10px auto 0", fontSize: 12.5, color: "#9a9690", background: "none", border: "none", cursor: "pointer" }}>
              or try <span style={{ color: "#9060f8", fontWeight: 500 }}>&ldquo;Sales Data&rdquo;</span> sample
            </button>
          )}

          {error && !isUploading && (
            <button onClick={handleClearError} style={{
              display: "flex", width: "100%", marginTop: 10,
              alignItems: "center", gap: 8, borderRadius: 10,
              border: "1px solid rgba(232,84,84,0.2)",
              background: "rgba(232,84,84,0.06)",
              padding: "9px 14px", fontSize: 12, color: "#e85454", cursor: "pointer",
            }}>
              <AlertCircle size={13} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, textAlign: "left" }}>{error}</span>
              <X size={13} style={{ flexShrink: 0 }} />
            </button>
          )}
        </>
      )}

      {/* My Datasets tab (inline picker) */}
      {tab === "datasets" && (
        <div style={{
          background: "rgba(255,255,255,0.72)",
          border: "1px solid rgba(0,0,0,0.07)",
          borderRadius: 16, overflow: "hidden",
          maxHeight: 320, overflowY: "auto",
        }}>
          {datasets.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center" }}>
              <FileSpreadsheet size={28} style={{ color: "#c8c4be", margin: "0 auto 10px" }} />
              <p style={{ fontSize: 13, color: "#9a9690" }}>No datasets yet — upload your first file</p>
            </div>
          ) : (
            <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
              {datasets.map((ds) => {
                const fmt = getFormatStyle(ds.original_filename);
                return (
                  <button key={ds.id} onClick={() => onDatasetPick(ds.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", borderRadius: 9,
                      background: "transparent", border: "1px solid transparent",
                      textAlign: "left", cursor: "pointer", transition: "all 0.13s", width: "100%",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(144,96,248,0.06)"; e.currentTarget.style.borderColor = "rgba(144,96,248,0.2)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: 7, flexShrink: 0, background: fmt.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: fmt.color, textTransform: "uppercase" }}>{fmt.ext}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: "#111010", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ds.original_filename}</p>
                      <p style={{ fontSize: 11, color: "#9a9690" }}>{ds.row_count ? `${formatRowsShort(ds.row_count)} rows · ` : ""}{timeAgo(ds.created_at)}</p>
                    </div>
                    {ds.is_starred && <Star size={12} style={{ color: "#e8a020", fill: "#e8a020", flexShrink: 0 }} />}
                    <ArrowRight size={13} style={{ color: "#c8c4be", flexShrink: 0 }} />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Getting Started Widget ───────────────────────────────── */
const GETTING_STARTED_STEPS = [
  { label: "Create account",       done: true },
  { label: "Upload first dataset", done: true },
  { label: "Explore Overview",     done: true },
  { label: "Run Statistics",       done: false },
  { label: "Try SQL Editor",       done: false },
  { label: "Share a Report",       done: false },
  { label: "Set up a Monitor",     done: false },
  { label: "Connect a Database",   done: false },
];

function GettingStarted({ onStepClick }: { onStepClick: (label: string) => void }) {
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState(true);

  const done = GETTING_STARTED_STEPS.filter((s) => s.done).length;
  const total = GETTING_STARTED_STEPS.length;
  const pct = Math.round((done / total) * 100);
  const circumference = 88;
  const dashArray = `${(pct / 100) * circumference} ${circumference}`;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed", bottom: 20, right: 20, zIndex: 80,
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 16px", borderRadius: 20,
          background: "#fff", border: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)", cursor: "pointer", fontSize: 13, color: "#111010",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="4" />
          <circle cx="18" cy="18" r="14" fill="none" stroke="#9060f8" strokeWidth="4"
            strokeDasharray={dashArray} strokeDashoffset="22" transform="rotate(-90 18 18)" />
        </svg>
        Getting started · {pct}%
      </button>
    );
  }

  return (
    <div style={{
      position: "fixed", bottom: 20, right: 20, zIndex: 80,
      width: 280, background: "#fff", borderRadius: 14,
      border: "1px solid rgba(0,0,0,0.08)",
      boxShadow: "0 8px 32px rgba(0,0,0,0.14)", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 16px 12px", borderBottom: "1px solid rgba(0,0,0,0.07)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="22" height="22" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="4" />
            <circle cx="18" cy="18" r="14" fill="none" stroke="#9060f8" strokeWidth="4"
              strokeDasharray={dashArray} strokeDashoffset="22" transform="rotate(-90 18 18)" />
          </svg>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#111010" }}>Getting started</div>
            <div style={{ fontSize: 11, color: "#888580" }}>{done}/{total} steps completed</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => setExpanded((e) => !e)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#888580", fontSize: 16, padding: "2px 4px" }}>
            {expanded ? "∧" : "∨"}
          </button>
          <button onClick={() => setOpen(false)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#888580", fontSize: 16, padding: "2px 4px" }}>
            ×
          </button>
        </div>
      </div>
      {/* Steps */}
      {expanded && (
        <div style={{ maxHeight: 224, overflowY: "auto", padding: "8px 12px" }}>
          {GETTING_STARTED_STEPS.map((s, i) => (
            <div key={i} onClick={() => onStepClick(s.label)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "7px 4px", cursor: "pointer", borderRadius: 6,
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{
                width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                background: s.done ? "#9060f8" : "transparent",
                border: s.done ? "1px solid #9060f8" : "1px solid rgba(0,0,0,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, color: "#fff",
              }}>
                {s.done ? "✓" : ""}
              </div>
              <span style={{ fontSize: 12, color: s.done ? "#888580" : "#1a1a1a", textDecoration: s.done ? "line-through" : "none", fontWeight: s.done ? 300 : 400 }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
export function UserDashboard(props: UserDashboardProps) {
  const { onFileAccepted, isUploading, uploadProgress, error, onClearError, onLoadSample } = props;
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const loadDatasets = useCallback(async () => {
    setLoading(true);
    try {
      const all = await listDatasets("default", { archived: false });
      setDatasets(all);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoaded && user) loadDatasets();
  }, [isLoaded, user, loadDatasets]);

  const firstName = user?.firstName || user?.username || "there";

  const handleDatasetClick = (id: string) => router.push(`/datasets/${id}`);

  // Aggregate stats
  const totalRows = datasets.reduce((s, d) => s + (d.row_count ?? 0), 0);
  const totalSize = datasets.reduce((s, d) => s + d.file_size_bytes, 0);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const thisWeek = datasets.filter((d) => new Date(d.created_at).getTime() > weekAgo).length;
  const starred = datasets.filter((d) => d.is_starred).length;

  // Format distribution
  const fmtMap: Record<string, number> = {};
  datasets.forEach((d) => {
    const ext = d.original_filename.split(".").pop()?.toLowerCase() || "other";
    fmtMap[ext] = (fmtMap[ext] || 0) + 1;
  });
  const fmtEntries = Object.entries(fmtMap).sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ height: "100vh", background: "#e8e6df", overflow: "hidden" }}>
      <style>{`
        @keyframes toastSlide { from { opacity:0; transform:translateX(-50%) translateY(8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {toast && <Toast msg={toast} />}

      {/* ── Content ── */}
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Top bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "13px 28px",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          background: "rgba(232,230,223,0.9)",
          backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
          position: "sticky", top: 0, zIndex: 40, flexShrink: 0,
        }}>
          {/* Gradient accent line */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,transparent,rgba(144,96,248,0.5),rgba(232,64,200,0.5),transparent)" }} />

          <div style={{ display: "flex", gap: 20 }}>
            {[
              { href: "/datasets",   label: "My Datasets" },
              { href: "/connectors", label: "Connectors" },
            ].map((item) => (
              <Link key={item.href} href={item.href}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  fontSize: 14, color: "#888580", textDecoration: "none",
                  transition: "color 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget as HTMLAnchorElement).style.color = "#1a1a1a"}
                onMouseLeave={(e) => (e.currentTarget as HTMLAnchorElement).style.color = "#888580"}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/compare" style={{
              display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
              borderRadius: 8, fontSize: 13, border: "1px solid rgba(0,0,0,0.08)",
              background: "#fff", color: "#1a1a1a", textDecoration: "none",
              transition: "box-shadow 0.15s",
            }}
              onMouseEnter={(e) => (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)"}
              onMouseLeave={(e) => (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none"}
            >
              ⇄ Compare
            </Link>
            <button
              onClick={() => notify("Export available after uploading a dataset")}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
                borderRadius: 8, fontSize: 13, border: "1px solid rgba(0,0,0,0.08)",
                background: "#fff", color: "#9a9690", cursor: "pointer",
              }}
            >
              ↓ Export PDF
            </button>
            <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
          </div>
        </div>

        {/* Scrollable main content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "28px 28px 80px" }}>

          {/* Greeting */}
          <div style={{ marginBottom: 32 }}>
            <h1 className="font-display" style={{ fontFamily: "Instrument Serif, serif", fontSize: 40, letterSpacing: "-0.5px", marginBottom: 8, color: "#1a1a1a" }}>
              {getGreeting()}, <em style={{ fontStyle: "italic" }}>{firstName}.</em>
            </h1>
            <p style={{ fontSize: 15, color: "#888580", lineHeight: 1.5 }}>
              Upload a dataset to get instant AI-powered insights, or pick up where you left off.
            </p>
          </div>

          {/* 2-col: Upload (left) | Recent (right) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>

            {/* Left: Upload panel */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12, fontSize: 11, fontFamily: "ui-monospace, monospace", letterSpacing: "2px", textTransform: "uppercase", color: "#888580" }}>
                <Zap size={12} style={{ color: "#9060f8" }} />
                UPLOAD NEW
              </div>
              <UploadPanel
                onFileAccepted={onFileAccepted}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
                error={error}
                onClearError={onClearError}
                onLoadSample={onLoadSample}
                datasets={datasets}
                onDatasetPick={handleDatasetClick}
              />
              {/* Quick connect tiles */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                {[
                  { href: "/connectors", icon: <Database size={16} style={{ color: "#9060f8" }} />, label: "Connect DB",  sub: "PostgreSQL, MySQL",   bg: "rgba(144,96,248,0.1)" },
                  { href: "/pipelines",  icon: <TrendingUp size={16} style={{ color: "#00d4e8" }} />, label: "Pipelines",  sub: "Automate workflows", bg: "rgba(0,212,232,0.1)" },
                ].map((a) => (
                  <Link key={a.href} href={a.href} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
                    borderRadius: 10, border: "1px solid rgba(0,0,0,0.07)",
                    background: "rgba(255,255,255,0.72)", textDecoration: "none",
                    transition: "box-shadow 0.15s",
                  }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.1)"}
                    onMouseLeave={(e) => (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none"}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: a.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {a.icon}
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: "#111010" }}>{a.label}</p>
                      <p style={{ fontSize: 11, color: "#9a9690" }}>{a.sub}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Right: Recent datasets */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, fontFamily: "ui-monospace, monospace", letterSpacing: "2px", textTransform: "uppercase", color: "#888580" }}>
                  <Clock size={12} />
                  RECENT
                  {datasets.length > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#9060f8", background: "rgba(144,96,248,0.08)", padding: "2px 8px", borderRadius: 20 }}>{datasets.length}</span>
                  )}
                </div>
                <Link href="/datasets" style={{ fontSize: 13, color: "#9060f8", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, fontWeight: 500 }}>
                  View all <ArrowRight size={12} />
                </Link>
              </div>

              {loading ? (
                <div style={{ background: "rgba(255,255,255,0.72)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, padding: "52px 24px", textAlign: "center" }}>
                  <div style={{ width: 20, height: 20, border: "2px solid rgba(144,96,248,0.2)", borderTopColor: "#9060f8", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
                </div>
              ) : datasets.length === 0 ? (
                <div style={{ background: "rgba(255,255,255,0.72)", border: "1.5px dashed rgba(0,0,0,0.1)", borderRadius: 12, padding: "48px 24px", textAlign: "center" }}>
                  <FileSpreadsheet size={28} style={{ color: "#c8c4be", margin: "0 auto 12px" }} />
                  <p style={{ fontSize: 14, color: "#6b6860", fontWeight: 500 }}>No datasets yet</p>
                  <p style={{ fontSize: 12, color: "#9a9690", marginTop: 4 }}>Upload your first file to get started</p>
                </div>
              ) : (
                <div style={{ background: "#fff", borderRadius: 12, border: "1px solid rgba(0,0,0,0.07)", padding: "8px 8px" }}>
                  {datasets.slice(0, 4).map((ds) => {
                    const fmt = getFormatStyle(ds.original_filename);
                    return (
                      <button key={ds.id} onClick={() => handleDatasetClick(ds.id)}
                        style={{
                          display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                          background: "transparent", border: "1px solid transparent",
                          borderRadius: 9, cursor: "pointer", textAlign: "left", transition: "all 0.15s", width: "100%", marginBottom: 2,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(144,96,248,0.06)"; e.currentTarget.style.borderColor = "rgba(144,96,248,0.18)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}
                      >
                        <div style={{ width: 30, height: 30, borderRadius: 7, flexShrink: 0, background: fmt.bg, border: `1px solid ${fmt.color}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: 10, fontFamily: "ui-monospace, monospace", fontWeight: 500, color: fmt.color, textTransform: "uppercase" }}>{fmt.ext}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ds.original_filename}</p>
                          <p style={{ fontSize: 11, color: "#9a9690" }}>{ds.row_count ? `${formatRowsShort(ds.row_count)} rows · ` : ""}{timeAgo(ds.created_at)}</p>
                        </div>
                        {ds.is_starred && <Star size={12} style={{ color: "#e8a020", fill: "#e8a020", flexShrink: 0 }} />}
                        <ArrowRight size={13} style={{ color: "#c8c4be", flexShrink: 0 }} />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Mini stat tiles */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                {[
                  { icon: <Database size={13} style={{ color: "#9060f8" }} />, val: datasets.length,                 label: "Total Datasets" },
                  { icon: <TrendingUp size={13} style={{ color: "#00d4e8" }} />, val: thisWeek,                      label: "This Week" },
                  { icon: <Layers size={13} style={{ color: "#e840c8" }} />, val: formatRowsShort(totalRows),        label: "Total Rows" },
                  { icon: <Star size={13} style={{ color: "#e8a020" }} />, val: starred,                             label: "Starred" },
                ].map((s, i) => (
                  <div key={i} style={{ background: "rgba(255,255,255,0.72)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 10, padding: "13px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      {s.icon}
                      <span style={{ fontFamily: "Instrument Serif, serif", fontSize: 24, color: "#1a1a1a" }}>{s.val}</span>
                    </div>
                    <p style={{ fontSize: 11, color: "#9a9690" }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* All Datasets grid */}
          {!loading && datasets.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div>
                  <h2 className="font-display" style={{ fontFamily: "Instrument Serif, serif", fontSize: 22, color: "#1a1a1a", letterSpacing: "-0.3px", marginBottom: 2 }}>My Datasets</h2>
                  <p style={{ fontSize: 13, color: "#9a9690" }}>{datasets.length} dataset{datasets.length !== 1 ? "s" : ""} · {formatBytes(totalSize)} total</p>
                </div>
                <Link href="/datasets" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "1px solid rgba(0,0,0,0.09)", background: "rgba(255,255,255,0.72)", fontSize: 13, color: "#111010", textDecoration: "none", fontWeight: 500 }}>
                  <Folder size={13} />Manage all
                </Link>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
                {datasets.map((ds) => (
                  <DatasetCard key={ds.id} ds={ds} onClick={() => handleDatasetClick(ds.id)} />
                ))}
              </div>
            </div>
          )}

          {/* Dark aggregate insights strip */}
          {datasets.length > 0 && (
            <div style={{ background: "#141414", borderRadius: 16, padding: "26px 30px", position: "relative", overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#9060f8,#e840c8,#00d4e8)" }} />
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22 }}>
                <div>
                  <p style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: "2.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>Data Intelligence</p>
                  <h3 style={{ fontFamily: "Instrument Serif, serif", fontSize: 22, color: "#fff", letterSpacing: "-0.2px" }}>Aggregate Insights</h3>
                </div>
                <Link href="/datasets" style={{ padding: "7px 16px", borderRadius: 20, background: "linear-gradient(135deg,#9060f8,#e840c8)", fontSize: 12, color: "#fff", textDecoration: "none", fontWeight: 500 }}>
                  Open catalog →
                </Link>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 22 }}>
                {[
                  { label: "Total Rows Analyzed", val: formatRowsShort(totalRows), color: "#9060f8" },
                  { label: "Total Columns",        val: datasets.reduce((s, d) => s + (d.column_count ?? 0), 0).toString(), color: "#e840c8" },
                  { label: "Total Data Volume",    val: formatBytes(totalSize),     color: "#00d4e8" },
                  { label: "Datasets This Week",   val: thisWeek.toString(),        color: "#20c060" },
                ].map((m) => (
                  <div key={m.label} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "16px 14px" }}>
                    <div style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>{m.label}</div>
                    <span style={{ fontFamily: "Instrument Serif, serif", fontSize: 28, color: "#fff" }}>{m.val}</span>
                  </div>
                ))}
              </div>
              {fmtEntries.length > 0 && (
                <>
                  <p style={{ fontSize: 9, fontFamily: "ui-monospace, monospace", letterSpacing: "2px", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>Format Distribution</p>
                  <div style={{ height: 5, borderRadius: 3, overflow: "hidden", display: "flex", marginBottom: 10 }}>
                    {fmtEntries.map(([ext, count]) => (
                      <div key={ext} style={{ width: `${(count / datasets.length) * 100}%`, background: FORMAT_COLORS[ext]?.color || "#9060f8" }} />
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    {fmtEntries.map(([ext, count]) => {
                      const c = FORMAT_COLORS[ext]?.color || "#9060f8";
                      return (
                        <div key={ext} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
                          <span style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>{ext}</span>
                          <span style={{ fontSize: 11, fontFamily: "ui-monospace, monospace", color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
                            {count} ({Math.round((count / datasets.length) * 100)}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Getting Started widget */}
      <GettingStarted onStepClick={notify} />
    </div>
  );
}
