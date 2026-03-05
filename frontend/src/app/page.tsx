"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useJobStream } from "@/hooks/useJobStream";
import { Button } from "@/components/ui/button";
import { Sidebar, NavSection } from "@/components/dashboard/Sidebar";
import { OverviewSection } from "@/components/dashboard/OverviewSection";
import { ColumnCard } from "@/components/dashboard/ColumnCard";
import { CorrelationSection } from "@/components/dashboard/CorrelationSection";
import { OutliersSection } from "@/components/dashboard/OutliersSection";
import { InsightsSection } from "@/components/dashboard/InsightsSection";
import { VisualizationsSection } from "@/components/dashboard/VisualizationsSection";
import { StatisticsSection } from "@/components/dashboard/StatisticsSection";
import { MonitoringSection } from "@/components/dashboard/MonitoringSection";
import { ReportSection } from "@/components/dashboard/ReportSection";
import { CleaningSection } from "@/components/dashboard/CleaningSection";
import { TransformSection } from "@/components/dashboard/TransformSection";
import { DataTable } from "@/components/dashboard/DataTable";
import { SQLQuerySection } from "@/components/dashboard/SQLQuerySection";
import { ExportButton } from "@/components/ExportButton";
import { DashboardSkeleton } from "@/components/LoadingSkeleton";
import { uploadFile, uploadFileAsync, loadSampleData, fetchVisualizations, fetchDatasetVisualizations, prewarmBackend, archiveDataset, fetchAnalysis, fetchDatasetAnalysis, listDatasets, DatasetSummary } from "@/lib/api";
import { EDAReport } from "@/lib/types";
import { GitCompare, Lock, Star, ArrowRight, FileSpreadsheet } from "lucide-react";
import { useDropzone } from "react-dropzone";
import Link from "next/link";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { CommandPalette } from "@/components/CommandPalette";
import { ColumnSearch } from "@/components/ColumnSearch";
import { LandingPage } from "@/components/LandingPage";
import { UserDashboard } from "@/components/UserDashboard";


const REPORT_KEY = "eda_report";
const FILE_KEY = "eda_filename";
const DATASET_KEY = "eda_dataset_id";

function LockedPreview({ feature }: { feature: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-2xl"
      style={{
        minHeight: 360,
        background: "rgba(240,238,233,0.6)",
        border: "1px dashed rgba(0,0,0,0.12)",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 56, height: 56, borderRadius: 16,
          background: "linear-gradient(135deg, rgba(144,96,248,0.15), rgba(232,64,200,0.15))",
          border: "1px solid rgba(144,96,248,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <Lock style={{ width: 24, height: 24, color: "#9060f8" }} />
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 17, fontWeight: 600, color: "#111010", marginBottom: 6 }}>
          {feature} requires an account
        </p>
        <p style={{ fontSize: 13, color: "#6b6860", maxWidth: 320 }}>
          Sign up for free to unlock {feature}, AI chat, SQL query, and more.
        </p>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <Link
          href="/sign-up"
          style={{
            padding: "9px 22px", borderRadius: 9, fontSize: 13.5, fontWeight: 500,
            background: "linear-gradient(135deg, #9060f8, #e840c8)",
            color: "#fff", textDecoration: "none",
            boxShadow: "0 2px 12px rgba(144,96,248,0.35)",
          }}
        >
          Get started free →
        </Link>
        <Link
          href="/sign-in"
          style={{
            padding: "9px 22px", borderRadius: 9, fontSize: 13.5,
            border: "1px solid rgba(0,0,0,0.12)", color: "#6b6860", textDecoration: "none",
          }}
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}

const FILE_EXTS: Record<string, { bg: string; color: string }> = {
  csv:     { bg: "rgba(144,96,248,0.12)", color: "#7a40e8" },
  xlsx:    { bg: "rgba(64,128,255,0.12)", color: "#3060e0" },
  xls:     { bg: "rgba(64,128,255,0.12)", color: "#3060e0" },
  json:    { bg: "rgba(232,160,32,0.12)", color: "#c88010" },
  parquet: { bg: "rgba(232,64,200,0.12)", color: "#c030a8" },
  tsv:     { bg: "rgba(0,212,232,0.12)",  color: "#00a0b8" },
  sqlite:  { bg: "rgba(32,192,96,0.12)",  color: "#189050" },
  db:      { bg: "rgba(32,192,96,0.12)",  color: "#189050" },
};

function NewFileModal({
  onClose, onFileAccepted, onDatasetPick, isUploading,
}: {
  onClose: () => void;
  onFileAccepted: (file: File) => void;
  onDatasetPick: (id: string, filename: string) => void;
  isUploading: boolean;
}) {
  const [tab, setTab] = React.useState<"upload" | "datasets">("upload");
  const [datasets, setDatasets] = React.useState<DatasetSummary[]>([]);
  const [dsLoading, setDsLoading] = React.useState(false);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => {
      if (accepted.length > 0) { onFileAccepted(accepted[0]); onClose(); }
    },
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

  React.useEffect(() => {
    if (tab === "datasets") {
      setDsLoading(true);
      listDatasets("default", { archived: false })
        .then(setDatasets)
        .catch(() => {})
        .finally(() => setDsLoading(false));
    }
  }, [tab]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div style={{
        position: "relative", zIndex: 1, width: 480, maxWidth: "calc(100vw - 48px)",
        background: "#fff", borderRadius: 18, border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.22)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "18px 20px 14px", borderBottom: "1px solid rgba(0,0,0,0.07)" }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#111010", margin: 0 }}>New File</h3>
            <p style={{ fontSize: 12, color: "#9a9690", marginTop: 2 }}>Upload a file or open an existing dataset</p>
          </div>
          <button onClick={onClose} style={{ background: "rgba(0,0,0,0.05)", border: "none", cursor: "pointer", width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#6b6860", flexShrink: 0 }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", padding: "10px 20px 0", gap: 2, background: "#f9f8f6", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          {(["upload", "datasets"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "8px 16px", borderRadius: "8px 8px 0 0", fontSize: 13,
              fontWeight: tab === t ? 600 : 400,
              background: tab === t ? "#fff" : "transparent",
              border: tab === t ? "1px solid rgba(0,0,0,0.07)" : "none",
              borderBottom: tab === t ? "1px solid #fff" : "none",
              color: tab === t ? "#111010" : "#9a9690",
              cursor: "pointer", position: "relative", top: "1px",
            }}>
              {t === "upload" ? "Upload File" : "My Datasets"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: 20 }}>
          {tab === "upload" && (
            <div {...getRootProps()} style={{
              background: isDragActive ? "rgba(144,96,248,0.07)" : "#f9f8f6",
              border: isDragActive ? "2px dashed rgba(144,96,248,0.55)" : "1.5px dashed rgba(0,0,0,0.13)",
              borderRadius: 14, padding: "40px 24px",
              textAlign: "center", cursor: "pointer",
              transition: "all 0.2s ease",
              display: "flex", flexDirection: "column", alignItems: "center",
            }}>
              <input {...getInputProps()} />
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                {[["CSV","#9060f8"],["XLS","#4080ff"],["JSON","#e8a020"],["PARQ","#e840c8"]].map(([l, c]) => (
                  <span key={l} style={{ padding: "4px 9px", borderRadius: 6, fontSize: 10, fontWeight: 700, color: "#fff", background: c }}>{l}</span>
                ))}
              </div>
              <p style={{ fontSize: 14, color: "#111010" }}>Drop files or <span style={{ color: "#9060f8", fontWeight: 600 }}>browse</span></p>
              <p style={{ fontSize: 12, color: "#9a9690", marginTop: 4 }}>CSV, JSON, Excel, Parquet, SQLite — up to 100 MB</p>
            </div>
          )}

          {tab === "datasets" && (
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {dsLoading ? (
                <div style={{ padding: "48px 0", textAlign: "center" }}>
                  <div style={{ width: 20, height: 20, border: "2px solid rgba(144,96,248,0.2)", borderTopColor: "#9060f8", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
                </div>
              ) : datasets.length === 0 ? (
                <div style={{ padding: "48px 24px", textAlign: "center" }}>
                  <FileSpreadsheet style={{ width: 28, height: 28, color: "#c8c4be", margin: "0 auto 10px" }} />
                  <p style={{ fontSize: 13, color: "#9a9690" }}>No datasets yet — upload your first file</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  {datasets.map((ds) => {
                    const ext = ds.original_filename.split(".").pop()?.toLowerCase() || "csv";
                    const s = FILE_EXTS[ext] || FILE_EXTS.csv;
                    return (
                      <button key={ds.id}
                        onClick={() => { onDatasetPick(ds.id, ds.original_filename); onClose(); }}
                        style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: "transparent", border: "1px solid transparent", textAlign: "left", cursor: "pointer", transition: "all 0.13s", width: "100%" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(144,96,248,0.05)"; e.currentTarget.style.borderColor = "rgba(144,96,248,0.18)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: s.color, textTransform: "uppercase" }}>{ext}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 500, color: "#111010", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ds.original_filename}</p>
                          <p style={{ fontSize: 11, color: "#9a9690" }}>
                            {ds.row_count != null ? `${ds.row_count.toLocaleString()} rows · ` : ""}
                            {new Date(ds.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        {ds.is_starred && <Star style={{ width: 12, height: 12, color: "#e8a020", fill: "#e8a020", flexShrink: 0 }} />}
                        <ArrowRight style={{ width: 13, height: 13, color: "#c8c4be", flexShrink: 0 }} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { isSignedIn, isLoaded: userLoaded } = useUser();
  const [report, setReport] = useState<EDAReport | null>(null);
  const [fileName, setFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<NavSection>("overview");
  const [columnSearchTerm, setColumnSearchTerm] = useState("");
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [openDatasetId, setOpenDatasetId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [visualizations, setVisualizations] = useState<Record<string, any> | null>(null);
  const [vizLoading, setVizLoading] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [dashboardKey, setDashboardKey] = useState(0);

  // Pre-warm backend on page load to reduce cold-start delay on first upload
  useEffect(() => { prewarmBackend(); }, []);

  useEffect(() => {
    const stored = sessionStorage.getItem(REPORT_KEY);
    if (!stored) return;
    try {
      setReport(JSON.parse(stored));
      const storedFileName = sessionStorage.getItem(FILE_KEY);
      const storedDatasetId = sessionStorage.getItem(DATASET_KEY);
      if (storedFileName) setFileName(storedFileName);
      // Fall back to "local" so API sections show a helpful message instead of "No dataset loaded"
      setOpenDatasetId(storedDatasetId || "local");
    } catch {
      sessionStorage.removeItem(REPORT_KEY);
      sessionStorage.removeItem(FILE_KEY);
      sessionStorage.removeItem(DATASET_KEY);
    }
  }, []);

  useEffect(() => {
    if (!report) return;
    sessionStorage.setItem(REPORT_KEY, JSON.stringify(report));
    sessionStorage.setItem(FILE_KEY, fileName || "dataset");
    if (openDatasetId) {
      sessionStorage.setItem(DATASET_KEY, openDatasetId);
    } else {
      sessionStorage.removeItem(DATASET_KEY);
    }
  }, [report, fileName, openDatasetId]);

  // Real-time job stream — activates when datasetId is set after async upload
  const jobStream = useJobStream(datasetId);

  // When the async job finishes, fetch the full report
  useEffect(() => {
    if (jobStream.status === "done" && jobStream.analysisId && datasetId) {
      fetchAnalysis(jobStream.analysisId)
        .then((data) => {
          const nextReport = data.report ?? (data as unknown as EDAReport);
          setReport(nextReport);
          setOpenDatasetId(datasetId);
          sessionStorage.setItem(REPORT_KEY, JSON.stringify(nextReport));
          sessionStorage.setItem(FILE_KEY, fileName || "dataset");
          sessionStorage.setItem(DATASET_KEY, datasetId);
          setUploadProgress(100);
          setIsUploading(false);
          setDatasetId(null);
        })
        .catch(() => {
          setError("Analysis complete but failed to load results. Please refresh.");
          setIsUploading(false);
          setDatasetId(null);
        });
    }
    if (jobStream.status === "failed") {
      setError(jobStream.error ?? "Analysis failed");
      setIsUploading(false);
      setUploadProgress(0);
      setDatasetId(null);
    }
    if (jobStream.status === "processing") {
      setUploadProgress(jobStream.progress);
    }
  }, [jobStream.status, jobStream.analysisId, jobStream.error, jobStream.progress, datasetId, fileName]);

  const handleFileAccepted = useCallback(async (file: File) => {
    setReport(null);
    setShowFileModal(false);
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);
    setFileName(file.name);
    setDatasetId(null);
    setOpenDatasetId(null);
    sessionStorage.removeItem(REPORT_KEY);
    sessionStorage.removeItem(FILE_KEY);
    sessionStorage.removeItem(DATASET_KEY);

    try {
      // Try async (Celery-backed) upload first; fall back to legacy sync
      const asyncResult = await uploadFileAsync(file, "default", setUploadProgress).catch(() => null);
      if (asyncResult?.dataset_id) {
        // Async path: SSE hook drives progress from here
        setDatasetId(asyncResult.dataset_id);
        setOpenDatasetId(asyncResult.dataset_id);
        sessionStorage.setItem(DATASET_KEY, asyncResult.dataset_id);
        sessionStorage.setItem(FILE_KEY, file.name);
        setUploadProgress(10);
        return;
      }

      // Legacy sync path (dev / no-Celery env)
      const interval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) { clearInterval(interval); return 90; }
          return prev + Math.random() * 15;
        });
      }, 300);

      try {
        const data = await uploadFile(file);
        clearInterval(interval);
        setUploadProgress(100);
        await new Promise((r) => setTimeout(r, 200));
        setReport(data);
        setOpenDatasetId("local");
        sessionStorage.setItem(REPORT_KEY, JSON.stringify(data));
        sessionStorage.setItem(FILE_KEY, file.name);
        sessionStorage.setItem(DATASET_KEY, "local");
      } catch (err: unknown) {
          clearInterval(interval);
          setUploadProgress(0);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const detail = (err as any)?.response?.data?.detail;
          const message = detail || (err instanceof Error ? err.message : "Failed to analyze file. Check that the backend is running.");
          setError(message);
        } finally {
          setIsUploading(false);
        }
    } catch (err: unknown) {
      setUploadProgress(0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detail = (err as any)?.response?.data?.detail;
      setError(detail || (err instanceof Error ? err.message : "Upload failed"));
      setIsUploading(false);
    }
  }, []);

  const handleClearError = () => setError(null);

  const handleTryDemo = useCallback(async () => {
    setIsDemoLoading(true);
    try {
      const file = await loadSampleData();
      await handleFileAccepted(file);
    } finally {
      setIsDemoLoading(false);
    }
  }, [handleFileAccepted]);

  const handleReportUpdate = useCallback((newReport: EDAReport, newPreview: Record<string, unknown>[]) => {
    setReport({ ...newReport, preview: newPreview });
    setVisualizations(null);
  }, []);

  const handleSectionChange = useCallback(async (section: NavSection) => {
    setActiveSection(section);
    if (section === "visualizations" && !visualizations && !vizLoading) {
      setVizLoading(true);
      try {
        // Use dataset-specific endpoint for stored datasets; fall back to in-memory
        const data = openDatasetId && openDatasetId !== "local"
          ? await fetchDatasetVisualizations(openDatasetId, "default")
          : await fetchVisualizations();
        setVisualizations(data);
      } catch {
        // silently fail
      } finally {
        setVizLoading(false);
      }
    }
  }, [visualizations, vizLoading, openDatasetId]);

  const handleOpenDataset = useCallback(async (id: string, filename = "dataset") => {
    setIsUploading(true);
    setUploadProgress(50);
    setError(null);
    try {
      const result = await fetchDatasetAnalysis(id, "default");
      setReport(result.report);
      setFileName(filename);
      setOpenDatasetId(id);
      setVisualizations(null); // reset so visualizations reload for the new dataset
      setShowFileModal(false);
      setUploadProgress(100);
      sessionStorage.setItem(REPORT_KEY, JSON.stringify(result.report));
      sessionStorage.setItem(FILE_KEY, filename);
      sessionStorage.setItem(DATASET_KEY, id);
    } catch {
      setError("Failed to load dataset");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, []);

  const handleNewFile = () => {
    setReport(null);
    setFileName("");
    setError(null);
    setUploadProgress(0);
    setIsUploading(false);
    setDatasetId(null);       // stop any in-flight SSE job stream
    setActiveSection("overview");
    setVisualizations(null);
    setOpenDatasetId(null);
    setShowFileModal(false);
    setDashboardKey((k) => k + 1);
    sessionStorage.removeItem(REPORT_KEY);
    sessionStorage.removeItem(FILE_KEY);
    sessionStorage.removeItem(DATASET_KEY);
  };

  const handleArchive = async () => {
    if (!openDatasetId || openDatasetId === "local") return;
    await archiveDataset(openDatasetId);
    sessionStorage.removeItem(REPORT_KEY);
    sessionStorage.removeItem(FILE_KEY);
    sessionStorage.removeItem(DATASET_KEY);
    handleNewFile();
  };

  // ─── Dashboard View — sidebar navigation ─────────────────────────
  if (report) {
    const { basic_info } = report;
    const isPreviewMode = !isSignedIn;
    const sectionTitles: Record<NavSection, string> = {
      overview: "Overview", columns: "Column Analysis", statistics: "Statistical Analysis",
      correlations: "Correlations", outliers: "Outlier Detection", insights: "Insights",
      visualizations: "Visualizations", cleaning: "Data Cleaning", transforms: "Feature Engineering",
      sql: "SQL Editor", monitors: "Monitors", comments: "Comments", report: "Report", data: "Data Table",
    };

    return (
      <>
      <div className="flex h-screen" style={{ background: "#f0eee9", display: "flex", flexDirection: "row", height: "100vh", overflow: "hidden" }}>
        <Sidebar
          fileName={fileName}
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          onNewFile={handleNewFile}
          onNewFileRequest={() => setShowFileModal(true)}
          onDatasetPick={handleOpenDataset}
          datasetId={openDatasetId}
          onArchive={handleArchive}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <header style={{
            position: "relative", display: "flex", flexShrink: 0,
            alignItems: "center", justifyContent: "space-between",
            padding: "14px 32px",
            background: "rgba(240,238,233,0.88)",
            backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(0,0,0,0.07)",
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(144,96,248,0.5), rgba(232,64,200,0.5), transparent)" }} />
            <div>
              <h1 className="font-display" style={{ fontSize: 22, color: "#111010", letterSpacing: "-0.3px" }}>{sectionTitles[activeSection]}</h1>
              <p style={{ fontSize: 12, color: "#9a9690", marginTop: 2 }}>
                {fileName} · {basic_info.rows.toLocaleString()} rows · {basic_info.columns} columns
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/compare">
                <Button variant="outline" size="sm" className="gap-2 text-xs">
                  <GitCompare className="h-3.5 w-3.5" />Compare
                </Button>
              </Link>
              <ExportButton report={report} fileName={fileName} />
            </div>
          </header>

          {/* Preview mode banner */}
          {isPreviewMode && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "9px 32px", gap: 12, flexShrink: 0,
              background: "linear-gradient(90deg, rgba(144,96,248,0.07), rgba(232,64,200,0.07))",
              borderBottom: "1px solid rgba(144,96,248,0.13)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Lock style={{ width: 13, height: 13, color: "#9060f8" }} />
                <span style={{ fontSize: 12.5, color: "#6b6860" }}>
                  <strong style={{ color: "#111010" }}>Preview mode</strong> — Statistics, SQL, Cleaning &amp; Monitoring require an account.
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <Link href="/sign-up" style={{ padding: "5px 14px", borderRadius: 7, fontSize: 12.5, fontWeight: 500, background: "linear-gradient(135deg, #9060f8, #e840c8)", color: "#fff", textDecoration: "none" }}>Get started free</Link>
                <Link href="/sign-in" style={{ padding: "5px 12px", borderRadius: 7, fontSize: 12.5, border: "1px solid rgba(0,0,0,0.12)", color: "#6b6860", textDecoration: "none" }}>Sign in</Link>
              </div>
            </div>
          )}

          <main className="flex-1 overflow-y-auto p-6">
            <ErrorBoundary>
              {isUploading && activeSection === "overview" && <DashboardSkeleton />}
              {!isUploading && activeSection === "overview" && <OverviewSection info={report.basic_info} qualityScore={report.quality_score} />}
              {activeSection === "columns" && (
                <>
                  <ColumnSearch
                    onSearchChange={setColumnSearchTerm}
                    resultCount={report.column_analysis.filter(c => c.name.toLowerCase().includes(columnSearchTerm.toLowerCase())).length}
                  />
                  <div className="space-y-2 mt-4">
                    {report.column_analysis
                      .filter(col => col.name.toLowerCase().includes(columnSearchTerm.toLowerCase()))
                      .map((col) => (
                        <ColumnCard key={col.name} column={col} preview={report.preview} totalRows={basic_info.rows} />
                      ))}
                  </div>
                </>
              )}
              {activeSection === "correlations" && <CorrelationSection data={report.correlation_matrix} />}
              {activeSection === "outliers" && <OutliersSection outliers={report.outliers} preview={report.preview} />}
              {activeSection === "insights" && <InsightsSection report={report} />}
              {activeSection === "statistics" && (
                isPreviewMode ? <LockedPreview feature="Statistical Analysis" />
                  : <StatisticsSection report={report} datasetId={openDatasetId} orgId="default" />
              )}
              {activeSection === "cleaning" && (
                isPreviewMode ? <LockedPreview feature="Data Cleaning" />
                  : <CleaningSection report={report} onReportUpdate={handleReportUpdate} />
              )}
              {activeSection === "transforms" && (
                isPreviewMode ? <LockedPreview feature="Feature Engineering" />
                  : <TransformSection report={report} onReportUpdate={handleReportUpdate} />
              )}
              {activeSection === "visualizations" && (
                <VisualizationsSection visualizations={visualizations} isLoading={vizLoading} report={report} />
              )}
              {activeSection === "sql" && (
                isPreviewMode ? <LockedPreview feature="SQL Editor" />
                  : <SQLQuerySection datasetId={openDatasetId} orgId="default" />
              )}
              {activeSection === "monitors" && (
                isPreviewMode ? <LockedPreview feature="Monitors" />
                  : <MonitoringSection datasetId={openDatasetId} orgId="default" />
              )}
              {activeSection === "comments" && (
                isPreviewMode ? <LockedPreview feature="Comments" /> :
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 320, color: "#9a9690", fontSize: 14 }}>
                  Comments coming soon.
                </div>
              )}
              {activeSection === "report" && <ReportSection report={report} fileName={fileName} />}
              {activeSection === "data" && <DataTable preview={report.preview} />}
            </ErrorBoundary>
          </main>
          <KeyboardShortcuts />
          <CommandPalette
            onSectionChange={(s) => handleSectionChange(s as NavSection)}
            sections={["overview", "columns", "statistics", "correlations", "outliers", "insights", "visualizations", "report", "cleaning", "transforms", "sql", "monitors", "data"]}
          />
        </div>
      </div>

      {showFileModal && (
        <NewFileModal
          onClose={() => setShowFileModal(false)}
          onFileAccepted={handleFileAccepted}
          onDatasetPick={handleOpenDataset}
          isUploading={isUploading}
        />
      )}
      </>
    );
  }

  // ─── Landing Page or User Dashboard ─────────────────────────────
  // While Clerk is loading, show a blank screen to avoid flashing the landing
  // page at signed-in users before their session is confirmed.
  if (!userLoaded) {
    return <div style={{ height: "100vh", background: "#f0eee9" }} />;
  }

  if (isSignedIn) {
    return (
      <UserDashboard
        onFileAccepted={handleFileAccepted}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        error={error}
        onClearError={handleClearError}
        onLoadSample={handleTryDemo}
        onOpenDataset={handleOpenDataset}
        refreshKey={dashboardKey}
      />
    );
  }

  return (
    <LandingPage
      onFileAccepted={handleFileAccepted}
      onTryDemo={handleTryDemo}
      isDemoLoading={isDemoLoading}
      isUploading={isUploading}
      uploadProgress={uploadProgress}
      error={error}
      onClearError={handleClearError}
      isSignedIn={false}
    />
  );
}
