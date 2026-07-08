import React from "react";
import { cn } from "@/lib/utils";
import { qualityTone } from "@/lib/report-utils";

const TONE_BAR: Record<string, string> = {
  good: "bg-success",
  caution: "bg-warning",
  bad: "bg-danger",
};

interface QualityDimensionCardProps {
  label: string;
  score: number;
  weight: number;
  details: string;
  className?: string;
}

export function QualityDimensionCard({ label, score, weight, details, className }: QualityDimensionCardProps) {
  const tone = qualityTone(score);
  return (
    <div className={cn("rounded-md border border-border bg-surface p-3.5", className)}>
      <div className="flex items-baseline justify-between">
        <p className="text-[12.5px] font-medium text-ink">{label}</p>
        <p className="text-[11px] text-ink-tertiary">{Math.round(weight * 100)}% weight</p>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div className={cn("h-full rounded-full", TONE_BAR[tone])} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
        </div>
        <span className="w-8 shrink-0 text-right text-[12px] tabular-nums text-ink-secondary">{Math.round(score)}</span>
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-ink-secondary">{details}</p>
    </div>
  );
}
