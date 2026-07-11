import React from "react";
import { BasicInfo, QualityScore } from "@/lib/types";
import { formatBytes, formatNumber, formatPercent } from "@/lib/formatters";
import { dimensionLabel, qualityScoreSummary } from "@/lib/report-utils";
import { QualityScoreCard } from "@/components/report/QualityScoreCard";
import { QualityDimensionCard } from "@/components/report/QualityDimensionCard";
import { ReportSectionHeading } from "@/components/report/ReportSectionHeading";
import { MetricCard } from "@/components/common/MetricCard";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Lightbulb } from "lucide-react";

interface OverviewSectionProps {
  info: BasicInfo;
  qualityScore: QualityScore;
}

export function OverviewSection({ info, qualityScore }: OverviewSectionProps) {
  const { score, grade, verdict } = qualityScoreSummary(qualityScore);
  const missingPct = info.rows > 0 && info.columns > 0 ? (info.total_missing / (info.rows * info.columns)) * 100 : 0;
  const duplicatePct = info.rows > 0 ? (info.duplicate_rows / info.rows) * 100 : 0;

  return (
    <div className="flex flex-col gap-5">
      <ReportSectionHeading icon={BarChart3} eyebrow="Dataset profile" title="See the whole table." description="A quick health check on structure, completeness, and the issues that deserve attention first." />
      <QualityScoreCard score={score} grade={grade} verdict={verdict} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Rows" value={formatNumber(info.rows)} />
        <MetricCard label="Columns" value={formatNumber(info.columns)} />
        <MetricCard
          label="Missing values"
          value={formatPercent(missingPct)}
          sub={`${formatNumber(info.total_missing)} cells`}
          tone={missingPct > 10 ? "danger" : missingPct > 2 ? "warning" : "neutral"}
        />
        <MetricCard
          label="Duplicates"
          value={formatPercent(duplicatePct)}
          sub={`${formatNumber(info.duplicate_rows)} rows`}
          tone={duplicatePct > 5 ? "danger" : duplicatePct > 0 ? "warning" : "neutral"}
        />
      </div>

      <Card padded={false} className="p-4">
        <p className="mb-2.5 text-[12.5px] font-medium text-ink">Data types</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(info.dtypes_summary).map(([dtype, count]) => (
            <span key={dtype} className="rounded-sm border border-border bg-surface-2 px-2 py-1 font-mono text-[11.5px] text-ink-secondary">
              {dtype} <span className="font-semibold text-ink">×{count}</span>
            </span>
          ))}
        </div>
      </Card>

      <div>
        <CardHeader className="mb-3">
          <CardTitle>How the score breaks down</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(qualityScore.breakdown).map(([key, dim]) => (
            <QualityDimensionCard key={key} label={dimensionLabel(key)} score={dim.score} weight={dim.weight} details={dim.details} />
          ))}
        </div>
      </div>

      {qualityScore.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-brand" /> What to do about it
            </CardTitle>
          </CardHeader>
          <ul className="flex flex-col gap-2">
            {qualityScore.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] text-ink-secondary">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-tertiary" />
                {rec}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-[11.5px] text-ink-tertiary">{formatBytes(info.memory_usage_bytes)} in memory</p>
    </div>
  );
}
