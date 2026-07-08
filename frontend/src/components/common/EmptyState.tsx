import React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong bg-surface-2/40 px-6 py-12 text-center", className)}>
      {Icon && (
        <div className="mb-1 grid h-10 w-10 place-items-center rounded-full bg-surface-2">
          <Icon className="h-5 w-5 text-ink-tertiary" aria-hidden />
        </div>
      )}
      <p className="text-[14px] font-medium text-ink">{title}</p>
      {description && <p className="max-w-sm text-[13px] text-ink-secondary">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
