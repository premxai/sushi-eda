"use client";

import React, { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { ChevronLeft, ChevronRight, History, Loader2, Play, ShieldCheck, Table2, Terminal } from "lucide-react";
import { explainSQLQuery, fetchQuerySchema, getApiErrorMessage, QueryResult, QuerySchemaColumn, runSQLQuery } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Disclosure } from "@/components/common/Disclosure";
import { EmptyState } from "@/components/common/EmptyState";
import { cn } from "@/lib/utils";
import { ReportSectionHeading } from "@/components/report/ReportSectionHeading";

interface SqlEditorSectionProps {
  datasetId: string | null;
}

const DEFAULT_SQL = "SELECT *\nFROM df\nLIMIT 100";
const PAGE_SIZE = 100;
const HISTORY_LIMIT = 15;

export function SqlEditorSection({ datasetId }: SqlEditorSectionProps) {
  const [schema, setSchema] = useState<QuerySchemaColumn[] | null>(null);
  const [query, setQuery] = useState(DEFAULT_SQL);
  const [history, setHistory] = useState<string[]>([]);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!datasetId) return;
    let cancelled = false;
    fetchQuerySchema(datasetId)
      .then((s) => {
        if (!cancelled) setSchema(s);
      })
      .catch(() => {
        if (!cancelled) setSchema([]);
      });
    return () => {
      cancelled = true;
    };
  }, [datasetId]);

  const runQuery = async (sqlText: string, nextOffset: number) => {
    if (!datasetId || !sqlText.trim()) return;
    setLoading(true);
    setError(null);
    setPlan(null);
    try {
      const res = await runSQLQuery(datasetId, sqlText, PAGE_SIZE, nextOffset);
      setResult(res);
      setOffset(nextOffset);
      if (nextOffset === 0) {
        setHistory((prev) => [sqlText, ...prev.filter((q) => q !== sqlText)].slice(0, HISTORY_LIMIT));
      }
    } catch (err) {
      setError(getApiErrorMessage(err, "That query didn't run. Check the syntax and try again."));
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExplain = async () => {
    if (!datasetId || !query.trim()) return;
    setExplaining(true);
    setError(null);
    try {
      const res = await explainSQLQuery(datasetId, query);
      setPlan(res.plan);
    } catch (err) {
      setError(getApiErrorMessage(err, "Couldn't generate an EXPLAIN plan for this query."));
    } finally {
      setExplaining(false);
    }
  };

  if (!datasetId) {
    return <EmptyState icon={Terminal} title="Advanced Queries isn't available" description="This dataset can't be queried right now." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <ReportSectionHeading icon={Terminal} eyebrow="Data workbench" title="Query with precision." description="Use read-only SQL to explore the dataset directly, with schema guidance and a safe execution limit." />

      <Alert tone="info">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" /> Safe to experiment: read-only <code className="font-mono">SELECT</code> queries only, capped at 10,000 rows, and cancelled after 20
          seconds. Your dataset is available as a table named <code className="font-mono">df</code>.
        </span>
      </Alert>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border border-border bg-surface p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">
              <Table2 className="h-3.5 w-3.5" /> Schema
            </div>
            {schema == null ? (
              <p className="text-[12px] text-ink-tertiary">Loading…</p>
            ) : schema.length === 0 ? (
              <p className="text-[12px] text-ink-tertiary">No schema available.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {schema.map((col) => (
                  <div key={col.name} className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="truncate font-mono text-ink">{col.name}</span>
                    <span className="shrink-0 text-ink-tertiary">{col.dtype}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {history.length > 0 && (
            <div className="rounded-lg border border-border bg-surface p-3">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">
                <History className="h-3.5 w-3.5" /> History
              </div>
              <div className="flex flex-col gap-1">
                {history.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => setQuery(q)}
                    className="truncate rounded-sm px-1.5 py-1 text-left font-mono text-[11.5px] text-ink-secondary hover:bg-surface-2"
                    title={q}
                  >
                    {q.replace(/\s+/g, " ")}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-lg border border-border-strong">
            <CodeMirror value={query} height="160px" theme={oneDark} extensions={[sql()]} onChange={(v) => setQuery(v)} basicSetup={{ lineNumbers: true, foldGutter: false }} />
          </div>

          <div className="flex items-center justify-between">
            <button onClick={handleExplain} disabled={explaining || !query.trim()} className="text-[12px] text-ink-tertiary hover:text-ink-secondary disabled:opacity-50">
              {explaining ? "Explaining…" : "Explain query plan"}
            </button>
            <Button size="sm" onClick={() => runQuery(query, 0)} disabled={loading || !query.trim()}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Run
            </Button>
          </div>

          {error && <Alert tone="danger">{error}</Alert>}

          {plan && (
            <Disclosure summary="EXPLAIN plan" defaultOpen>
              <pre className="overflow-x-auto whitespace-pre font-mono text-[11.5px] text-ink-secondary">{plan}</pre>
            </Disclosure>
          )}

          {result && (
            <div className="rounded-lg border border-border bg-surface">
              {result.rows.length === 0 ? (
                <EmptyState className="border-0" icon={Table2} title="No rows" description="This query ran successfully but returned no rows." />
              ) : (
                <>
                  <div className="max-h-96 overflow-auto">
                    <table className="w-full border-collapse text-[12.5px]">
                      <thead className="sticky top-0 border-b border-border bg-surface">
                        <tr>
                          {result.columns.map((c) => (
                            <th key={c} className="whitespace-nowrap px-3 py-2 text-left font-mono text-[11px] font-semibold text-ink-tertiary">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.map((row, ri) => (
                          <tr key={ri} className="border-b border-border/60 last:border-0">
                            {row.map((cell, ci) => (
                              <td key={ci} className="whitespace-nowrap px-3 py-1.5 text-ink-secondary">
                                {cell === null || cell === undefined ? <span className="text-ink-tertiary">-</span> : String(cell)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[12px] text-ink-tertiary">
                    <span>
                      Rows {offset + 1}–{offset + result.rows.length}
                      {result.truncated ? " (capped)" : ""}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => runQuery(query, Math.max(0, offset - PAGE_SIZE))}
                        disabled={offset === 0 || loading}
                        className={cn("rounded p-1 hover:bg-surface-2", (offset === 0 || loading) && "opacity-40")}
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => runQuery(query, offset + PAGE_SIZE)}
                        disabled={!result.has_more || loading}
                        className={cn("rounded p-1 hover:bg-surface-2", (!result.has_more || loading) && "opacity-40")}
                        aria-label="Next page"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
