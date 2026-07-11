"use client";

import React, { useState } from "react";
import { EDAReport } from "@/lib/types";
import { NavSection, ReportNav, NAV_ITEMS } from "@/components/report/ReportNav";
import { ReportHeader } from "@/components/report/ReportHeader";
import { AISummarySection } from "@/components/report/AISummarySection";
import { OverviewSection } from "@/components/report/OverviewSection";
import { AskDataSection } from "@/components/report/AskDataSection";
import { FieldHealthSection } from "@/components/report/FieldHealthSection";
import { StatsTestSection } from "@/components/report/StatsTestSection";
import { CorrelationsSection } from "@/components/report/CorrelationsSection";
import { OutliersSection } from "@/components/report/OutliersSection";
import { ChartsSection } from "@/components/report/ChartsSection";
import { AINotesSection } from "@/components/report/AINotesSection";
import { SqlEditorSection } from "@/components/report/SqlEditorSection";
import { ReportsSection } from "@/components/report/ReportsSection";

interface ReportShellProps {
  report: EDAReport;
  fileName: string;
  datasetId: string | null;
  aiNarrative: string | null;
  isSampleMode: boolean;
  onOpenDataset: (datasetId: string, filename?: string) => void;
}

const SECTION_LABELS: Record<NavSection, string> = Object.fromEntries(NAV_ITEMS.map((item) => [item.key, item.label])) as Record<NavSection, string>;

export function ReportShell({ report, fileName, datasetId, aiNarrative, isSampleMode }: ReportShellProps) {
  const [active, setActive] = useState<NavSection>("ai-summary");
  const [narrative, setNarrative] = useState(aiNarrative);
  const [notes, setNotes] = useState("");

  return (
    <div className="app-workspace-page flex h-screen flex-col">
      <ReportHeader sectionTitle={SECTION_LABELS[active]} fileName={fileName} rows={report.basic_info.rows} columns={report.basic_info.columns} isSampleMode={isSampleMode} datasetId={datasetId} />
      <div className="report-shell-body flex flex-1 overflow-hidden">
        <aside className="report-shell-nav shrink-0 overflow-y-auto border-r border-border bg-surface/55 backdrop-blur scrollbar-thin">
          <ReportNav
            active={active}
            onChange={setActive}
            fileName={fileName}
            rows={report.basic_info.rows}
            columns={report.basic_info.columns}
            qualityScore={report.quality_score.overall_score}
          />
        </aside>
        <main className="report-main flex-1 overflow-y-auto scrollbar-thin">
          <div className="report-content mx-auto">
            {active === "ai-summary" && <AISummarySection narrative={narrative} datasetId={datasetId} report={report} onNarrativeChange={setNarrative} />}
            {active === "overview" && <OverviewSection info={report.basic_info} qualityScore={report.quality_score} />}
            {active === "ask" && <AskDataSection datasetId={datasetId} columns={report.column_analysis} />}
            {active === "fields" && (
              <FieldHealthSection columns={report.column_analysis} typeSuggestions={report.type_suggestions} totalRows={report.basic_info.rows} datasetId={datasetId} />
            )}
            {active === "stats" && <StatsTestSection datasetId={datasetId} columns={report.column_analysis} />}
            {active === "correlations" && <CorrelationsSection matrix={report.correlation_matrix} datasetId={datasetId} />}
            {active === "outliers" && <OutliersSection outliers={report.outliers} datasetId={datasetId} />}
            {active === "charts" && <ChartsSection datasetId={datasetId} columns={report.column_analysis} />}
            {active === "notes" && <AINotesSection datasetId={datasetId} />}
            {active === "sql" && <SqlEditorSection datasetId={datasetId} />}
            {active === "reports" && (
              <ReportsSection report={report} fileName={fileName} datasetId={datasetId} narrative={narrative} notes={notes} onNotesChange={setNotes} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
