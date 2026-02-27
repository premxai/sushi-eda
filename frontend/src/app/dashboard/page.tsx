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
import { fetchVisualizations } from "@/lib/api";
import { Rows3, Columns3, HardDrive, CopyMinus } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const [report, setReport] = useState<EDAReport | null>(null);
  const [fileName, setFileName] = useState("");
  const [activeSection, setActiveSection] = useState<NavSection>("overview");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [visualizations, setVisualizations] = useState<Record<string, any> | null>(null);
  const [vizLoading, setVizLoading] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("eda_report");
    const name = sessionStorage.getItem("eda_filename");
    if (stored) {
      try {
        setReport(JSON.parse(stored));
        setFileName(name || "dataset");
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
    router.push("/");
  };

  if (!report) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

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
              <div key={s.label} className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1">
                <s.icon className="h-3 w-3 text-slate-400" />
                <span className="text-[11px] text-slate-500">{s.label}</span>
                <span className="text-[11px] font-semibold text-slate-900 tabular-nums">{s.value}</span>
              </div>
            ))}
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
