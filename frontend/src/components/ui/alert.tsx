"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type AlertTone = "info" | "success" | "warning" | "danger";

const TONE_STYLES: Record<AlertTone, { wrap: string; icon: React.ElementType }> = {
  info: { wrap: "bg-brand-weak border-brand/20 text-ink", icon: Info },
  success: { wrap: "bg-success-weak border-success/25 text-ink", icon: CheckCircle2 },
  warning: { wrap: "bg-warning-weak border-warning/25 text-ink", icon: AlertTriangle },
  danger: { wrap: "bg-danger-weak border-danger/25 text-ink", icon: XCircle },
};

interface AlertProps {
  tone?: AlertTone;
  title?: string;
  children: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}

export function Alert({ tone = "info", title, children, onDismiss, className }: AlertProps) {
  const { wrap, icon: Icon } = TONE_STYLES[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex items-start gap-2.5 rounded-md border px-3.5 py-3 text-[13px]", wrap, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex-1">
        {title && <p className="mb-0.5 font-medium text-ink">{title}</p>}
        <div className="text-ink-secondary">{children}</div>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss" className="shrink-0 rounded p-0.5 text-ink-tertiary hover:text-ink">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
