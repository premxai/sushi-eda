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
  Clock,
  Star,
  TrendingUp,
  Database,
  ArrowRight,
  BarChart3,
  Folder,
} from "lucide-react";
import { DatasetSummary, listDatasets } from "@/lib/api";
import { useDropzone } from "react-dropzone";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, X } from "lucide-react";

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

export function UserDashboard({
  onFileAccepted,
  isUploading,
  uploadProgress,
  error,
  onClearError,
  onLoadSample,
}: UserDashboardProps) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [recentDatasets, setRecentDatasets] = useState<DatasetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const loadDatasets = useCallback(async () => {
    setLoading(true);
    try {
      const all = await listDatasets("default", { archived: false });
      setRecentDatasets(all.slice(0, 6));
      setTotalCount(all.length);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoaded && user) loadDatasets();
  }, [isLoaded, user, loadDatasets]);

  const firstName = user?.firstName || user?.username || "there";

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        setSelectedFile(file);
        onFileAccepted(file);
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

  const handleDatasetClick = (id: string) => {
    router.push(`/datasets/${id}`);
  };

  const handleClearError = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    onClearError();
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f0eee9" }}>
      {/* ── Nav ── */}
      <nav style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "rgba(240,238,233,0.88)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0,0,0,0.07)",
        padding: "0 48px",
        height: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        {/* Gradient line */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: "linear-gradient(90deg, transparent, rgba(144,96,248,0.5), rgba(232,64,200,0.5), transparent)",
        }} />

        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: "linear-gradient(135deg, #1a1a1a 0%, #333 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden",
          }}>
            <Image src="/sushi-logo.png" alt="Sushi" width={22} height={22} />
          </div>
          <span style={{ fontWeight: 600, fontSize: 17, color: "#111010", letterSpacing: "-0.3px" }}>Sushi</span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/datasets" style={{
            fontSize: 13, color: "#6b6860", textDecoration: "none",
            padding: "7px 14px", borderRadius: 7,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <Folder size={14} />
            My Datasets
          </Link>
          <Link href="/connectors" style={{
            fontSize: 13, color: "#6b6860", textDecoration: "none",
            padding: "7px 14px", borderRadius: 7,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <Database size={14} />
            Connectors
          </Link>
          <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
        </div>
      </nav>

      {/* ── Main ── */}
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "48px 32px" }}>
        {/* Greeting */}
        <h1 className="font-display" style={{ fontSize: 42, color: "#111010", marginBottom: 6, letterSpacing: "-0.5px" }}>
          {getGreeting()}, <em>{firstName}</em>.
        </h1>
        <p style={{ fontSize: 15, color: "#6b6860", marginBottom: 40, lineHeight: 1.5 }}>
          Upload a dataset to get instant AI-powered insights, or pick up where you left off.
        </p>

        {/* ── Two-column layout ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "start" }}>

          {/* Left: Upload */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Upload size={16} style={{ color: "#9060f8" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#111010", letterSpacing: "0.02em", textTransform: "uppercase" }}>
                Upload New
              </span>
            </div>

            {/* Drop zone */}
            <div
              {...getRootProps()}
              style={{
                background: isDragActive
                  ? "rgba(144,96,248,0.06)"
                  : "rgba(255,255,255,0.72)",
                border: isDragActive
                  ? "2px dashed rgba(144,96,248,0.5)"
                  : "1.5px dashed rgba(0,0,0,0.12)",
                borderRadius: 16,
                padding: "40px 24px",
                textAlign: "center",
                cursor: isUploading ? "default" : "pointer",
                transition: "all 0.2s ease",
                minHeight: 180,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <input {...getInputProps()} />

              {isUploading && selectedFile ? (
                <div style={{ width: "100%", maxWidth: 340 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}>
                    <FileSpreadsheet size={16} style={{ color: "#9060f8" }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#111010" }}>{selectedFile.name}</span>
                    <span style={{ fontSize: 11, color: "#9a9690" }}>{formatBytes(selectedFile.size)}</span>
                  </div>
                  <Progress value={uploadProgress} className="h-[6px]" />
                  <p style={{ fontSize: 12, color: "#9a9690", marginTop: 8 }}>
                    {uploadProgress === 0 ? "Connecting…" : uploadProgress < 50 ? `Uploading… ${uploadProgress}%` : uploadProgress < 90 ? "Analyzing…" : "Almost done…"}
                  </p>
                </div>
              ) : error ? (
                <div style={{ textAlign: "center" }}>
                  <AlertCircle size={28} style={{ color: "#e85454", margin: "0 auto 8px" }} />
                  <p style={{ fontSize: 14, fontWeight: 500, color: "#e85454" }}>Upload failed</p>
                  <p style={{ fontSize: 12, color: "#9a9690", marginTop: 4, maxWidth: 300, margin: "4px auto 0" }}>{error}</p>
                  <button
                    onClick={handleClearError}
                    style={{ fontSize: 12, color: "#9060f8", background: "none", border: "none", cursor: "pointer", marginTop: 10, fontWeight: 500 }}
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                    <span style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg, #9060f8, #7c4ddb)" }}>CSV</span>
                    <span style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg, #e840c8, #c836ab)" }}>XLS</span>
                    <span style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg, #00d4e8, #00b8cc)" }}>JSON</span>
                  </div>
                  <p style={{ fontSize: 14, color: "#111010", fontWeight: 400 }}>
                    Drop files or <span style={{ color: "#9060f8", fontWeight: 600, cursor: "pointer" }}>browse</span>
                  </p>
                  <p style={{ fontSize: 12, color: "#9a9690", marginTop: 4 }}>CSV, JSON, Excel, Parquet — up to 100 MB</p>
                </>
              )}
            </div>

            {/* Sample link */}
            {!isUploading && !selectedFile && (
              <button
                onClick={onLoadSample}
                style={{
                  display: "block",
                  margin: "12px auto 0",
                  fontSize: 12.5, color: "#9a9690",
                  background: "none", border: "none", cursor: "pointer",
                }}
              >
                or try with our sample <span style={{ color: "#9060f8", fontWeight: 500 }}>&quot;Sales Data&quot;</span> dataset
              </button>
            )}

            {/* Error banner */}
            {error && !isUploading && (
              <button
                onClick={handleClearError}
                style={{
                  display: "flex", width: "100%", marginTop: 12,
                  alignItems: "center", gap: 8,
                  borderRadius: 12,
                  border: "1px solid rgba(232,84,84,0.2)",
                  background: "rgba(232,84,84,0.06)",
                  padding: "10px 14px",
                  textAlign: "left", fontSize: 12, color: "#e85454",
                  cursor: "pointer",
                }}
              >
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{error}</span>
                <X size={14} style={{ flexShrink: 0 }} />
              </button>
            )}

            {/* Quick actions */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 24 }}>
              <Link href="/connectors" style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "14px 16px",
                background: "rgba(255,255,255,0.72)",
                border: "1px solid rgba(0,0,0,0.07)",
                borderRadius: 12,
                textDecoration: "none",
                transition: "border-color 0.2s",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: "linear-gradient(135deg, rgba(144,96,248,0.1), rgba(232,64,200,0.1))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Database size={16} style={{ color: "#9060f8" }} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "#111010" }}>Connect DB</p>
                  <p style={{ fontSize: 11, color: "#9a9690" }}>PostgreSQL, MySQL</p>
                </div>
              </Link>
              <Link href="/pipelines" style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "14px 16px",
                background: "rgba(255,255,255,0.72)",
                border: "1px solid rgba(0,0,0,0.07)",
                borderRadius: 12,
                textDecoration: "none",
                transition: "border-color 0.2s",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: "linear-gradient(135deg, rgba(0,212,232,0.1), rgba(0,232,160,0.1))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <BarChart3 size={16} style={{ color: "#00d4e8" }} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "#111010" }}>Pipelines</p>
                  <p style={{ fontSize: 11, color: "#9a9690" }}>Automate workflows</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Right: Recent Datasets */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Clock size={16} style={{ color: "#9a9690" }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#111010", letterSpacing: "0.02em", textTransform: "uppercase" }}>
                  Recent
                </span>
                {totalCount > 0 && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: "#9060f8",
                    background: "rgba(144,96,248,0.08)",
                    padding: "2px 8px", borderRadius: 20,
                  }}>
                    {totalCount}
                  </span>
                )}
              </div>
              <Link href="/datasets" style={{
                fontSize: 12, color: "#9060f8", textDecoration: "none",
                display: "flex", alignItems: "center", gap: 4, fontWeight: 500,
              }}>
                View all <ArrowRight size={12} />
              </Link>
            </div>

            {loading ? (
              <div style={{
                background: "rgba(255,255,255,0.72)",
                border: "1px solid rgba(0,0,0,0.07)",
                borderRadius: 14,
                padding: "48px 24px",
                textAlign: "center",
              }}>
                <div style={{
                  width: 20, height: 20,
                  border: "2px solid rgba(144,96,248,0.2)",
                  borderTopColor: "#9060f8",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                  margin: "0 auto",
                }} />
              </div>
            ) : recentDatasets.length === 0 ? (
              <div style={{
                background: "rgba(255,255,255,0.72)",
                border: "1.5px dashed rgba(0,0,0,0.1)",
                borderRadius: 14,
                padding: "48px 24px",
                textAlign: "center",
              }}>
                <FileSpreadsheet size={32} style={{ color: "#c8c4be", margin: "0 auto 12px" }} />
                <p style={{ fontSize: 14, color: "#6b6860", fontWeight: 500 }}>No datasets yet</p>
                <p style={{ fontSize: 12, color: "#9a9690", marginTop: 4 }}>Upload your first file to get started</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {recentDatasets.map((dataset) => {
                  const ext = dataset.original_filename.split(".").pop()?.toLowerCase() || "csv";
                  const extColors: Record<string, string> = {
                    csv: "#9060f8", xlsx: "#4080ff", xls: "#4080ff",
                    json: "#e8a020", parquet: "#e840c8", tsv: "#00d4e8",
                  };
                  const color = extColors[ext] || "#9060f8";
                  return (
                    <button
                      key={dataset.id}
                      onClick={() => handleDatasetClick(dataset.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "12px 16px",
                        background: "rgba(255,255,255,0.72)",
                        border: "1px solid rgba(0,0,0,0.07)",
                        borderRadius: 12,
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s ease",
                        width: "100%",
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
                      <div style={{
                        width: 38, height: 38, borderRadius: 8, flexShrink: 0,
                        background: `${color}10`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase" }}>{ext}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 500, color: "#111010", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {dataset.original_filename}
                        </p>
                        <p style={{ fontSize: 11, color: "#9a9690", marginTop: 2 }}>
                          {formatBytes(dataset.file_size_bytes)} &middot; {timeAgo(dataset.created_at)}
                          {dataset.row_count && ` \u00b7 ${dataset.row_count.toLocaleString()} rows`}
                        </p>
                      </div>
                      {dataset.is_starred && <Star size={14} style={{ color: "#e8a020", flexShrink: 0 }} />}
                      <ArrowRight size={14} style={{ color: "#c8c4be", flexShrink: 0 }} />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 20 }}>
              <div style={{
                background: "rgba(255,255,255,0.72)",
                border: "1px solid rgba(0,0,0,0.07)",
                borderRadius: 12,
                padding: "16px 18px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Database size={14} style={{ color: "#9060f8" }} />
                  <span style={{ fontSize: 22, fontWeight: 600, color: "#111010" }}>{totalCount}</span>
                </div>
                <p style={{ fontSize: 11, color: "#9a9690", marginTop: 2 }}>Total Datasets</p>
              </div>
              <div style={{
                background: "rgba(255,255,255,0.72)",
                border: "1px solid rgba(0,0,0,0.07)",
                borderRadius: 12,
                padding: "16px 18px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <TrendingUp size={14} style={{ color: "#00d4e8" }} />
                  <span style={{ fontSize: 22, fontWeight: 600, color: "#111010" }}>
                    {recentDatasets.filter(d => {
                      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
                      return new Date(d.created_at).getTime() > weekAgo;
                    }).length}
                  </span>
                </div>
                <p style={{ fontSize: 11, color: "#9a9690", marginTop: 2 }}>This Week</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
