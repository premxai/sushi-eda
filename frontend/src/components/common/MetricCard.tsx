import React from "react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
  className?: string;
}

const TONE_VALUE_CLASS: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  neutral: "text-ink",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

export function MetricCard({ label, value, sub, tone = "neutral", className }: MetricCardProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-surface px-4 py-3.5", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">{label}</p>
      <p className={cn("mt-1 text-metric", TONE_VALUE_CLASS[tone])}>{value}</p>
      {sub && <p className="mt-0.5 text-[12px] text-ink-secondary">{sub}</p>}
    </div>
  );
}
