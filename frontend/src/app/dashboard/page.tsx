"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import { EDAReport } from "@/lib/types";
import { fetchVisualizations, archiveDataset } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [report, setReport] = useState<EDAReport | null>(null);
  const [fileName, setFileName] = useState("");
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<NavSection>("overview");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [visualizations, setVisualizations] = useState<Record<string, any> | null>(null);
  const [vizLoading, setVizLoading] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("eda_report");
    const name = sessionStorage.getItem("eda_filename");
    const id = sessionStorage.getItem("eda_dataset_id");
    if (stored) {
      try {
        setReport(JSON.parse(stored));
        setFileName(name || "dataset");
        setDatasetId(id);
      } catch {
        router.push("/");
      }
    } else {
      router.push("/");
    }
  }, [router]);

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
    sessionStorage.removeItem("eda_report");
    sessionStorage.removeItem("eda_filename");
    sessionStorage.removeItem("eda_dataset_id");
    router.push("/");
  };

  const handleArchive = async () => {
    if (!datasetId) return;
    await archiveDataset(datasetId);
    sessionStorage.removeItem("eda_report");
    sessionStorage.removeItem("eda_filename");
    sessionStorage.removeItem("eda_dataset_id");
    router.push("/datasets");
  };

  if (!report) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  const { basic_info } = report;

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
    <div className="flex h-screen bg-[#f0f2f8]">
      <Sidebar
        fileName={fileName}
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        onNewFile={handleNewFile}
        datasetId={datasetId}
        onArchive={handleArchive}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="relative flex shrink-0 items-center justify-between bg-white border-b border-slate-100 px-6 py-4">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-[#9060f8] to-[#e840c8]" />
          <div>
            <h1 className="font-display text-xl text-slate-900">{sectionTitles[activeSection]}</h1>
            <p className="text-xs text-slate-400 mt-0.5">Track, manage and explore your dataset.</p>
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
          {activeSection === "data" && <DataTable preview={report.preview} />}
        </main>
      </div>
    </div>
  );
}
