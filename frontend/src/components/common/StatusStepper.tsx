import React from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Step {
  key: string;
  label: string;
}

interface StatusStepperProps {
  steps: Step[];
  activeKey: string;
  failed?: boolean;
  className?: string;
}

/** A real staged-progress indicator (queued -> parsing -> analyzing ->
 * writing summary), not a fake spinner. Steps before the active one are
 * shown complete, the active one animates, later ones are dimmed. */
export function StatusStepper({ steps, activeKey, failed, className }: StatusStepperProps) {
  const activeIndex = steps.findIndex((s) => s.key === activeKey);

  return (
    <ol className={cn("flex flex-col gap-2.5", className)}>
      {steps.map((step, i) => {
        const isDone = activeIndex > i || (activeIndex === -1 && !failed);
        const isActive = i === activeIndex;
        const isFailed = failed && isActive;

        return (
          <li key={step.key} className="flex items-center gap-2.5 text-[13px]">
            <span
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                isFailed && "border-danger bg-danger-weak text-danger",
                !isFailed && isDone && "border-success bg-success-weak text-success",
                !isFailed && isActive && !isDone && "border-brand bg-brand-weak text-brand",
                !isFailed && !isDone && !isActive && "border-border text-ink-tertiary",
              )}
            >
              {isFailed ? "!" : isDone ? <Check className="h-3 w-3" /> : isActive ? <Loader2 className="h-3 w-3 animate-spin" /> : i + 1}
            </span>
            <span className={cn(isDone || isActive ? "text-ink" : "text-ink-tertiary", isFailed && "text-danger")}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
