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
import { CommentsSection } from "@/components/dashboard/CommentsSection";
import { ReportSection } from "@/components/dashboard/ReportSection";
import { CleaningSection } from "@/components/dashboard/CleaningSection";
import { TransformSection } from "@/components/dashboard/TransformSection";
import { DataTable } from "@/components/dashboard/DataTable";
import { SQLQuerySection } from "@/components/dashboard/SQLQuerySection";
import { ExportButton } from "@/components/ExportButton";
import { DashboardSkeleton } from "@/components/LoadingSkeleton";
import { uploadFile, uploadFileAsync, loadSampleData, fetchVisualizations, prewarmBackend, archiveDataset, fetchAnalysis } from "@/lib/api";
import { EDAReport } from "@/lib/types";
import { GitCompare } from "lucide-react";
import Link from "next/link";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { CommandPalette } from "@/components/CommandPalette";
import { ColumnSearch } from "@/components/ColumnSearch";
import { SlideUp } from "@/components/PageTransition";
import { LandingPage } from "@/components/LandingPage";
import { UserDashboard } from "@/components/UserDashboard";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import { ProductTour } from "@/components/ProductTour";

const REPORT_KEY = "eda_report";
const FILE_KEY = "eda_filename";
const DATASET_KEY = "eda_dataset_id";

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
    setVisualizations(null); // invalidate cached viz — data changed
  }, []);

  const handleSectionChange = useCallback(async (section: NavSection) => {
    setActiveSection(section);
    if (section === "visualizations" && !visualizations && !vizLoading) {
      setVizLoading(true);
      try {
        const data = await fetchVisualizations();
        setVisualizations(data);
      } catch {
        // silently fail — VisualizationsSection will show an error state
      } finally {
        setVizLoading(false);
      }
    }
  }, [visualizations, vizLoading]);

  const handleNewFile = () => {
    setReport(null);
    setFileName("");
    setError(null);
    setUploadProgress(0);
    setActiveSection("overview");
    setVisualizations(null);
    setOpenDatasetId(null);
    sessionStorage.removeItem(REPORT_KEY);
    sessionStorage.removeItem(FILE_KEY);
    sessionStorage.removeItem(DATASET_KEY);
  };

  const handleArchive = async () => {
    if (!openDatasetId) return;
    await archiveDataset(openDatasetId);
    sessionStorage.removeItem(REPORT_KEY);
    sessionStorage.removeItem(FILE_KEY);
    sessionStorage.removeItem(DATASET_KEY);
    handleNewFile();
  };

  // ─── Dashboard View ───────────────────────────────────────────────
  if (report) {
    const { basic_info } = report;
    const sectionTitles: Record<NavSection, string> = {
      overview: "Overview",
      columns: "Column Analysis",
      statistics: "Statistical Analysis",
      correlations: "Correlations",
      outliers: "Outlier Detection",
      insights: "Insights",
      visualizations: "Visualizations",
      cleaning: "Data Cleaning",
      transforms: "Feature Engineering",
      sql: "SQL Editor",
      monitors: "Monitors",
      comments: "Comments",
      report: "Report",
      data: "Data Table",
    };

    return (
      <>
      <div className="flex h-screen" style={{ background: "#f0eee9" }}>
        <Sidebar
          fileName={fileName}
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          onNewFile={handleNewFile}
          datasetId={openDatasetId}
          onArchive={handleArchive}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <header style={{
            position: "relative", display: "flex", flexShrink: 0,
            alignItems: "center", justifyContent: "space-between",
            padding: "14px 32px",
            background: "rgba(240,238,233,0.88)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(0,0,0,0.07)",
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(144,96,248,0.5), rgba(232,64,200,0.5), transparent)" }} />
            <div>
              <h1 className="font-display" style={{ fontSize: 22, color: "#111010", letterSpacing: "-0.3px" }}>{sectionTitles[activeSection]}</h1>
              <p style={{ fontSize: 12, color: "#9a9690", marginTop: 2 }}>Track, manage and explore your dataset.</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/compare">
                <Button variant="outline" size="sm" className="gap-2 text-xs">
                  <GitCompare className="h-3.5 w-3.5" />
                  Compare
                </Button>
              </Link>
              <ExportButton report={report} fileName={fileName} />
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-6">
            <ErrorBoundary>
              {isUploading && activeSection === "overview" && <DashboardSkeleton />}
              {!isUploading && activeSection === "overview" && <OverviewSection info={report.basic_info} qualityScore={report.quality_score} />}
              {activeSection === "columns" && (
                <SlideUp>
                  <ColumnSearch 
                    onSearchChange={setColumnSearchTerm}
                    resultCount={report.column_analysis.filter(col => 
                      col.name.toLowerCase().includes(columnSearchTerm.toLowerCase())
                    ).length}
                  />
                  <div className="space-y-2">
                    {report.column_analysis
                      .filter(col => col.name.toLowerCase().includes(columnSearchTerm.toLowerCase()))
                      .map((col) => (
                        <ColumnCard key={col.name} column={col} preview={report.preview} totalRows={basic_info.rows} />
                      ))}
                  </div>
                </SlideUp>
              )}
              {activeSection === "correlations" && <CorrelationSection data={report.correlation_matrix} />}
              {activeSection === "outliers" && <OutliersSection outliers={report.outliers} preview={report.preview} />}
              {activeSection === "insights" && <InsightsSection report={report} />}
              {activeSection === "statistics" && (
                <StatisticsSection report={report} datasetId={openDatasetId} orgId="default" />
              )}
              {activeSection === "cleaning" && (
                <CleaningSection report={report} onReportUpdate={handleReportUpdate} />
              )}
              {activeSection === "transforms" && (
                <TransformSection report={report} onReportUpdate={handleReportUpdate} />
              )}
              {activeSection === "visualizations" && (
                <VisualizationsSection
                  visualizations={visualizations}
                  isLoading={vizLoading}
                  report={report}
                />
              )}
              {activeSection === "sql" && (
                <SQLQuerySection datasetId={openDatasetId} orgId="default" />
              )}
              {activeSection === "monitors" && (
                <MonitoringSection datasetId={openDatasetId} orgId="default" />
              )}
              {activeSection === "comments" && (
                <CommentsSection
                  datasetId={openDatasetId}
                  orgId="default"
                  columns={report.column_analysis.map((c) => c.name)}
                />
              )}
              {activeSection === "report" && (
                <ReportSection report={report} fileName={fileName} />
              )}
              {activeSection === "data" && <DataTable preview={report.preview} />}
            </ErrorBoundary>
          </main>
          <KeyboardShortcuts />
            <CommandPalette
            onSectionChange={(section) => handleSectionChange(section as NavSection)}
            sections={["overview", "columns", "statistics", "correlations", "outliers", "insights", "visualizations", "report", "cleaning", "transforms", "sql", "monitors", "comments", "data"]}
          />
        </div>
      </div>
      <OnboardingChecklist activeSection={activeSection} hasDataset={!!report} />
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
    />
  );
}
