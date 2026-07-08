"use client";

import React, { useEffect, useState } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { getApiErrorMessage, regenerateNarrative } from "@/lib/api";
import { Markdown } from "@/components/common/Markdown";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

interface AISummarySectionProps {
  narrative: string | null;
  datasetId: string | null;
  onNarrativeChange?: (narrative: string) => void;
}

export function AISummarySection({ narrative, datasetId, onNarrativeChange }: AISummarySectionProps) {
  const [local, setLocal] = useState(narrative);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setLocal(narrative), [narrative]);

  const handleGenerate = async () => {
    if (!datasetId || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await regenerateNarrative(datasetId);
      setLocal(result.ai_narrative);
      onNarrativeChange?.(result.ai_narrative);
    } catch (err) {
      setError(getApiErrorMessage(err, "Couldn't generate the summary right now."));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand" aria-hidden />
          <h2 className="text-[15px] font-semibold text-ink">What your data says</h2>
        </div>
        {datasetId && (
          <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {local ? "Regenerate" : "Generate summary"}
          </Button>
        )}
      </div>

      {error && (
        <Alert tone="warning" className="mb-4">
          {error}
        </Alert>
      )}

      {local ? (
        <div className="rounded-lg border border-border bg-surface p-5">
          <Markdown text={local} />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border-strong bg-surface-2/40 p-6 text-center">
          <p className="text-[13.5px] text-ink-secondary">
            No AI summary is available for this analysis. The quality score, columns, charts, statistics, and raw data are still fully
            available.
          </p>
          {datasetId && (
            <Button size="sm" className="mt-3" onClick={handleGenerate} disabled={generating}>
              {generating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {generating ? "Writing summary…" : "Generate a summary"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
