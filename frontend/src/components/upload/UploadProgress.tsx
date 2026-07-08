"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";
import { StatusStepper } from "@/components/common/StatusStepper";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { JobStatus } from "@/hooks/useJobStream";

const STEPS = [
  { key: "queued", label: "Queued" },
  { key: "parsing", label: "Reading your file" },
  { key: "analysis", label: "Analyzing your data" },
  { key: "narrative", label: "Writing your summary" },
];

interface UploadProgressProps {
  status: JobStatus;
  progress: number;
  stage: string;
  error: string | null;
  onRetry: () => void;
}

export function UploadProgress({ status, progress, stage, error, onRetry }: UploadProgressProps) {
  if (status === "failed") {
    return (
      <div className="rounded-lg border border-danger/25 bg-danger-weak p-8 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-surface">
          <AlertTriangle className="h-5 w-5 text-danger" />
        </div>
        <p className="mt-3 text-[15px] font-medium text-ink">Analysis failed</p>
        <p className="mx-auto mt-1 max-w-sm text-[13px] text-ink-secondary">
          {error || "Something went wrong while reading this file. It may be corrupted or in an unexpected format."}
        </p>
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try another file
        </Button>
      </div>
    );
  }

  // Normalize backend stage names ("analyzing") to our step keys ("analysis").
  const activeKey = stage === "analyzing" ? "analysis" : stage || "queued";

  return (
    <div className="rounded-lg border border-border-strong bg-surface p-8">
      <p className="text-center text-[15px] font-medium text-ink">Reading your data</p>
      <p className="mt-1 text-center text-[13px] text-ink-secondary">This usually takes 5 to 30 seconds.</p>

      <div className="mx-auto mt-6 max-w-xs">
        <StatusStepper steps={STEPS} activeKey={activeKey} />
      </div>

      <Progress value={Math.max(6, progress)} className="mx-auto mt-6 max-w-xs" />
    </div>
  );
}
