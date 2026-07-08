"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, Copy, NotebookPen } from "lucide-react";
import { CleaningSuggestion, getAICleaningSuggestions, getApiErrorMessage, isRateLimitError } from "@/lib/api";
import { Badge } from "@/components/common/Badge";
import { EmptyState } from "@/components/common/EmptyState";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface AINotesSectionProps {
  datasetId: string | null;
}

const PRIORITY_TONE: Record<CleaningSuggestion["priority"], "danger" | "warning" | "neutral"> = {
  high: "danger",
  medium: "warning",
  low: "neutral",
};

const CATEGORY_LABEL: Record<string, string> = {
  missing_data: "Missing data",
  duplicates: "Duplicates",
  outliers: "Outliers",
  type_cast: "Column types",
  formatting: "Formatting",
};

export function AINotesSection({ datasetId }: AINotesSectionProps) {
  const [notes, setNotes] = useState<CleaningSuggestion[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);

  useEffect(() => {
    if (!datasetId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRateLimited(false);
    getAICleaningSuggestions(datasetId)
      .then((res) => {
        if (!cancelled) setNotes(res.suggestions);
      })
      .catch((err) => {
        if (cancelled) return;
        if (isRateLimitError(err)) {
          setRateLimited(true);
        } else {
          setError(getApiErrorMessage(err, "Couldn't load notes for this dataset right now."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [datasetId]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <NotebookPen className="h-4 w-4 text-brand" />
        <h2 className="text-[15px] font-semibold text-ink">AI Notes</h2>
      </div>
      <p className="text-[13px] text-ink-secondary">Automatic observations about this data — high-missing columns, unusual values, and other things worth a second look.</p>

      {rateLimited && (
        <Alert tone="warning" title="You've reached today's question limit">
          The rest of the report is still available — try again tomorrow.
        </Alert>
      )}
      {error && <Alert tone="danger">{error}</Alert>}

      {loading && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {!loading && !error && !rateLimited && notes && notes.length === 0 && (
        <EmptyState icon={Copy} title="Nothing stood out" description="This data passed every automatic check we run." />
      )}

      {!loading && notes && notes.length > 0 && (
        <div className="flex flex-col gap-2">
          {notes.map((note) => (
            <div key={note.id} className="rounded-lg border border-border bg-surface p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className={cn("h-3.5 w-3.5 shrink-0", note.priority === "high" ? "text-danger" : note.priority === "medium" ? "text-warning" : "text-ink-tertiary")} />
                  <p className="text-[13.5px] font-medium text-ink">{note.title}</p>
                </div>
                <Badge tone={PRIORITY_TONE[note.priority]}>{note.priority}</Badge>
              </div>
              <p className="mt-1.5 pl-[22px] text-[13px] text-ink-secondary">{note.description}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[22px]">
                {CATEGORY_LABEL[note.category] && <Badge tone="neutral">{CATEGORY_LABEL[note.category]}</Badge>}
                {note.column && (
                  <span className="rounded-sm border border-border bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-ink-secondary">{note.column}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
