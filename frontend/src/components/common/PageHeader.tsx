import React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("page-masthead flex flex-wrap items-end justify-between gap-6 border-b border-border pb-7", className)}>
      <div>
        <p className="section-kicker mb-3">Sushi / {title}</p>
        <h1 className="font-display text-[44px] font-normal leading-none tracking-[-0.035em] text-ink sm:text-[54px]">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-secondary">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
