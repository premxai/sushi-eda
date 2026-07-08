import { EDAReport } from "@/lib/types";
import { qualityScoreSummary, rankCorrelations, describeCorrelation, totalOutliers } from "@/lib/report-utils";
import { formatNumber, formatPercent, stripExtension } from "@/lib/formatters";

function downloadTextFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportReportJson(report: EDAReport, fileName: string, narrative: string | null, notes: string): void {
  const payload = {
    file_name: fileName,
    generated_at: new Date().toISOString(),
    ai_summary: narrative,
    analyst_notes: notes || null,
    quality_score: report.quality_score,
    basic_info: report.basic_info,
    column_analysis: report.column_analysis,
    correlation_matrix: report.correlation_matrix,
    outliers: report.outliers,
    type_suggestions: report.type_suggestions,
  };
  downloadTextFile(JSON.stringify(payload, null, 2), `${stripExtension(fileName)}_report.json`, "application/json");
}

export async function exportReportPdf(report: EDAReport, fileName: string, narrative: string | null, notes: string): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 48;
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - marginX * 2;
  let y = 56;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 48) {
      doc.addPage();
      y = 56;
    }
  };

  const heading = (text: string) => {
    ensureSpace(28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(text, marginX, y);
    y += 18;
  };

  const paragraph = (text: string, size = 10.5) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, maxWidth);
    for (const line of lines) {
      ensureSpace(16);
      doc.text(line, marginX, y);
      y += 15;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Data Report", marginX, y);
  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(90);
  doc.text(`${fileName} · Generated ${new Date().toLocaleDateString()}`, marginX, y);
  doc.setTextColor(20);
  y += 28;

  const { score, grade, verdict } = qualityScoreSummary(report.quality_score);
  heading(`Quality score: ${formatNumber(score)}/100 (Grade ${grade})`);
  paragraph(verdict);
  y += 6;

  paragraph(
    `${formatNumber(report.basic_info.rows)} rows · ${formatNumber(report.basic_info.columns)} columns · ${formatNumber(report.basic_info.duplicate_rows)} duplicate rows · ${formatNumber(report.basic_info.total_missing)} missing cells`,
  );
  y += 10;

  if (narrative) {
    heading("What your data says");
    paragraph(narrative.replace(/[#*_`]/g, ""));
    y += 6;
  }

  const pairs = rankCorrelations(report.correlation_matrix).slice(0, 5);
  if (pairs.length > 0) {
    heading("Strongest relationships");
    pairs.forEach((p) => paragraph(`• ${describeCorrelation(p)} (r = ${formatNumber(p.r, 3)})`));
    y += 6;
  }

  const outlierTotal = totalOutliers(report.outliers);
  heading("Unusual values");
  if (outlierTotal === 0) {
    paragraph("No unusual values were flagged.");
  } else {
    report.outliers
      .filter((o) => o.outlier_count > 0)
      .sort((a, b) => b.outlier_percent - a.outlier_percent)
      .forEach((o) => paragraph(`• ${o.column}: ${formatNumber(o.outlier_count)} unusual values (${formatPercent(o.outlier_percent)})`));
  }
  y += 6;

  if (report.quality_score.recommendations.length > 0) {
    heading("What to do about it");
    report.quality_score.recommendations.forEach((r) => paragraph(`• ${r}`));
    y += 6;
  }

  if (notes.trim()) {
    heading("Analyst notes");
    paragraph(notes);
  }

  doc.save(`${stripExtension(fileName)}_report.pdf`);
}
