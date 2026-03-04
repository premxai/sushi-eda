"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sidebar, NavSection } from "@/components/dashboard/Sidebar";
import { OverviewSection } from "@/components/dashboard/OverviewSection";
import { ColumnCard } from "@/components/dashboard/ColumnCard";
import { CorrelationSection } from "@/components/dashboard/CorrelationSection";
import { StatisticsSection } from "@/components/dashboard/StatisticsSection";
import { MonitoringSection } from "@/components/dashboard/MonitoringSection";
import { ReportSection } from "@/components/dashboard/ReportSection";
import { OutliersSection } from "@/components/dashboard/OutliersSection";
import { InsightsSection } from "@/components/dashboard/InsightsSection";
import { VisualizationsSection } from "@/components/dashboard/VisualizationsSection";
import { CleaningSection } from "@/components/dashboard/CleaningSection";
import { TransformSection } from "@/components/dashboard/TransformSection";
import { DataTable } from "@/components/dashboard/DataTable";
import { SQLQuerySection } from "@/components/dashboard/SQLQuerySection";
import { EDAReport } from "@/lib/types";
import { fetchVisualizations, archiveDataset } from "@/lib/api";

const REPORT_KEY = "eda_report";
const FILE_KEY = "eda_filename";
const DATASET_KEY = "eda_dataset_id";

export default function DashboardPage() {
  const router = useRouter();
  const [report, setReport] = useState<EDAReport | null>(null);
  const [fileName, setFileName] = useState("");
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [activeSection, setActiveSection] = useState<NavSection>("overview");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [visualizations, setVisualizations] = useState<Record<string, any> | null>(null);
  const [vizLoading, setVizLoading] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(REPORT_KEY);
    const name = sessionStorage.getItem(FILE_KEY);
    const id = sessionStorage.getItem(DATASET_KEY);
    if (stored) {
      try {
        setReport(JSON.parse(stored));
        setFileName(name || "dataset");
        setDatasetId(id);
      } catch {
        sessionStorage.removeItem(REPORT_KEY);
        sessionStorage.removeItem(FILE_KEY);
        sessionStorage.removeItem(DATASET_KEY);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!report) return;
    sessionStorage.setItem(REPORT_KEY, JSON.stringify(report));
    sessionStorage.setItem(FILE_KEY, fileName || "dataset");
    if (datasetId) {
      sessionStorage.setItem(DATASET_KEY, datasetId);
    } else {
      sessionStorage.removeItem(DATASET_KEY);
    }
  }, [report, fileName, datasetId]);

  const handleReportUpdate = useCallback((newReport: EDAReport, newPreview: Record<string, unknown>[]) => {
    setReport({ ...newReport, preview: newPreview });
    setVisualizations(null);
  }, []);

  const handleSectionChange = useCallback(async (section: NavSection) => {
    setActiveSection(section);
    if (section === "visualizations" && !visualizations && !vizLoading) {
      setVizLoading(true);
      try {
        const data = await fetchVisualizations();
        setVisualizations(data);
      } catch {
        // VisualizationsSection handles the empty state
      } finally {
        setVizLoading(false);
      }
    }
  }, [visualizations, vizLoading]);

  const handleNewFile = () => {
    sessionStorage.removeItem(REPORT_KEY);
    sessionStorage.removeItem(FILE_KEY);
    sessionStorage.removeItem(DATASET_KEY);
    setReport(null);
    setFileName("");
    setDatasetId(null);
    setActiveSection("overview");
    setVisualizations(null);
  };

  const handleArchive = async () => {
    if (!datasetId) return;
    await archiveDataset(datasetId);
    sessionStorage.removeItem(REPORT_KEY);
    sessionStorage.removeItem(FILE_KEY);
    sessionStorage.removeItem(DATASET_KEY);
    router.push("/datasets");
  };

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!report) {
    return (
      <div style={{ minHeight: "100vh", background: "#f0eee9" }}>
        <nav style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "rgba(240,238,233,0.88)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(0,0,0,0.07)",
          padding: "0 32px",
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <Link href="/dashboard" style={{ fontSize: 18, fontWeight: 600, color: "#111010", textDecoration: "none" }}>
            Sushi
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link href="/datasets" style={{ fontSize: 13, color: "#6b6860", textDecoration: "none" }}>
              My Datasets
            </Link>
            <Link href="/" style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "7px 14px",
              borderRadius: 8,
              fontSize: 13,
              textDecoration: "none",
              background: "linear-gradient(135deg, #9060f8, #e840c8)",
              color: "#fff",
            }}>
              Upload file
            </Link>
          </div>
        </nav>
        <main style={{ maxWidth: 860, margin: "0 auto", padding: "56px 24px" }}>
          <h1 className="font-display" style={{ fontSize: 38, color: "#111010", marginBottom: 8 }}>
            Dashboard
          </h1>
          <p style={{ fontSize: 14, color: "#6b6860", marginBottom: 22 }}>
            No dataset is currently open. Upload a file or open one from your datasets list.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/" style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "9px 16px",
              borderRadius: 10,
              fontSize: 13.5,
              fontWeight: 500,
              textDecoration: "none",
              background: "linear-gradient(135deg, #9060f8, #e840c8)",
              color: "#fff",
            }}>
              Upload new dataset
            </Link>
            <Link href="/datasets" style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "9px 16px",
              borderRadius: 10,
              fontSize: 13.5,
              fontWeight: 500,
              textDecoration: "none",
              border: "1px solid rgba(0,0,0,0.12)",
              color: "#6b6860",
              background: "rgba(255,255,255,0.7)",
            }}>
              Open from My Datasets
            </Link>
          </div>
        </main>
      </div>
    );
  }

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
    report: "Report",
    data: "Data Table",
  };

  return (
    <div className="flex h-screen" style={{ background: "#f0eee9" }}>
      <Sidebar
        fileName={fileName}
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        onNewFile={handleNewFile}
        datasetId={datasetId}
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
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {activeSection === "overview" && <OverviewSection info={report.basic_info} qualityScore={report.quality_score} />}
          {activeSection === "columns" && (
            <div className="space-y-2">
              {report.column_analysis.map((col) => (
                <ColumnCard key={col.name} column={col} preview={report.preview} totalRows={basic_info.rows} />
              ))}
            </div>
          )}
          {activeSection === "statistics" && (
            <StatisticsSection report={report} datasetId={datasetId} orgId="default" />
          )}
          {activeSection === "correlations" && <CorrelationSection data={report.correlation_matrix} />}
          {activeSection === "outliers" && <OutliersSection outliers={report.outliers} preview={report.preview} />}
          {activeSection === "insights" && <InsightsSection report={report} />}
          {activeSection === "visualizations" && (
            <VisualizationsSection visualizations={visualizations} isLoading={vizLoading} report={report} />
          )}
          {activeSection === "cleaning" && (
            <CleaningSection report={report} onReportUpdate={handleReportUpdate} />
          )}
          {activeSection === "transforms" && (
            <TransformSection report={report} onReportUpdate={handleReportUpdate} />
          )}
          {activeSection === "sql" && (
            <SQLQuerySection datasetId={datasetId} orgId="default" />
          )}
          {activeSection === "monitors" && (
            <MonitoringSection datasetId={datasetId} orgId="default" />
          )}
          {activeSection === "report" && (
            <ReportSection report={report} fileName={fileName} />
          )}
          {activeSection === "data" && <DataTable preview={report.preview} />}
        </main>
      </div>
    </div>
  );
}
