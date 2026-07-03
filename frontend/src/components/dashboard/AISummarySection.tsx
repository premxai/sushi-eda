"use client";

import React, { useState } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { getApiErrorMessage, regenerateNarrative } from "@/lib/api";

interface AISummarySectionProps {
  narrative: string | null;
  datasetId?: string | null;
  orgId?: string;
  onNarrativeChange?: (narrative: string) => void;
  /** Compact variant used when embedded above another section. */
  compact?: boolean;
}

/**
 * Minimal markdown renderer for the AI narrative — headings, bold, bullets,
 * numbered lists. Avoids pulling in a full markdown dependency for one card.
 */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${keyPrefix}-${i}`} style={{ color: "#111010", fontWeight: 600 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>;
  });
}

export function NarrativeMarkdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listKey = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={`list-${listKey++}`} style={{ margin: "6px 0 12px", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
        {listItems.map((item, i) => (
          <li key={i} style={{ fontSize: 13.5, lineHeight: 1.55, color: "#3d3a35" }}>
            {renderInline(item, `li-${listKey}-${i}`)}
          </li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  text.split("\n").forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) {
      flushList();
      return;
    }
    const bullet = line.match(/^[-*•]\s+(.*)/) || line.match(/^\d+\.\s+(.*)/);
    if (bullet) {
      listItems.push(bullet[1]);
      return;
    }
    flushList();
    const heading = line.match(/^#{1,4}\s+(.*)/);
    if (heading) {
      blocks.push(
        <h3 key={`h-${idx}`} style={{ fontSize: 13, fontWeight: 600, color: "#111010", margin: "14px 0 4px", letterSpacing: "-0.1px" }}>
          {renderInline(heading[1].replace(/\*\*/g, ""), `h-${idx}`)}
        </h3>,
      );
      return;
    }
    // A bare "**Section title**" line acts as a heading too
    const boldHeading = line.match(/^\*\*([^*]+)\*\*:?$/);
    if (boldHeading) {
      blocks.push(
        <h3 key={`bh-${idx}`} style={{ fontSize: 13, fontWeight: 600, color: "#111010", margin: "14px 0 4px", letterSpacing: "-0.1px" }}>
          {boldHeading[1]}
        </h3>,
      );
      return;
    }
    blocks.push(
      <p key={`p-${idx}`} style={{ fontSize: 13.5, lineHeight: 1.6, color: "#3d3a35", margin: "4px 0" }}>
        {renderInline(line, `p-${idx}`)}
      </p>,
    );
  });
  flushList();

  return <>{blocks}</>;
}

export function AISummarySection({
  narrative,
  datasetId,
  orgId = "default",
  onNarrativeChange,
  compact = false,
}: AISummarySectionProps) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localNarrative, setLocalNarrative] = useState<string | null>(narrative);

  // Keep in sync when a new dataset is opened
  React.useEffect(() => setLocalNarrative(narrative), [narrative]);

  const handleGenerate = async () => {
    if (!datasetId || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await regenerateNarrative(datasetId, orgId);
      setLocalNarrative(result.ai_narrative);
      onNarrativeChange?.(result.ai_narrative);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not generate the summary right now."));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div
      style={{
        position: "relative",
        borderRadius: "var(--r)",
        padding: compact ? "20px 24px" : "26px 30px",
        marginBottom: 20,
        background: "var(--surface)",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow-sm)",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, var(--brand), transparent)" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: localNarrative ? 12 : 4 }}>
        <div
          style={{
            width: 28, height: 28, borderRadius: 9,
            background: "var(--brand-weak)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Sparkles style={{ width: 15, height: 15, color: "var(--brand)" }} />
        </div>
        <span
          className="font-display"
          style={{ fontSize: 22, color: "var(--ink)", letterSpacing: "-0.01em", lineHeight: 1.1 }}
        >
          What your data says
        </span>
        {localNarrative && datasetId && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            title="Regenerate summary"
            style={{
              marginLeft: "auto", display: "flex", alignItems: "center", gap: 5,
              padding: "5px 11px", borderRadius: 999, fontSize: 11.5, fontWeight: 500,
              border: "1px solid var(--line-2)", background: "var(--surface-2)",
              color: "var(--muted-ink)", cursor: "pointer",
            }}
          >
            {generating
              ? <Loader2 style={{ width: 11, height: 11 }} className="animate-spin" />
              : <RefreshCw style={{ width: 11, height: 11 }} />}
            Refresh
          </button>
        )}
      </div>

      {localNarrative ? (
        <NarrativeMarkdown text={localNarrative} />
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <p style={{ fontSize: 14, color: "var(--muted-ink)", margin: "4px 0", maxWidth: 540, lineHeight: 1.6 }}>
            Get a plain-English summary of this dataset — what it contains, the key
            patterns, and what to watch out for before trusting the numbers.
          </p>
          {datasetId && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{
                display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
                padding: "10px 20px", borderRadius: 999, fontSize: 13, fontWeight: 500,
                background: "linear-gradient(135deg, var(--brand), #8B6FF0)",
                border: "none", color: "#fff", cursor: "pointer",
                boxShadow: "var(--shadow-sm)",
                opacity: generating ? 0.7 : 1,
              }}
            >
              {generating
                ? <><Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> Writing summary…</>
                : <><Sparkles style={{ width: 13, height: 13 }} /> Summarize my data</>}
            </button>
          )}
        </div>
      )}

      {error && (
        <p style={{ fontSize: 12.5, color: "var(--danger)", marginTop: 10 }}>{error}</p>
      )}
    </div>
  );
}
