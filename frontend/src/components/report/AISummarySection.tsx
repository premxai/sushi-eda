"use client";

import React, { useEffect, useState } from "react";
import { ArrowUpRight, Database, KeyRound, Loader2, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { getApiErrorMessage, regenerateNarrative } from "@/lib/api";
import type { EDAReport } from "@/lib/types";
import { Markdown } from "@/components/common/Markdown";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";

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
  const [showByok, setShowByok] = useState(false);
  const [byokKey, setByokKey] = useState("");

  useEffect(() => setLocal(narrative), [narrative]);

  const handleGenerate = async (providedKey?: string) => {
    if (!datasetId || generating) return;
    const key = providedKey?.trim();
    if (providedKey !== undefined && !key) {
      setError("Paste your Anthropic API key to generate with BYOK.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const result = await regenerateNarrative(datasetId, "default", key);
      setLocal(result.ai_narrative);
      onNarrativeChange?.(result.ai_narrative);
    } catch (err) {
      setError(getApiErrorMessage(err, "Couldn't generate the summary right now."));
    } finally {
      if (providedKey !== undefined) setByokKey("");
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
          <Button variant="secondary" size="md" className="rounded-full" onClick={() => void handleGenerate()} disabled={generating}>
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

      {datasetId && (
        <section className="mb-5 rounded-2xl border border-border bg-surface/80 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-brand/25 bg-brand-weak text-brand"><KeyRound className="h-4 w-4" /></span>
              <div>
                <p className="text-[13px] font-semibold text-ink">Bring your own Anthropic key</p>
                <p className="text-[11.5px] text-ink-tertiary">Use your own Claude API billing for this summary.</p>
              </div>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowByok((open) => !open)} disabled={generating}>
              {showByok ? "Hide key field" : "Use your key"}
            </Button>
          </div>
          {showByok && (
            <form
              className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row"
              onSubmit={(event) => { event.preventDefault(); void handleGenerate(byokKey); }}
            >
              <div className="flex-1">
                <label htmlFor="anthropic-byok" className="sr-only">Anthropic API key</label>
                <Input
                  id="anthropic-byok"
                  type="password"
                  value={byokKey}
                  onChange={(event) => setByokKey(event.target.value)}
                  placeholder="sk-ant-…"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  disabled={generating}
                />
                <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-ink-tertiary"><ShieldCheck className="h-3.5 w-3.5 text-success" />Used for this request only; never stored by Sushi.</p>
              </div>
              <Button type="submit" variant="brand" size="md" disabled={generating}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate with key
              </Button>
            </form>
          )}
        </section>
      )}

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
            <Button size="md" className="rounded-full" onClick={() => void handleGenerate()} disabled={generating}>
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
