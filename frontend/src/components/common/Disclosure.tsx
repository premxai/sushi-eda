"use client";

import React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DisclosureProps {
  summary: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
}

/** Native <details>/<summary>, keyboard accessible and screen-reader
 * friendly with zero extra JS. Used for "how was this computed?" and any
 * jargon that should stay hidden until asked for. */
export function Disclosure({ summary, children, className, defaultOpen = false }: DisclosureProps) {
  return (
    <details className={cn("group rounded-md border border-border bg-surface-2/60", className)} open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-[12.5px] font-medium text-ink-secondary [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-90" aria-hidden />
        {summary}
      </summary>
      <div className="border-t border-border px-3 py-2.5">{children}</div>
    </details>
  );
}
