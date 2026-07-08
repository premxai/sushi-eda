"use client";

import React, { useState } from "react";
import { Archive, ArchiveRestore, ExternalLink, Pencil, Star } from "lucide-react";
import { DatasetSummary } from "@/lib/api";
import { formatBytes, formatDate, formatExpiry, formatNumber } from "@/lib/formatters";
import { Badge } from "@/components/common/Badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const RETENTION_DAYS = 7;

interface DatasetCardProps {
  dataset: DatasetSummary;
  onOpen: (dataset: DatasetSummary) => void;
  onToggleStar: (dataset: DatasetSummary) => void;
  onArchive: (dataset: DatasetSummary) => void;
  onRestore: (dataset: DatasetSummary) => void;
  onRename: (dataset: DatasetSummary, name: string) => void;
  busy?: boolean;
}

export function DatasetCard({ dataset, onOpen, onToggleStar, onArchive, onRestore, onRename, busy }: DatasetCardProps) {
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(dataset.name || dataset.original_filename);
  const isArchived = Boolean(dataset.archived_at);
  const expiresAt = new Date(new Date(dataset.created_at).getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const submitRename = () => {
    setRenaming(false);
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== (dataset.name || dataset.original_filename)) {
      onRename(dataset, trimmed);
    } else {
      setDraftName(dataset.name || dataset.original_filename);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-3.5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          onClick={() => onToggleStar(dataset)}
          disabled={busy}
          aria-label={dataset.is_starred ? "Unstar" : "Star"}
          className="shrink-0 text-ink-tertiary hover:text-warning disabled:opacity-50"
        >
          <Star className={cn("h-4 w-4", dataset.is_starred && "fill-warning text-warning")} />
        </button>
        <div className="min-w-0 flex-1">
          {renaming ? (
            <Input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={submitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitRename();
                if (e.key === "Escape") {
                  setDraftName(dataset.name || dataset.original_filename);
                  setRenaming(false);
                }
              }}
              className="h-7 max-w-xs text-[13.5px]"
            />
          ) : (
            <div className="flex items-center gap-1.5">
              <button onClick={() => onOpen(dataset)} disabled={busy} className="truncate text-[13.5px] font-medium text-ink hover:text-brand disabled:opacity-50">
                {dataset.name || dataset.original_filename}
              </button>
              <button onClick={() => setRenaming(true)} disabled={busy} aria-label="Rename" className="shrink-0 text-ink-tertiary hover:text-ink disabled:opacity-50">
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}
          <p className="mt-0.5 truncate text-[12px] text-ink-secondary">
            {formatNumber(dataset.row_count ?? 0)} rows · {formatNumber(dataset.column_count ?? 0)} columns · {formatBytes(dataset.file_size_bytes)} · Uploaded{" "}
            {formatDate(dataset.created_at)}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Badge tone="neutral">{dataset.file_format.toUpperCase()}</Badge>
        {!isArchived && <Badge tone={new Date(expiresAt).getTime() - Date.now() < 2 * 86400000 ? "warning" : "neutral"}>{formatExpiry(expiresAt)}</Badge>}
        <button
          onClick={() => onOpen(dataset)}
          disabled={busy}
          aria-label="Open"
          className="rounded p-1.5 text-ink-tertiary hover:bg-surface-2 hover:text-ink disabled:opacity-50"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
        {isArchived ? (
          <button onClick={() => onRestore(dataset)} disabled={busy} aria-label="Restore" className="rounded p-1.5 text-ink-tertiary hover:bg-surface-2 hover:text-ink disabled:opacity-50">
            <ArchiveRestore className="h-4 w-4" />
          </button>
        ) : (
          <button onClick={() => onArchive(dataset)} disabled={busy} aria-label="Archive" className="rounded p-1.5 text-ink-tertiary hover:bg-surface-2 hover:text-danger disabled:opacity-50">
            <Archive className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
