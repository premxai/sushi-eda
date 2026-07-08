import React from "react";
import { ArrowRight } from "lucide-react";
import { EDAReport } from "@/lib/types";
import { qualityScoreSummary } from "@/lib/report-utils";
import { formatNumber } from "@/lib/formatters";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/common/Badge";

interface ExampleCardProps {
  filename: string;
  report: EDAReport;
  onOpen: () => void;
}

export function ExampleCard({ filename, report, onOpen }: ExampleCardProps) {
  const { score, grade } = qualityScoreSummary(report.quality_score);
  return (
    <Card hover className="cursor-pointer" onClick={onOpen}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[14px] font-medium text-ink">{filename}</p>
          <p className="mt-1 text-[12.5px] text-ink-secondary">
            {formatNumber(report.basic_info.rows)} rows · {formatNumber(report.basic_info.columns)} columns
          </p>
        </div>
        <Badge tone="brand">
          {score}/100 · {grade}
        </Badge>
      </div>
      <div className="mt-4 flex items-center gap-1.5 text-[13px] font-medium text-brand">
        Open example <ArrowRight className="h-3.5 w-3.5" />
      </div>
    </Card>
  );
}
