"use client";

import React from "react";
import {
  AlertTriangle,
  TrendingDown,
  CheckCircle2,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EDAReport } from "@/lib/types";

interface InsightsSectionProps {
  report: EDAReport;
}

interface Insight {
  type: "success" | "warning" | "info" | "danger";
  title: string;
  description: string;
}

function generateInsights(report: EDAReport): Insight[] {
  const insights: Insight[] = [];
  const { basic_info, column_analysis, outliers } = report;

  // Data quality
  const missingPct =
    basic_info.rows > 0 && basic_info.columns > 0
      ? (basic_info.total_missing / (basic_info.rows * basic_info.columns)) * 100
      : 0;

  if (missingPct === 0) {
    insights.push({
      type: "success",
      title: "No missing values",
      description: "Your dataset is complete with no null or missing entries.",
    });
  } else if (missingPct < 5) {
    insights.push({
      type: "info",
      title: `Low missing data (${missingPct.toFixed(1)}%)`,
      description: `${basic_info.total_missing.toLocaleString()} missing cells found. Consider imputation or dropping rows.`,
    });
  } else {
    insights.push({
      type: "warning",
      title: `Significant missing data (${missingPct.toFixed(1)}%)`,
      description: `${basic_info.total_missing.toLocaleString()} missing cells across the dataset. Review columns with high missingness.`,
    });
  }

  // Duplicates
  if (basic_info.duplicate_rows > 0) {
    const dupPct = ((basic_info.duplicate_rows / basic_info.rows) * 100).toFixed(1);
    insights.push({
      type: "warning",
      title: `${basic_info.duplicate_rows.toLocaleString()} duplicate rows (${dupPct}%)`,
      description: "Consider deduplication before analysis to avoid skewed results.",
    });
  } else {
    insights.push({
      type: "success",
      title: "No duplicate rows",
      description: "All rows in the dataset are unique.",
    });
  }

  // High-missing columns
  const highMissing = column_analysis.filter((c) => c.missing_percent > 30);
  if (highMissing.length > 0) {
    insights.push({
      type: "danger",
      title: `${highMissing.length} column(s) with >30% missing`,
      description: `Columns: ${highMissing.map((c) => c.name).join(", ")}. Consider dropping these columns.`,
    });
  }

  // Skewed columns
  const skewed = column_analysis.filter(
    (c) => c.is_numeric && c.stats && Math.abs(c.stats.skewness) > 2
  );
  if (skewed.length > 0) {
    insights.push({
      type: "info",
      title: `${skewed.length} highly skewed column(s)`,
      description: `${skewed.map((c) => c.name).join(", ")} — consider log or Box-Cox transforms for modeling.`,
    });
  }

  // Outliers
  const heavyOutliers = outliers.filter((o) => o.outlier_percent > 5);
  if (heavyOutliers.length > 0) {
    insights.push({
      type: "warning",
      title: `${heavyOutliers.length} column(s) with >5% outliers`,
      description: `${heavyOutliers.map((o) => o.column).join(", ")}. These may skew statistical summaries.`,
    });
  } else if (outliers.length > 0) {
    insights.push({
      type: "success",
      title: "Outliers under control",
      description: "No columns have more than 5% outlier values.",
    });
  }

  // Low cardinality numeric
  const lowCard = column_analysis.filter(
    (c) => c.is_numeric && c.unique_count <= 10
  );
  if (lowCard.length > 0) {
    insights.push({
      type: "info",
      title: `${lowCard.length} numeric column(s) with low cardinality`,
      description: `${lowCard.map((c) => `${c.name} (${c.unique_count} unique)`).join(", ")} — these may be categorical in disguise.`,
    });
  }

  // Constant columns
  const constant = column_analysis.filter((c) => c.unique_count <= 1);
  if (constant.length > 0) {
    insights.push({
      type: "danger",
      title: `${constant.length} constant column(s)`,
      description: `${constant.map((c) => c.name).join(", ")} have 0-1 unique values and provide no information. Remove them.`,
    });
  }

  // Dataset size
  if (basic_info.memory_usage_mb > 100) {
    insights.push({
      type: "info",
      title: "Large dataset in memory",
      description: `${basic_info.memory_usage_mb} MB. Consider chunked processing or data type optimization.`,
    });
  }

  return insights;
}

const typeConfig = {
  success: { icon: CheckCircle2, border: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-700", iconColor: "text-emerald-500" },
  warning: { icon: AlertTriangle, border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-700", iconColor: "text-amber-500" },
  info: { icon: Info, border: "border-brand/25", bg: "bg-brand-weak", text: "text-brand-hover", iconColor: "text-brand" },
  danger: { icon: TrendingDown, border: "border-rose-200", bg: "bg-rose-50", text: "text-rose-700", iconColor: "text-rose-500" },
};

export function InsightsSection({ report }: InsightsSectionProps) {
  const insights = generateInsights(report);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-medium text-slate-900">Automated Insights</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          {insights.length} findings from your dataset analysis
        </p>
      </div>

      <div className="space-y-2">
        {insights.map((insight, i) => {
          const cfg = typeConfig[insight.type];
          const Icon = cfg.icon;
          return (
            <div
              key={i}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-4 transition-shadow hover:shadow-md",
                cfg.border,
                "bg-white"
              )}
            >
              <div className={cn("rounded-lg p-2", cfg.bg)}>
                <Icon className={cn("h-4 w-4", cfg.iconColor)} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">{insight.title}</p>
                <p className="mt-0.5 text-xs text-slate-600">{insight.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
