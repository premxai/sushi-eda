"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Sidebar, NavSection } from "@/components/dashboard/Sidebar";
import { OverviewSection } from "@/components/dashboard/OverviewSection";
import { ColumnCard } from "@/components/dashboard/ColumnCard";
import { CorrelationSection } from "@/components/dashboard/CorrelationSection";
import { OutliersSection } from "@/components/dashboard/OutliersSection";
import { InsightsSection } from "@/components/dashboard/InsightsSection";
import { VisualizationsSection } from "@/components/dashboard/VisualizationsSection";
import { CleaningSection } from "@/components/dashboard/CleaningSection";
import { TransformSection } from "@/components/dashboard/TransformSection";
import { DataTable } from "@/components/dashboard/DataTable";
import { ExportButton } from "@/components/ExportButton";
import { DashboardSkeleton } from "@/components/LoadingSkeleton";
import { uploadFile, loadSampleData, fetchVisualizations } from "@/lib/api";
import { EDAReport } from "@/lib/types";
import { Rows3, Columns3, HardDrive, CopyMinus, GitCompare, ArrowRight } from "lucide-react";
import Link from "next/link";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { CommandPalette } from "@/components/CommandPalette";
import { ColumnSearch } from "@/components/ColumnSearch";
import { SlideUp } from "@/components/PageTransition";
import Navbar from "@/components/Navbar";
import UploadCard from "@/components/UploadCard";
import { FeaturesSection } from "@/components/FeaturesSection";

export default function Home() {
  const [report, setReport] = useState<EDAReport | null>(null);
  const [fileName, setFileName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<NavSection>("overview");
  const [columnSearchTerm, setColumnSearchTerm] = useState("");
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [visualizations, setVisualizations] = useState<Record<string, any> | null>(null);
  const [vizLoading, setVizLoading] = useState(false);

  const handleFileAccepted = useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);
    setFileName(file.name);

    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + Math.random() * 15;
      });
    }, 300);

    try {
      const data = await uploadFile(file);
      clearInterval(interval);
      setUploadProgress(100);
      await new Promise((r) => setTimeout(r, 200));
      setReport(data);
    } catch (err: unknown) {
      clearInterval(interval);
      setUploadProgress(0);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to analyze file. Check that the backend is running on port 8000.";
      setError(message);
    } finally {
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
  };

  // ─── Dashboard View ───────────────────────────────────────────────
  if (report) {
    const { basic_info } = report;
    const headerStats = [
      { label: "Rows", value: basic_info.rows.toLocaleString(), icon: Rows3 },
      { label: "Cols", value: basic_info.columns.toLocaleString(), icon: Columns3 },
      { label: "Size", value: `${basic_info.memory_usage_mb} MB`, icon: HardDrive },
      { label: "Dupes", value: basic_info.duplicate_rows.toLocaleString(), icon: CopyMinus },
    ];
    const sectionTitles: Record<NavSection, string> = {
      overview: "Overview",
      columns: "Column Analysis",
      correlations: "Correlations",
      outliers: "Outlier Detection",
      insights: "Insights",
      visualizations: "Visualizations",
      cleaning: "Data Cleaning",
      transforms: "Feature Engineering",
      data: "Data Table",
    };

    return (
      <div className="flex h-screen bg-slate-50">
        <Sidebar
          fileName={fileName}
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          onNewFile={handleNewFile}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
            <h1 className="text-sm font-semibold text-slate-900">
              {sectionTitles[activeSection]}
            </h1>
            <div className="flex items-center gap-3">
              {headerStats.map((s) => (
                <div
                  key={s.label}
                  className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1"
                >
                  <s.icon className="h-3 w-3 text-slate-400" />
                  <span className="text-[11px] text-slate-500">{s.label}</span>
                  <span className="text-[11px] font-semibold text-slate-900 tabular-nums">{s.value}</span>
                </div>
              ))}
              <Link href="/compare">
                <Button variant="outline" size="sm" className="gap-2">
                  <GitCompare className="h-4 w-4" />
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
              {activeSection === "data" && <DataTable preview={report.preview} />}
            </ErrorBoundary>
          </main>
          <KeyboardShortcuts />
            <CommandPalette
            onSectionChange={(section) => handleSectionChange(section as NavSection)}
            sections={["overview", "columns", "correlations", "outliers", "insights", "visualizations", "cleaning", "transforms", "data"]}
          />
        </div>
      </div>
    );
  }

  // ─── Landing Page ─────────────────────────────────────────────────
  return (
    <main>
      <Navbar onTryDemo={handleTryDemo} isDemoLoading={isDemoLoading} />

      <section className="
        relative
        flex flex-col items-center
        justify-center
        text-center
        pt-[120px]
        pb-[80px]
        bg-[radial-gradient(circle_at_50%_30%,#ffffff_0%,#f5f5f7_40%,#ffffff_100%)]
      ">

        <div className="container-apple flex flex-col items-center">

          <h1 className="
            text-[72px]
            font-bold
            tracking-[-0.03em]
            leading-[1.05]
            text-neutral-900
          ">
            Serve your raw data.<br/>
            Perfectly.
          </h1>

          <p className="
            mt-6
            text-[20px]
            text-neutral-500
            max-w-[600px]
          ">
            Upload CSV, TSV, Excel, JSON, Parquet, or SQLite.
            Sushi transforms raw data into beautiful insights instantly.
          </p>

          <UploadCard
            onFileAccepted={handleFileAccepted}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            error={error}
            onClearError={handleClearError}
          />

          <button
            onClick={handleTryDemo}
            disabled={isDemoLoading}
            className="mt-4 flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-800 disabled:opacity-50"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            {isDemoLoading ? "Loading sample..." : "Try with sample sales data"}
          </button>

        </div>

      </section>

      <FeaturesSection />
    </main>
  );
}
