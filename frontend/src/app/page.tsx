"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useUser } from "@/lib/auth";
import { useJobStream } from "@/hooks/useJobStream";
import { Sidebar, NavSection } from "@/components/dashboard/Sidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { AISummarySection } from "@/components/dashboard/AISummarySection";
import AIChatPanel from "@/components/AIChatPanel";
import { OverviewSection } from "@/components/dashboard/OverviewSection";
import { ColumnCard } from "@/components/dashboard/ColumnCard";
import { CorrelationSection } from "@/components/dashboard/CorrelationSection";
import { OutliersSection } from "@/components/dashboard/OutliersSection";
import { InsightsSection } from "@/components/dashboard/InsightsSection";
import { VisualizationsSection } from "@/components/dashboard/VisualizationsSection";
import { StatisticsSection } from "@/components/dashboard/StatisticsSection";
import { ReportSection } from "@/components/dashboard/ReportSection";
import { DataTable } from "@/components/dashboard/DataTable";
import { SQLQuerySection } from "@/components/dashboard/SQLQuerySection";
import { NewFileModal } from "@/components/dashboard/NewFileModal";
import { DashboardSkeleton } from "@/components/LoadingSkeleton";
import { uploadFileAsync, loadSampleData, fetchExampleDataset, fetchDatasetVisualizations, prewarmBackend, archiveDataset, fetchAnalysis, fetchDatasetAnalysis, getApiErrorMessage } from "@/lib/api";
import { EDAReport } from "@/lib/types";
import { Lock } from "lucide-react";
import Link from "next/link";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { CommandPalette } from "@/components/CommandPalette";
import { ColumnSearch } from "@/components/ColumnSearch";
import SushiHome from "@/components/sushi/SushiHome";


const REPORT_KEY = "eda_report";
const FILE_KEY = "eda_filename";
const DATASET_KEY = "eda_dataset_id";
const NARRATIVE_KEY = "eda_narrative";

function LockedPreview({ feature }: { feature: string }) {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-line-2 bg-paper-2/60">
      <div className="grid h-14 w-14 place-items-center rounded-2xl border border-brand/20 bg-brand-weak">
        <Lock className="h-6 w-6 text-brand" />
      </div>
      <div className="text-center">
        <p className="mb-1.5 text-[17px] font-semibold text-ink">{feature} requires an account</p>
        <p className="max-w-[320px] text-[13px] text-muted-ink">
          Sign up for free to save datasets, reopen your work later, and unlock {feature}.
        </p>
      </div>
      <div className="mt-1 flex gap-2.5">
        <Link
          href="/sign-up"
          className="rounded-lg bg-[linear-gradient(135deg,var(--salmon),var(--tuna))] px-5 py-2 text-[13.5px] font-medium text-white no-underline shadow-[0_2px_12px_rgba(242,112,74,0.35)]"
        >
          Get started free →
        </Link>
        <Link
          href="/sign-in"
          className="rounded-lg border border-line-2 px-5 py-2 text-[13.5px] text-muted-ink no-underline"
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
  const [activeSection, setActiveSection] = useState<NavSection>("overview");
  const [columnSearchTerm, setColumnSearchTerm] = useState("");
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [openDatasetId, setOpenDatasetId] = useState<string | null>(null);
  const [aiNarrative, setAiNarrative] = useState<string | null>(null);
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
      setOpenDatasetId(storedDatasetId || null);
      setAiNarrative(sessionStorage.getItem(NARRATIVE_KEY) || null);
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
          const narrative = (data as { ai_narrative?: string | null }).ai_narrative ?? null;
          setReport(nextReport);
          setOpenDatasetId(datasetId);
          setAiNarrative(narrative);
          sessionStorage.setItem(REPORT_KEY, JSON.stringify(nextReport));
          sessionStorage.setItem(FILE_KEY, fileName || "dataset");
          sessionStorage.setItem(DATASET_KEY, datasetId);
          if (narrative) sessionStorage.setItem(NARRATIVE_KEY, narrative);
          else sessionStorage.removeItem(NARRATIVE_KEY);
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
    setAiNarrative(null);
    sessionStorage.removeItem(REPORT_KEY);
    sessionStorage.removeItem(FILE_KEY);
    sessionStorage.removeItem(DATASET_KEY);
    sessionStorage.removeItem(NARRATIVE_KEY);

    try {
      const asyncResult = await uploadFileAsync(file, "default", setUploadProgress);
      if (!asyncResult?.dataset_id) {
        throw new Error("Upload failed before a saved dataset could be created.");
      }

      // Saved-dataset path only. The job stream now owns the analysis lifecycle.
      setDatasetId(asyncResult.dataset_id);
      setOpenDatasetId(asyncResult.dataset_id);
      sessionStorage.setItem(DATASET_KEY, asyncResult.dataset_id);
      sessionStorage.setItem(FILE_KEY, file.name);
      setUploadProgress((progress) => Math.max(progress, 10));
      return;
    } catch (err: unknown) {
      setUploadProgress(0);
      setError(
        getApiErrorMessage(
          err,
          "We couldn't create a saved dataset right now. Please try again.",
        ),
      );
      setIsUploading(false);
    }
  }, []);

  const handleClearError = () => setError(null);

  const handleSectionChange = useCallback(async (section: NavSection) => {
    setActiveSection(section);
    if (section === "visualizations" && !visualizations && !vizLoading && openDatasetId) {
      setVizLoading(true);
      try {
        const data = await fetchDatasetVisualizations(openDatasetId, "default");
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
      setAiNarrative(result.ai_narrative ?? null);
      setVisualizations(null); // reset so visualizations reload for the new dataset
      setShowFileModal(false);
      setUploadProgress(100);
      sessionStorage.setItem(REPORT_KEY, JSON.stringify(result.report));
      sessionStorage.setItem(FILE_KEY, filename);
      sessionStorage.setItem(DATASET_KEY, id);
      if (result.ai_narrative) sessionStorage.setItem(NARRATIVE_KEY, result.ai_narrative);
      else sessionStorage.removeItem(NARRATIVE_KEY);
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to load dataset"));
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, []);

  const handleTryDemo = useCallback(async () => {
    // Instant path: open the pre-analyzed example seeded by the backend.
    // The loading UI is driven by isUploading (set inside the handlers below).
    const example = await fetchExampleDataset();
    if (example) {
      await handleOpenDataset(example.dataset_id, example.filename);
      return;
    }
    // Fallback: upload the bundled sample and run a fresh analysis
    const file = await loadSampleData();
    await handleFileAccepted(file);
  }, [handleFileAccepted, handleOpenDataset]);

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
    setAiNarrative(null);
    setShowFileModal(false);
    setDashboardKey((k) => k + 1);
    sessionStorage.removeItem(REPORT_KEY);
    sessionStorage.removeItem(FILE_KEY);
    sessionStorage.removeItem(DATASET_KEY);
    sessionStorage.removeItem(NARRATIVE_KEY);
  };

  const handleArchive = async () => {
    if (!openDatasetId) return;
    try {
      await archiveDataset(openDatasetId);
      sessionStorage.removeItem(REPORT_KEY);
      sessionStorage.removeItem(FILE_KEY);
      sessionStorage.removeItem(DATASET_KEY);
      handleNewFile();
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to archive dataset"));
    }
  };

  // ─── Dashboard View — sidebar navigation ─────────────────────────
  if (report) {
    const { basic_info } = report;
    const isPreviewMode = !isSignedIn;
    const sectionTitles: Record<NavSection, string> = {
      overview: "Data Summary", ask: "Ask Your Data", columns: "Field Health",
      statistics: "Compare & Validate", correlations: "What Moves Together",
      outliers: "Unusual Values", insights: "AI Notes", visualizations: "Charts & Trends",
      sql: "Advanced Queries", report: "Reports", data: "Raw Table",
    };

    return (
      <>
      <div className="flex h-screen flex-row overflow-hidden bg-paper">
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
          <DashboardHeader
            sectionTitle={sectionTitles[activeSection]}
            fileName={fileName}
            rows={basic_info.rows}
            columns={basic_info.columns}
            report={report}
            aiNarrative={aiNarrative}
            isPreviewMode={isPreviewMode}
          />

          <main className="flex-1 overflow-y-auto p-6">
            <ErrorBoundary>
              {isUploading && activeSection === "overview" && <DashboardSkeleton />}
              {!isUploading && activeSection === "overview" && (
                <>
                  <AISummarySection
                    narrative={aiNarrative}
                    datasetId={openDatasetId}
                    onNarrativeChange={(n) => {
                      setAiNarrative(n);
                      sessionStorage.setItem(NARRATIVE_KEY, n);
                    }}
                  />
                  <OverviewSection info={report.basic_info} qualityScore={report.quality_score} />
                </>
              )}
              {activeSection === "ask" && (
                openDatasetId ? (
                  <div style={{ height: "calc(100vh - 170px)", maxWidth: 860, margin: "0 auto" }}>
                    <AIChatPanel datasetId={openDatasetId} report={report} />
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 320, color: "var(--muted-ink)", fontSize: 14 }}>
                    Upload a dataset to start asking questions.
                  </div>
                )
              )}
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
                        <ColumnCard key={col.name} column={col} preview={report.preview} totalRows={basic_info.rows} datasetId={openDatasetId} />
                      ))}
                  </div>
                </>
              )}
              {activeSection === "correlations" && <CorrelationSection data={report.correlation_matrix} />}
              {activeSection === "outliers" && <OutliersSection outliers={report.outliers} preview={report.preview} />}
              {activeSection === "insights" && <InsightsSection report={report} />}
              {activeSection === "statistics" && (
                isPreviewMode ? <LockedPreview feature="Compare & Validate" />
                  : <StatisticsSection report={report} datasetId={openDatasetId} orgId="default" />
              )}
              {activeSection === "visualizations" && (
                <VisualizationsSection visualizations={visualizations} isLoading={vizLoading} report={report} datasetId={openDatasetId} orgId="default" />
              )}
              {activeSection === "sql" && (
                isPreviewMode ? <LockedPreview feature="Advanced Queries" />
                  : <SQLQuerySection datasetId={openDatasetId} orgId="default" />
              )}
              {activeSection === "report" && <ReportSection report={report} fileName={fileName} aiNarrative={aiNarrative} />}
              {activeSection === "data" && <DataTable preview={report.preview} />}
            </ErrorBoundary>
          </main>
          <KeyboardShortcuts />
          <CommandPalette
            onSectionChange={(s) => handleSectionChange(s as NavSection)}
            sections={["overview", "ask", "columns", "statistics", "correlations", "outliers", "report", "visualizations", "insights", "sql", "data"]}
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

  // ─── Home (landing + upload hub) ────────────────────────────────
  // While auth is resolving, avoid a flash of the wrong screen.
  if (!userLoaded) {
    return <div style={{ height: "100vh", background: "var(--paper)" }} />;
  }

  // Demo mode has one beautiful home for everyone; auth (Phase 4) can branch later.
  return (
    <SushiHome
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
