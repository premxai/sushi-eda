"use client";

import React, { useEffect, useState } from "react";
import { ArrowUpRight, Database, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { getApiErrorMessage, regenerateNarrative } from "@/lib/api";
import type { EDAReport } from "@/lib/types";
import { Markdown } from "@/components/common/Markdown";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

interface AISummarySectionProps {
  narrative: string | null;
  datasetId: string | null;
  report: EDAReport;
  onNarrativeChange?: (narrative: string) => void;
}

export function AISummarySection({ narrative, datasetId, report, onNarrativeChange }: AISummarySectionProps) {
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
    <div className="ai-summary-page">
      <div className="ai-summary-intro">
        <div>
          <p className="section-kicker">Sushi analysis</p>
          <h2>Find the signal<br />in your data.</h2>
          <p>Your analysis is ready. Start with the executive view, then follow the evidence into each field.</p>
        </div>
        {datasetId && (
          <Button variant="secondary" size="md" className="rounded-full" onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {local ? "Refresh summary" : "Generate summary"}
          </Button>
        )}
      </div>

      <div className="ai-summary-metrics" aria-label="Dataset snapshot">
        <Metric label="Records" value={report.basic_info.rows.toLocaleString()} />
        <Metric label="Fields" value={String(report.basic_info.columns)} />
        <Metric label="Missing cells" value={report.basic_info.total_missing.toLocaleString()} tone={report.basic_info.total_missing === 0 ? "good" : "warning"} />
        <Metric label="Quality score" value={`${Math.round(report.quality_score.overall_score)}/100`} tone="good" />
      </div>

      {error && <Alert tone="warning" className="mb-5">{error}</Alert>}

      {local ? (
        <div className="ai-summary-narrative">
          <div className="ai-summary-narrative-heading">
            <Sparkles aria-hidden />
            <div><p className="eyebrow">Executive readout</p><h3>What your data says</h3></div>
          </div>
          <Markdown text={local} />
        </div>
      ) : (
        <div className="ai-summary-empty">
          <div className="ai-summary-empty-icon"><Database aria-hidden /></div>
          <div>
            <p className="eyebrow">Executive readout</p>
            <h3>Your data is mapped. Ready for interpretation.</h3>
            <p>No AI summary exists yet. Generate one for a concise narrative, or explore the health, relationships, and charts in the workspace.</p>
          </div>
          {datasetId && (
            <Button size="md" className="rounded-full" onClick={handleGenerate} disabled={generating}>
              {generating && <Loader2 className="h-4 w-4 animate-spin" />}
              {generating ? "Writing summary…" : <>Generate summary <ArrowUpRight className="h-4 w-4" /></>}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "good" | "warning" }) {
  return <div className={`ai-summary-metric ${tone ?? ""}`}><p>{label}</p><strong>{value}</strong></div>;
}
