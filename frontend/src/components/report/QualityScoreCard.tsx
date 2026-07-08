import React from "react";
import { qualityTone } from "@/lib/report-utils";
import { cn } from "@/lib/utils";

const TONE_COLOR: Record<string, string> = {
  good: "var(--success)",
  caution: "var(--warning)",
  bad: "var(--danger)",
};

interface QualityScoreCardProps {
  score: number;
  grade: string;
  verdict: string;
  className?: string;
}

/** A clean radial score indicator — the "trust gateway" of the report.
 * Deliberately plain: one ring, one number, one sentence. No stamps,
 * no glow, no decoration beyond the grade color. */
export function QualityScoreCard({ score, grade, verdict, className }: QualityScoreCardProps) {
  const tone = qualityTone(score);
  const color = TONE_COLOR[tone];
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * (Math.min(100, Math.max(0, score)) / 100);

  return (
    <div className={cn("flex items-center gap-5 rounded-lg border border-border bg-surface p-5", className)}>
      <svg width={100} height={100} viewBox="0 0 100 100" className="shrink-0" role="img" aria-label={`Quality score ${score} out of 100, grade ${grade}`}>
        <circle cx={50} cy={50} r={radius} fill="none" stroke="var(--surface-2)" strokeWidth={9} />
        <circle
          cx={50}
          cy={50}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={9}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
        <text x={50} y={47} textAnchor="middle" fontSize={22} fontWeight={600} fill="var(--ink)">
          {score}
        </text>
        <text x={50} y={64} textAnchor="middle" fontSize={11} fill="var(--ink-tertiary)">
          Grade {grade}
        </text>
      </svg>
      <div>
        <p className="eyebrow">Data quality</p>
        <p className="mt-1 max-w-md text-[13.5px] leading-relaxed text-ink">{verdict}</p>
      </div>
    </div>
  );
}
