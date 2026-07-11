"use client";

import React, { useMemo, useRef, useState } from "react";
import { CornerDownLeft, Loader2, MessageSquareText, Sparkles } from "lucide-react";
import { askDataset, ChatMessage, getApiErrorMessage, isRateLimitError } from "@/lib/api";
import { ColumnAnalysis } from "@/lib/types";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Disclosure } from "@/components/common/Disclosure";
import { EmptyState } from "@/components/common/EmptyState";
import { ReportSectionHeading } from "@/components/report/ReportSectionHeading";

interface Turn {
  role: "user" | "assistant";
  content: string;
  sql?: string | null;
  results?: { columns: string[]; rows: (string | number | null)[][] } | null;
  isError?: boolean;
}

interface AskDataSectionProps {
  datasetId: string | null;
  columns: ColumnAnalysis[];
}

/** Maps raw backend error strings to calm, user-facing copy. Never show
 * a bare technical message like "AI not configured" in the chat. */
function friendlyChatError(raw: string): string {
  const normalized = raw.toLowerCase();
  if (normalized.includes("not configured") || normalized.includes("api key") || normalized.includes("unavailable")) {
    return "Ask Your Data isn't set up in this environment yet. The rest of the report is still fully available.";
  }
  return "Couldn't turn that into an answer. Try rephrasing the question, or ask something simpler to start.";
}

function suggestedQuestions(columns: ColumnAnalysis[]): string[] {
  const numeric = columns.find((c) => c.is_numeric);
  const categorical = columns.find((c) => !c.is_numeric);
  const questions: string[] = [];
  if (numeric) questions.push(`What's the average ${numeric.name}?`);
  if (categorical) questions.push(`Which ${categorical.name} appears most often?`);
  if (numeric && categorical) questions.push(`How does ${numeric.name} differ by ${categorical.name}?`);
  questions.push("What stands out in this data?");
  return questions.slice(0, 4);
}

export function AskDataSection({ datasetId, columns }: AskDataSectionProps) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const suggestions = useMemo(() => suggestedQuestions(columns), [columns]);

  const send = async (question: string) => {
    if (!datasetId || !question.trim() || loading) return;
    setError(null);
    setInput("");
    const history: ChatMessage[] = turns.map((t) => ({ role: t.role, content: t.content }));
    setTurns((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);
    try {
      const result = await askDataset(datasetId, question, history);
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.error ? friendlyChatError(result.error) : result.answer,
          sql: result.sql,
          results: result.results ? { columns: result.results.columns, rows: result.results.rows } : null,
          isError: Boolean(result.error),
        },
      ]);
    } catch (err) {
      if (isRateLimitError(err)) {
        setRateLimited(true);
      } else {
        setError(getApiErrorMessage(err, "Couldn't get an answer right now."));
      }
    } finally {
      setLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));
    }
  };

  if (!datasetId) {
    return <EmptyState icon={MessageSquareText} title="Ask Your Data isn't available" description="This dataset can't be queried right now." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <ReportSectionHeading icon={MessageSquareText} eyebrow="Conversational analysis" title="Ask your data anything." description="Use plain English to explore the table. Sushi will return an answer and show how it was computed." />

      {rateLimited && (
        <Alert tone="warning" title="You've reached today's question limit">
          The rest of the report is still available. Try again tomorrow, or explore Charts &amp; Trends and Field Health in the meantime.
        </Alert>
      )}
      {error && <Alert tone="danger">{error}</Alert>}

      {turns.length === 0 && !rateLimited && (
        <div className="rounded-lg border border-dashed border-border-strong bg-surface-2/40 p-5">
          <p className="mb-3 text-[13px] text-ink-secondary">Try one of these, or type your own question below.</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="rounded-full border border-border bg-surface px-3 py-1.5 text-[12.5px] text-ink-secondary hover:border-brand/40 hover:text-brand"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {turns.length > 0 && (
        <div ref={scrollRef} className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto scrollbar-thin">
          {turns.map((turn, i) =>
            turn.role === "user" ? (
              <div key={i} className="ml-auto max-w-[80%] rounded-lg bg-ink px-3.5 py-2 text-[13.5px] text-paper">
                {turn.content}
              </div>
            ) : (
              <div key={i} className={`max-w-[85%] rounded-lg border px-3.5 py-2.5 text-[13.5px] ${turn.isError ? "border-danger/25 bg-danger-weak text-ink" : "border-border bg-surface text-ink"}`}>
                <p className="flex items-start gap-1.5">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                  <span>{turn.content}</span>
                </p>
                {turn.sql && (
                  <Disclosure summary="How was this computed?" className="mt-2.5">
                    <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[12px] text-ink-secondary">{turn.sql}</pre>
                    {turn.results && turn.results.rows.length > 0 && (
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full text-[11.5px]">
                          <thead>
                            <tr>
                              {turn.results.columns.map((c) => (
                                <th key={c} className="border-b border-border px-2 py-1 text-left font-medium text-ink-tertiary">
                                  {c}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {turn.results.rows.slice(0, 10).map((row, ri) => (
                              <tr key={ri}>
                                {row.map((cell, ci) => (
                                  <td key={ci} className="border-b border-border/60 px-2 py-1 text-ink-secondary">
                                    {cell ?? "-"}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Disclosure>
                )}
              </div>
            ),
          )}
          {loading && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[13px] text-ink-secondary">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" /> Reading through your data…
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Ask a question about this data…"
          rows={1}
          disabled={rateLimited || loading}
          className="flex-1"
        />
        <Button type="submit" disabled={rateLimited || loading || !input.trim()} size="md">
          <CornerDownLeft className="h-3.5 w-3.5" /> Ask
        </Button>
      </form>
    </div>
  );
}
