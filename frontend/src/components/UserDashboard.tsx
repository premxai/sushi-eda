"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Upload,
  FileSpreadsheet,
  Star,
  TrendingUp,
  Database,
  ArrowRight,
  BarChart3,
  Folder,
  Layers,
  GitBranch,
  Zap,
  AlertCircle,
  X,
  Clock,
} from "lucide-react";
import { DatasetSummary, listDatasets } from "@/lib/api";
import { useDropzone } from "react-dropzone";
import { Progress } from "@/components/ui/progress";

interface UserDashboardProps {
  onFileAccepted: (file: File) => void;
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
  onClearError: () => void;
  onLoadSample: () => void;
}

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
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
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

function statusDot(status: string) {
  const map: Record<string, { dot: string; label: string }> = {
    ready:      { dot: "#20c060", label: "Ready" },
    processing: { dot: "#e8a020", label: "Processing" },
    failed:     { dot: "#e85454", label: "Failed" },
    pending:    { dot: "#9a9690", label: "Pending" },
  };
  return map[status] || map.ready;
}

/* ─── Dataset Card (grid view) ────────────────────────────────── */
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
        borderRadius: 14,
        textAlign: "left", cursor: "pointer",
        transition: "all 0.18s ease",
        boxShadow: hov ? "0 4px 20px rgba(144,96,248,0.1)" : "none",
        position: "relative", overflow: "hidden",
        width: "100%",
      }}
    >
      {/* Top row: format badge + starred + status */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{
          padding: "5px 10px", borderRadius: 6,
          background: fmt.gradient,
          fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "0.5px",
          textTransform: "uppercase",
        }}>
          {fmt.ext}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {ds.is_starred && <Star size={13} style={{ color: "#e8a020", fill: "#e8a020" }} />}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: st.dot }} />
            <span style={{ fontSize: 10, color: "#9a9690", fontFamily: "DM Mono, monospace" }}>{st.label}</span>
          </div>
        </div>
      </div>

      {/* Filename */}
      <p style={{
        fontSize: 13, fontWeight: 500, color: "#111010",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        marginBottom: 6, flex: 1,
      }}>
        {ds.original_filename}
      </p>

      {/* Meta row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
        {ds.row_count != null && (
          <span style={{ fontSize: 11, color: "#9a9690", display: "flex", alignItems: "center", gap: 3 }}>
            <Layers size={10} style={{ opacity: 0.6 }} />
            {formatRowsShort(ds.row_count)} rows
          </span>
        )}
        {ds.column_count != null && (
          <span style={{ fontSize: 11, color: "#9a9690" }}>
            {ds.column_count} cols
          </span>
        )}
        <span style={{ fontSize: 11, color: "#9a9690" }}>{formatBytes(ds.file_size_bytes)}</span>
        <span style={{ fontSize: 11, color: "#b8b4ae", marginLeft: "auto" }}>{timeAgo(ds.created_at)}</span>
      </div>
    </button>
  );
}

/* ─── Upload Panel (left side) ──────────────────────────────── */
function UploadPanel({
  onFileAccepted,
  isUploading,
  uploadProgress,
  error,
  onClearError,
  onLoadSample,
  datasets,
  onDatasetPick,
}: UserDashboardProps & { datasets: DatasetSummary[]; onDatasetPick: (id: string) => void }) {
  const [tab, setTab] = useState<"upload" | "datasets">("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) {
        setSelectedFile(accepted[0]);
        onFileAccepted(accepted[0]);
      }
    },
    [onFileAccepted]
  );

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
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Tab switcher */}
      <div style={{
        display: "flex", marginBottom: 14,
        background: "rgba(0,0,0,0.05)", borderRadius: 10,
        padding: 3, gap: 2,
      }}>
        {(["upload", "datasets"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: "7px 0", borderRadius: 8,
              fontSize: 12.5, fontWeight: tab === t ? 600 : 400,
              background: tab === t ? "#fff" : "transparent",
              border: "none", cursor: "pointer",
              color: tab === t ? "#111010" : "#9a9690",
              boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
              transition: "all 0.15s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            {t === "upload"
              ? <><Upload size={12} />Upload File</>
              : <><Folder size={12} />My Datasets</>}
          </button>
        ))}
      </div>

      {/* Upload tab */}
      {tab === "upload" && (
        <>
          <div
            {...getRootProps()}
            style={{
              background: isDragActive
                ? "rgba(144,96,248,0.07)"
                : "rgba(255,255,255,0.72)",
              border: isDragActive
                ? "2px dashed rgba(144,96,248,0.55)"
                : "1.5px dashed rgba(0,0,0,0.13)",
              borderRadius: 16, padding: "42px 24px",
              textAlign: "center",
              cursor: isUploading ? "default" : "pointer",
              transition: "all 0.2s ease", minHeight: 190,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
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
                <p style={{ fontSize: 11, color: "#9a9690", marginTop: 8, fontFamily: "DM Mono, monospace" }}>
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
                  {[["CSV", "linear-gradient(135deg,#9060f8,#7c4ddb)"], ["XLS", "linear-gradient(135deg,#e840c8,#c836ab)"], ["JSON", "linear-gradient(135deg,#00d4e8,#00a0b8)"], ["PARQ", "linear-gradient(135deg,#e8a020,#c88010)"]].map(([l, g]) => (
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
            <button
              onClick={onLoadSample}
              style={{ display: "block", margin: "10px auto 0", fontSize: 12.5, color: "#9a9690", background: "none", border: "none", cursor: "pointer" }}
            >
              or try <span style={{ color: "#9060f8", fontWeight: 500 }}>&ldquo;Sales Data&rdquo;</span> sample
            </button>
          )}

          {error && !isUploading && (
            <button
              onClick={handleClearError}
              style={{
                display: "flex", width: "100%", marginTop: 10,
                alignItems: "center", gap: 8, borderRadius: 10,
                border: "1px solid rgba(232,84,84,0.2)",
                background: "rgba(232,84,84,0.06)",
                padding: "9px 14px", fontSize: 12, color: "#e85454", cursor: "pointer",
              }}
            >
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
                  <button
                    key={ds.id}
                    onClick={() => onDatasetPick(ds.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px", borderRadius: 9,
                      background: "transparent",
                      border: "1px solid transparent",
                      textAlign: "left", cursor: "pointer",
                      transition: "all 0.13s",
                      width: "100%",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(144,96,248,0.06)";
                      e.currentTarget.style.borderColor = "rgba(144,96,248,0.2)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.borderColor = "transparent";
                    }}
                  >
                    <div style={{
                      width: 34, height: 34, borderRadius: 7, flexShrink: 0,
                      background: fmt.bg, display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: fmt.color, textTransform: "uppercase" }}>{fmt.ext}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: "#111010", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {ds.original_filename}
                      </p>
                      <p style={{ fontSize: 11, color: "#9a9690" }}>
                        {ds.row_count ? `${formatRowsShort(ds.row_count)} rows · ` : ""}{timeAgo(ds.created_at)}
                      </p>
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

      {/* Quick action links */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
        {[
          { href: "/connectors", icon: <Database size={15} style={{ color: "#9060f8" }} />, label: "Connect DB", sub: "PostgreSQL, MySQL", grad: "rgba(144,96,248,0.1)" },
          { href: "/pipelines",  icon: <BarChart3 size={15} style={{ color: "#00d4e8" }} />, label: "Pipelines",  sub: "Automate workflows", grad: "rgba(0,212,232,0.1)" },
        ].map((a) => (
          <Link
            key={a.href} href={a.href}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "13px 14px",
              background: "rgba(255,255,255,0.72)",
              border: "1px solid rgba(0,0,0,0.07)",
              borderRadius: 12, textDecoration: "none",
              transition: "border-color 0.18s, box-shadow 0.18s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(144,96,248,0.25)";
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 2px 12px rgba(0,0,0,0.07)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(0,0,0,0.07)";
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none";
            }}
          >
            <div style={{ width: 34, height: 34, borderRadius: 8, background: a.grad, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export function UserDashboard(props: UserDashboardProps) {
  const { onFileAccepted, isUploading, uploadProgress, error, onClearError, onLoadSample } = props;
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Aggregate stats computed from dataset list
  const totalRows = datasets.reduce((s, d) => s + (d.row_count ?? 0), 0);
  const totalCols = datasets.reduce((s, d) => s + (d.column_count ?? 0), 0);
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
    <div style={{ minHeight: "100vh", background: "#f0eee9" }}>
      {/* ── Nav ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(240,238,233,0.9)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0,0,0,0.07)",
        padding: "0 48px", height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,transparent,rgba(144,96,248,0.5),rgba(232,64,200,0.5),transparent)" }} />
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#1a1a1a,#333)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <Image src="/sushi-logo.png" alt="Sushi" width={22} height={22} />
          </div>
          <span style={{ fontWeight: 600, fontSize: 17, color: "#111010", letterSpacing: "-0.3px" }}>Sushi</span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {[
            { href: "/datasets", icon: <Folder size={14} />, label: "My Datasets" },
            { href: "/connectors", icon: <Database size={14} />, label: "Connectors" },
            { href: "/compare", icon: <GitBranch size={14} />, label: "Compare" },
          ].map((n) => (
            <Link key={n.href} href={n.href} style={{ fontSize: 13, color: "#6b6860", textDecoration: "none", padding: "7px 12px", borderRadius: 7, display: "flex", alignItems: "center", gap: 6, transition: "color 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget as HTMLAnchorElement).style.color = "#111010"}
              onMouseLeave={(e) => (e.currentTarget as HTMLAnchorElement).style.color = "#6b6860"}
            >
              {n.icon}{n.label}
            </Link>
          ))}
          <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
        </div>
      </nav>

      {/* ── Main ── */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "52px 36px 96px" }}>

        {/* Greeting */}
        <h1 className="font-display" style={{ fontSize: 44, color: "#111010", marginBottom: 8, letterSpacing: "-0.5px" }}>
          {getGreeting()}, <em>{firstName}.</em>
        </h1>
        <p style={{ fontSize: 15, color: "#6b6860", marginBottom: 40, lineHeight: 1.5 }}>
          Upload a dataset or pick up where you left off — instant analysis, no setup needed.
        </p>

        {/* ── Upload + Recent (2-col) ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.05fr", gap: 32, alignItems: "start", marginBottom: 52 }}>
          {/* Left: upload panel */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
              <Zap size={14} style={{ color: "#9060f8" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#111010", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Analyze Data
              </span>
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
          </div>

          {/* Right: recent datasets list + stat tiles */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Clock size={14} style={{ color: "#9a9690" }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: "#111010", letterSpacing: "0.06em", textTransform: "uppercase" }}>Recent</span>
                {datasets.length > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#9060f8", background: "rgba(144,96,248,0.08)", padding: "2px 8px", borderRadius: 20 }}>
                    {datasets.length}
                  </span>
                )}
              </div>
              <Link href="/datasets" style={{ fontSize: 12, color: "#9060f8", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, fontWeight: 500 }}>
                View all <ArrowRight size={12} />
              </Link>
            </div>

            {loading ? (
              <div style={{ background: "rgba(255,255,255,0.72)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, padding: "52px 24px", textAlign: "center" }}>
                <div style={{ width: 20, height: 20, border: "2px solid rgba(144,96,248,0.2)", borderTopColor: "#9060f8", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
              </div>
            ) : datasets.length === 0 ? (
              <div style={{ background: "rgba(255,255,255,0.72)", border: "1.5px dashed rgba(0,0,0,0.1)", borderRadius: 14, padding: "52px 24px", textAlign: "center" }}>
                <FileSpreadsheet size={30} style={{ color: "#c8c4be", margin: "0 auto 12px" }} />
                <p style={{ fontSize: 14, color: "#6b6860", fontWeight: 500 }}>No datasets yet</p>
                <p style={{ fontSize: 12, color: "#9a9690", marginTop: 4 }}>Upload your first file to get started</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {datasets.slice(0, 5).map((ds) => {
                  const fmt = getFormatStyle(ds.original_filename);
                  return (
                    <button
                      key={ds.id}
                      onClick={() => handleDatasetClick(ds.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "11px 14px",
                        background: "rgba(255,255,255,0.72)",
                        border: "1px solid rgba(0,0,0,0.07)",
                        borderRadius: 11, cursor: "pointer",
                        textAlign: "left", transition: "all 0.15s", width: "100%",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(255,255,255,0.95)";
                        e.currentTarget.style.borderColor = "rgba(144,96,248,0.25)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(255,255,255,0.72)";
                        e.currentTarget.style.borderColor = "rgba(0,0,0,0.07)";
                      }}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, background: fmt.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: fmt.color, textTransform: "uppercase" }}>{fmt.ext}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: "#111010", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ds.original_filename}</p>
                        <p style={{ fontSize: 11, color: "#9a9690", marginTop: 1 }}>
                          {formatBytes(ds.file_size_bytes)}
                          {ds.row_count ? ` · ${formatRowsShort(ds.row_count)} rows` : ""}
                          {" · "}{timeAgo(ds.created_at)}
                        </p>
                      </div>
                      {ds.is_starred && <Star size={13} style={{ color: "#e8a020", fill: "#e8a020", flexShrink: 0 }} />}
                      <ArrowRight size={13} style={{ color: "#c8c4be", flexShrink: 0 }} />
                    </button>
                  );
                })}
              </div>
            )}

            {/* 4 mini-stat tiles */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
              {[
                { icon: <Database size={13} style={{ color: "#9060f8" }} />, val: datasets.length, label: "Total Datasets" },
                { icon: <TrendingUp size={13} style={{ color: "#00d4e8" }} />, val: thisWeek, label: "This Week" },
                { icon: <Layers size={13} style={{ color: "#e840c8" }} />, val: formatRowsShort(totalRows), label: "Total Rows" },
                { icon: <Star size={13} style={{ color: "#e8a020" }} />, val: starred, label: "Starred" },
              ].map((s, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,0.72)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 11, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    {s.icon}
                    <span className="font-display" style={{ fontSize: 22, color: "#111010" }}>{s.val}</span>
                  </div>
                  <p style={{ fontSize: 11, color: "#9a9690" }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── All Datasets grid ── */}
        {!loading && datasets.length > 0 && (
          <div style={{ marginBottom: 52 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h2 className="font-display" style={{ fontSize: 22, color: "#111010", letterSpacing: "-0.3px", marginBottom: 2 }}>My Datasets</h2>
                <p style={{ fontSize: 13, color: "#9a9690" }}>{datasets.length} dataset{datasets.length !== 1 ? "s" : ""} · {formatBytes(totalSize)} total</p>
              </div>
              <Link href="/datasets" style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, border: "1px solid rgba(0,0,0,0.09)", background: "rgba(255,255,255,0.72)", fontSize: 13, color: "#111010", textDecoration: "none", fontWeight: 500 }}>
                <Folder size={14} />Manage all
              </Link>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              {datasets.map((ds) => (
                <DatasetCard key={ds.id} ds={ds} onClick={() => handleDatasetClick(ds.id)} />
              ))}
            </div>
          </div>
        )}

        {/* ── Tech Insights strip (dark card) ── */}
        {datasets.length > 0 && (
          <div style={{
            background: "#141414", borderRadius: 18, padding: "28px 32px",
            position: "relative", overflow: "hidden",
            boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
          }}>
            {/* accent line */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,#9060f8,#e840c8,#00d4e8)" }} />

            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
              <div>
                <p style={{ fontSize: 9, fontFamily: "DM Mono, monospace", letterSpacing: "2.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>
                  Data Intelligence
                </p>
                <h3 className="font-display" style={{ fontSize: 22, color: "#fff", letterSpacing: "-0.2px" }}>Aggregate Insights</h3>
              </div>
              <Link href="/datasets" style={{ padding: "7px 16px", borderRadius: 20, background: "linear-gradient(135deg,#9060f8,#e840c8)", fontSize: 12, color: "#fff", textDecoration: "none", fontWeight: 500, flexShrink: 0 }}>
                Open catalog →
              </Link>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
              {[
                { label: "Total Rows Analyzed", val: formatRowsShort(totalRows), icon: "≡", color: "#9060f8" },
                { label: "Total Columns",        val: totalCols.toString(),        icon: "⊞", color: "#e840c8" },
                { label: "Total Data Volume",    val: formatBytes(totalSize),      icon: "◈", color: "#00d4e8" },
                { label: "Datasets This Week",   val: thisWeek.toString(),         icon: "↑", color: "#20c060" },
              ].map((m) => (
                <div key={m.label} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "18px 16px" }}>
                  <div style={{ fontSize: 9, fontFamily: "DM Mono, monospace", letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 10 }}>
                    {m.label}
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontFamily: "Instrument Serif, serif", fontSize: 30, color: "#fff" }}>{m.val}</span>
                    <span style={{ fontSize: 14, color: m.color }}>{m.icon}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Format distribution */}
            {fmtEntries.length > 0 && (
              <div>
                <p style={{ fontSize: 9, fontFamily: "DM Mono, monospace", letterSpacing: "2px", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>
                  Format Distribution
                </p>
                {/* Bar */}
                <div style={{ height: 6, borderRadius: 3, overflow: "hidden", display: "flex", marginBottom: 12 }}>
                  {fmtEntries.map(([ext, count]) => {
                    const pct = (count / datasets.length) * 100;
                    const c = FORMAT_COLORS[ext]?.color || "#9060f8";
                    return <div key={ext} style={{ width: `${pct}%`, background: c, transition: "width 0.5s" }} />;
                  })}
                </div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {fmtEntries.map(([ext, count]) => {
                    const c = FORMAT_COLORS[ext]?.color || "#9060f8";
                    const pct = Math.round((count / datasets.length) * 100);
                    return (
                      <div key={ext} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />
                        <span style={{ fontSize: 11, fontFamily: "DM Mono, monospace", color: "rgba(255,255,255,0.45)", textTransform: "uppercase" }}>
                          {ext}
                        </span>
                        <span style={{ fontSize: 11, fontFamily: "DM Mono, monospace", color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
                          {count} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
