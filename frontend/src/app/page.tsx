"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useJobStream } from "@/hooks/useJobStream";
import { Button } from "@/components/ui/button";
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
import { uploadFile, uploadFileAsync, loadSampleData, fetchVisualizations, prewarmBackend, fetchAnalysis } from "@/lib/api";
import { EDAReport } from "@/lib/types";
import { GitCompare, Lock, FileSpreadsheet, Plus } from "lucide-react";
import Link from "next/link";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { CommandPalette } from "@/components/CommandPalette";
import { ColumnSearch } from "@/components/ColumnSearch";
import { LandingPage } from "@/components/LandingPage";
import { UserDashboard } from "@/components/UserDashboard";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { ProductTour } from "@/components/ProductTour";

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

export default function Home() {
  const { isSignedIn, isLoaded: userLoaded } = useUser();
  const [report, setReport] = useState<EDAReport | null>(null);
  const [fileName, setFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [columnSearchTerm, setColumnSearchTerm] = useState("");
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [openDatasetId, setOpenDatasetId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [visualizations, setVisualizations] = useState<Record<string, any> | null>(null);
  const [vizLoading, setVizLoading] = useState(false);

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

  // Auto-fetch visualizations when a report is loaded
  useEffect(() => {
    if (report && !visualizations && !vizLoading) {
      setVizLoading(true);
      fetchVisualizations().then(setVisualizations).catch(() => {}).finally(() => setVizLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!report]);

  const handleNewFile = () => {
    setReport(null);
    setFileName("");
    setError(null);
    setUploadProgress(0);
    setVisualizations(null);
    setOpenDatasetId(null);
    sessionStorage.removeItem(REPORT_KEY);
    sessionStorage.removeItem(FILE_KEY);
    sessionStorage.removeItem(DATASET_KEY);
  };

  // ─── Dashboard View — single scrollable page ──────────────────────
  if (report) {
    const { basic_info } = report;
    const isPreviewMode = !isSignedIn;

    const scrollTo = (id: string) =>
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

    const NAV_PILLS = [
      { id: "overview",       label: "Overview" },
      { id: "columns",        label: "Columns" },
      { id: "correlations",   label: "Correlations" },
      { id: "outliers",       label: "Outliers" },
      { id: "insights",       label: "Insights" },
      { id: "visualizations", label: "Visualizations" },
      { id: "statistics",     label: "Statistics",  locked: isPreviewMode },
      { id: "cleaning",       label: "Cleaning",    locked: isPreviewMode },
      { id: "transforms",     label: "Transforms",  locked: isPreviewMode },
      { id: "sql",            label: "SQL",         locked: isPreviewMode },
      { id: "monitors",       label: "Monitors",    locked: isPreviewMode },
      { id: "data",           label: "Data Table" },
      { id: "report",         label: "Report" },
    ];

    // Reusable section header
    const Sec = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
      <section id={id} style={{ scrollMarginTop: 110, marginBottom: 56 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 12, marginBottom: 20,
          paddingBottom: 14, borderBottom: "1px solid rgba(0,0,0,0.07)",
        }}>
          <h2 className="font-display" style={{ fontSize: 22, color: "#111010", letterSpacing: "-0.3px", margin: 0 }}>{title}</h2>
        </div>
        {children}
      </section>
    );

    return (
      <>
      <div style={{ minHeight: "100vh", background: "#f0eee9" }}>
        {/* ── Sticky header ── */}
        <header style={{
          position: "sticky", top: 0, zIndex: 100,
          background: "rgba(240,238,233,0.94)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(0,0,0,0.07)",
        }}>
          {/* Gradient accent line */}
          <div style={{ height: 2, background: "linear-gradient(90deg, transparent, rgba(144,96,248,0.5), rgba(232,64,200,0.5), transparent)" }} />

          {/* Top row: filename + controls */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 32px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <FileSpreadsheet style={{ width: 16, height: 16, color: "#9060f8", flexShrink: 0 }} />
              <span className="font-display" style={{ fontSize: 17, color: "#111010", letterSpacing: "-0.2px" }}>
                {fileName || "Dataset"}
              </span>
              <span style={{ fontSize: 11, color: "#9a9690", padding: "2px 8px", borderRadius: 20, background: "rgba(0,0,0,0.05)" }}>
                {basic_info.rows.toLocaleString()} rows · {basic_info.columns} cols
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={handleNewFile}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", borderRadius: 8, fontSize: 12.5,
                  border: "1px solid rgba(0,0,0,0.1)", background: "transparent",
                  color: "#6b6860", cursor: "pointer",
                }}
              >
                <Plus style={{ width: 13, height: 13 }} />
                New file
              </button>
              <Link href="/compare" style={{ textDecoration: "none" }}>
                <Button variant="outline" size="sm" className="gap-2 text-xs">
                  <GitCompare className="h-3.5 w-3.5" />
                  Compare
                </Button>
              </Link>
              <ExportButton report={report} fileName={fileName} />
            </div>
          </div>

          {/* Anchor nav pills */}
          <div style={{
            display: "flex", alignItems: "center", gap: 2,
            padding: "0 32px 10px",
            overflowX: "auto",
          }}>
            {NAV_PILLS.map((p) => (
              <button
                key={p.id}
                onClick={() => scrollTo(p.id)}
                style={{
                  padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500,
                  border: "none", cursor: "pointer", whiteSpace: "nowrap",
                  background: "transparent", color: p.locked ? "#bbb" : "#6b6860",
                  display: "flex", alignItems: "center", gap: 4,
                  transition: "background 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,0,0,0.06)"; e.currentTarget.style.color = "#111010"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = p.locked ? "#bbb" : "#6b6860"; }}
              >
                {p.locked && <Lock style={{ width: 10, height: 10 }} />}
                {p.label}
              </button>
            ))}
          </div>

          {/* Preview mode banner */}
          {isPreviewMode && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 32px",
              background: "linear-gradient(90deg, rgba(144,96,248,0.08), rgba(232,64,200,0.08))",
              borderTop: "1px solid rgba(144,96,248,0.12)",
              gap: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Lock style={{ width: 13, height: 13, color: "#9060f8", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#6b6860" }}>
                  <strong style={{ color: "#111010" }}>Preview mode</strong> — Statistics, SQL, Cleaning and Monitoring require an account.
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <Link href="/sign-up" style={{ padding: "5px 14px", borderRadius: 7, fontSize: 12, fontWeight: 500, background: "linear-gradient(135deg, #9060f8, #e840c8)", color: "#fff", textDecoration: "none" }}>
                  Get started free
                </Link>
                <Link href="/sign-in" style={{ padding: "5px 12px", borderRadius: 7, fontSize: 12, border: "1px solid rgba(0,0,0,0.12)", color: "#6b6860", textDecoration: "none" }}>
                  Sign in
                </Link>
              </div>
            </div>
          )}
        </header>

        {/* ── Scrollable content ── */}
        <main style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 32px 120px" }}>
          <ErrorBoundary>
            {/* Overview */}
            <Sec id="overview" title="Overview">
              {isUploading ? <DashboardSkeleton /> : <OverviewSection info={report.basic_info} qualityScore={report.quality_score} />}
            </Sec>

            {/* Columns */}
            <Sec id="columns" title={`Column Analysis (${basic_info.columns} columns)`}>
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
            </Sec>

            {/* Correlations */}
            <Sec id="correlations" title="Correlations">
              <CorrelationSection data={report.correlation_matrix} />
            </Sec>

            {/* Outliers */}
            <Sec id="outliers" title="Outlier Detection">
              <OutliersSection outliers={report.outliers} preview={report.preview} />
            </Sec>

            {/* Insights */}
            <Sec id="insights" title="Insights">
              <InsightsSection report={report} />
            </Sec>

            {/* Visualizations */}
            <Sec id="visualizations" title="Visualizations">
              <VisualizationsSection visualizations={visualizations} isLoading={vizLoading} report={report} />
            </Sec>

            {/* Statistics — locked in preview */}
            <Sec id="statistics" title="Statistical Analysis">
              {isPreviewMode
                ? <LockedPreview feature="Statistical Analysis" />
                : <StatisticsSection report={report} datasetId={openDatasetId} orgId="default" />}
            </Sec>

            {/* Data Cleaning — locked in preview */}
            <Sec id="cleaning" title="Data Cleaning">
              {isPreviewMode
                ? <LockedPreview feature="Data Cleaning" />
                : <CleaningSection report={report} onReportUpdate={handleReportUpdate} />}
            </Sec>

            {/* Transforms — locked in preview */}
            <Sec id="transforms" title="Feature Engineering">
              {isPreviewMode
                ? <LockedPreview feature="Feature Engineering" />
                : <TransformSection report={report} onReportUpdate={handleReportUpdate} />}
            </Sec>

            {/* SQL — locked in preview */}
            <Sec id="sql" title="SQL Editor">
              {isPreviewMode
                ? <LockedPreview feature="SQL Editor" />
                : <SQLQuerySection datasetId={openDatasetId} orgId="default" />}
            </Sec>

            {/* Monitors — locked in preview */}
            <Sec id="monitors" title="Monitors">
              {isPreviewMode
                ? <LockedPreview feature="Monitors" />
                : <MonitoringSection datasetId={openDatasetId} orgId="default" />}
            </Sec>

            {/* Data Table */}
            <Sec id="data" title="Data Table">
              <DataTable preview={report.preview} />
            </Sec>

            {/* Report */}
            <Sec id="report" title="Report">
              <ReportSection report={report} fileName={fileName} />
            </Sec>
          </ErrorBoundary>
        </main>
      </div>
      <KeyboardShortcuts />
      <CommandPalette
        onSectionChange={scrollTo}
        sections={["overview", "columns", "statistics", "correlations", "outliers", "insights", "visualizations", "report", "cleaning", "transforms", "sql", "monitors", "data"]}
      />
      <OnboardingChecklist activeSection="overview" hasDataset={!!report} />
      <ProductTour />
      </>
    );
  }

  // ─── Landing Page or User Dashboard ─────────────────────────────
  // Show user dashboard for signed-in users, landing page for guests
  if (userLoaded && isSignedIn) {
    return (
      <UserDashboard
        onFileAccepted={handleFileAccepted}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        error={error}
        onClearError={handleClearError}
        onLoadSample={handleTryDemo}
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
