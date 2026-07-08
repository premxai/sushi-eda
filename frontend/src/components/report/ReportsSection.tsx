"use client";

import React, { useState } from "react";
import { Download, FileJson, FileSpreadsheet, FileText, Loader2, NotebookText } from "lucide-react";
import { EDAReport } from "@/lib/types";
import { exportDatasetExcel, exportDatasetMarkdown, getApiErrorMessage } from "@/lib/api";
import { exportReportJson, exportReportPdf } from "@/lib/export";
import { qualityScoreSummary, rankCorrelations, describeCorrelation, totalOutliers } from "@/lib/report-utils";
import { formatNumber, formatPercent, stripExtension } from "@/lib/formatters";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

interface ReportsSectionProps {
  report: EDAReport;
  fileName: string;
  datasetId: string | null;
  narrative: string | null;
  notes: string;
  onNotesChange: (notes: string) => void;
}

type ExportKind = "pdf" | "markdown" | "json" | "excel";

export function ReportsSection({ report, fileName, datasetId, narrative, notes, onNotesChange }: ReportsSectionProps) {
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { score, grade, verdict } = qualityScoreSummary(report.quality_score);
  const pairs = rankCorrelations(report.correlation_matrix).slice(0, 5);
  const outlierTotal = totalOutliers(report.outliers);
  const flaggedOutliers = report.outliers.filter((o) => o.outlier_count > 0).sort((a, b) => b.outlier_percent - a.outlier_percent);

  const runExport = async (kind: ExportKind) => {
    setError(null);
    setExporting(kind);
    try {
      if (kind === "pdf") await exportReportPdf(report, fileName, narrative, notes);
      else if (kind === "json") exportReportJson(report, fileName, narrative, notes);
      else if (kind === "markdown") {
        if (!datasetId) throw new Error("no-dataset");
        await exportDatasetMarkdown(datasetId, stripExtension(fileName));
      } else if (kind === "excel") {
        if (!datasetId) throw new Error("no-dataset");
        await exportDatasetExcel(datasetId, stripExtension(fileName));
      }
    } catch (err) {
      setError(
        err instanceof Error && err.message === "no-dataset"
          ? "This export needs a saved dataset. Try the PDF or JSON export instead."
          : getApiErrorMessage(err, "Couldn't generate that export right now."),
      );
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <NotebookText className="h-4 w-4 text-brand" />
        <h2 className="text-[15px] font-semibold text-ink">Reports</h2>
      </div>
      <p className="text-[13px] text-ink-secondary">A shareable summary of this analysis. Export it, or add your own notes below first.</p>

      {error && <Alert tone="danger">{error}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <div className="flex flex-col gap-3 text-[13px] text-ink-secondary">
          <p>
            <span className="font-semibold text-ink">
              {formatNumber(score)}/100 (Grade {grade})
            </span>
            <span>: {verdict}</span>
          </p>
          <p>
            {formatNumber(report.basic_info.rows)} rows · {formatNumber(report.basic_info.columns)} columns · {formatNumber(report.basic_info.duplicate_rows)} duplicate rows ·{" "}
            {formatNumber(report.basic_info.total_missing)} missing cells
          </p>
          {pairs.length > 0 && (
            <div>
              <p className="mb-1 font-medium text-ink">Strongest relationships</p>
              <ul className="flex flex-col gap-1">
                {pairs.map((p) => (
                  <li key={`${p.col1}-${p.col2}`}>
                    {describeCorrelation(p)} (r = {formatNumber(p.r, 3)})
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="mb-1 font-medium text-ink">Unusual values</p>
            {outlierTotal === 0 ? (
              <p>No unusual values were flagged.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {flaggedOutliers.map((o) => (
                  <li key={o.column}>
                    {o.column}: {formatNumber(o.outlier_count)} unusual values ({formatPercent(o.outlier_percent)})
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Analyst notes</CardTitle>
        </CardHeader>
        <Textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Add context your team should know before acting on this data…"
          rows={4}
        />
        <p className="mt-1.5 text-[11.5px] text-ink-tertiary">Included in the PDF and JSON exports below.</p>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export</CardTitle>
        </CardHeader>
        <div className="flex flex-wrap gap-2">
          <ExportButton icon={FileText} label="PDF" busy={exporting === "pdf"} onClick={() => runExport("pdf")} />
          <ExportButton icon={NotebookText} label="Markdown" busy={exporting === "markdown"} onClick={() => runExport("markdown")} />
          <ExportButton icon={FileJson} label="JSON" busy={exporting === "json"} onClick={() => runExport("json")} />
          <ExportButton icon={FileSpreadsheet} label="Excel" busy={exporting === "excel"} onClick={() => runExport("excel")} />
        </div>
      </Card>
    </div>
  );
}

function ExportButton({ icon: Icon, label, busy, onClick }: { icon: React.ElementType; label: string; busy: boolean; onClick: () => void }) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick} disabled={busy}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      {label}
      <Download className="h-3 w-3 opacity-50" />
    </Button>
  );
}
