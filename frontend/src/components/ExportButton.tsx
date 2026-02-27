"use client";

import React, { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EDAReport } from "@/lib/types";
import jsPDF from "jspdf";

interface ExportButtonProps {
  report: EDAReport;
  fileName: string;
}

export function ExportButton({ report, fileName }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPos = margin;

      // Helper to add new page if needed
      const checkPageBreak = (requiredSpace: number) => {
        if (yPos + requiredSpace > pageHeight - margin) {
          pdf.addPage();
          yPos = margin;
        }
      };

      // Title
      pdf.setFontSize(24);
      pdf.setFont("helvetica", "bold");
      pdf.text("Data Analysis Report", margin, yPos);
      yPos += 10;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Dataset: ${fileName}`, margin, yPos);
      yPos += 5;
      pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos);
      yPos += 15;

      // Quality Score
      if (report.quality_score) {
        checkPageBreak(40);
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0, 0, 0);
        pdf.text("Quality Score", margin, yPos);
        yPos += 8;

        pdf.setFontSize(12);
        pdf.setFont("helvetica", "normal");
        pdf.text(
          `Overall: ${report.quality_score.overall_score}/100 (Grade ${report.quality_score.grade})`,
          margin,
          yPos
        );
        yPos += 8;

        // Recommendations
        if (report.quality_score.recommendations.length > 0) {
          pdf.setFontSize(10);
          pdf.setFont("helvetica", "bold");
          pdf.text("Recommendations:", margin, yPos);
          yPos += 5;
          pdf.setFont("helvetica", "normal");
          report.quality_score.recommendations.forEach((rec) => {
            checkPageBreak(8);
            const lines = pdf.splitTextToSize(`• ${rec}`, pageWidth - 2 * margin);
            pdf.text(lines, margin + 3, yPos);
            yPos += lines.length * 5;
          });
        }
        yPos += 10;
      }

      // Basic Info
      checkPageBreak(40);
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text("Dataset Overview", margin, yPos);
      yPos += 8;

      const info = report.basic_info;
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const basicStats = [
        `Rows: ${info.rows.toLocaleString()}`,
        `Columns: ${info.columns.toLocaleString()}`,
        `Memory: ${info.memory_usage_mb} MB`,
        `Duplicates: ${info.duplicate_rows.toLocaleString()}`,
        `Missing Values: ${info.total_missing.toLocaleString()}`,
      ];
      basicStats.forEach((stat) => {
        pdf.text(stat, margin, yPos);
        yPos += 5;
      });
      yPos += 10;

      // Type Suggestions
      if (report.type_suggestions) {
        const allSuggestions = [
          ...report.type_suggestions.datetime_suggestions,
          ...report.type_suggestions.categorical_suggestions,
          ...report.type_suggestions.numeric_suggestions,
          ...report.type_suggestions.boolean_suggestions,
        ];

        if (allSuggestions.length > 0) {
          checkPageBreak(30);
          pdf.setFontSize(16);
          pdf.setFont("helvetica", "bold");
          pdf.text("Type Optimization Suggestions", margin, yPos);
          yPos += 8;

          pdf.setFontSize(9);
          pdf.setFont("helvetica", "normal");
          allSuggestions.slice(0, 10).forEach((sug) => {
            checkPageBreak(10);
            pdf.text(`${sug.column}: ${sug.current_type} → ${sug.suggested_type}`, margin, yPos);
            yPos += 4;
            pdf.setTextColor(100, 100, 100);
            const reasonLines = pdf.splitTextToSize(`  ${sug.reason}`, pageWidth - 2 * margin - 5);
            pdf.text(reasonLines, margin + 3, yPos);
            yPos += reasonLines.length * 4 + 3;
            pdf.setTextColor(0, 0, 0);
          });
          yPos += 10;
        }
      }

      // Column Analysis Summary
      checkPageBreak(30);
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text("Column Analysis", margin, yPos);
      yPos += 8;

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      report.column_analysis.slice(0, 15).forEach((col) => {
        checkPageBreak(12);
        pdf.setFont("helvetica", "bold");
        pdf.text(col.name, margin, yPos);
        yPos += 4;
        pdf.setFont("helvetica", "normal");
        pdf.text(
          `Type: ${col.dtype} | Missing: ${col.missing_percent}% | Unique: ${col.unique_count}`,
          margin + 3,
          yPos
        );
        yPos += 6;
      });
      yPos += 10;

      // Outliers Summary
      if (report.outliers.length > 0) {
        checkPageBreak(30);
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.text("Outliers Detected", margin, yPos);
        yPos += 8;

        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        report.outliers.slice(0, 10).forEach((outlier) => {
          checkPageBreak(8);
          pdf.text(
            `${outlier.column}: ${outlier.outlier_count} outliers (${outlier.outlier_percent}%)`,
            margin,
            yPos
          );
          yPos += 5;
        });
      }

      // Footer on last page
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(
        "Generated by Sushi — sushi-eda.vercel.app",
        pageWidth / 2,
        pageHeight - 10,
        { align: "center" }
      );

      // Save PDF
      pdf.save(`${fileName.replace(/\.[^/.]+$/, "")}_report.pdf`);
    } catch (error) {
      console.error("PDF export failed:", error);
      alert("Failed to export PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={isExporting}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      {isExporting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Exporting...
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          Export PDF
        </>
      )}
    </Button>
  );
}
