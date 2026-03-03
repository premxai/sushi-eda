"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import {
  Play,
  Save,
  Clock,
  Trash2,
  ChevronDown,
  ChevronRight,
  Table2,
  Copy,
  Check,
  RotateCcw,
  BookOpen,
  Loader2,
} from "lucide-react";
import { fetchQuerySchema, runSQLQuery, QuerySchemaColumn, QueryResult } from "@/lib/api";

// Lazy-load CodeMirror (heavy — avoid SSR)
const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), { ssr: false });

const STORAGE_HISTORY_KEY = "sushi_sql_history";
const STORAGE_SAVED_KEY = "sushi_sql_saved";
const MAX_HISTORY = 50;

interface HistoryEntry {
  sql: string;
  ts: number;
  rows?: number;
  ms?: number;
}

interface SavedQuery {
  id: string;
  name: string;
  sql: string;
}

interface Props {
  datasetId?: string | null;
  orgId?: string;
}

const TYPE_COLOR: Record<string, string> = {
  Int8: "#3b82f6", Int16: "#3b82f6", Int32: "#3b82f6", Int64: "#3b82f6",
  UInt8: "#3b82f6", UInt16: "#3b82f6", UInt32: "#3b82f6", UInt64: "#3b82f6",
  Float32: "#8b5cf6", Float64: "#8b5cf6",
  Utf8: "#10b981", String: "#10b981",
  Boolean: "#f59e0b",
  Date: "#ec4899", Datetime: "#ec4899", Duration: "#ec4899",
};

function typeColor(dtype: string) {
  for (const [k, v] of Object.entries(TYPE_COLOR)) {
    if (dtype.startsWith(k)) return v;
  }
  return "#9a9690";
}

function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_HISTORY_KEY) ?? "[]"); }
  catch { return []; }
}
function saveHistory(h: HistoryEntry[]) {
  try { localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(h.slice(0, MAX_HISTORY))); }
  catch { /* quota */ }
}
function loadSaved(): SavedQuery[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_SAVED_KEY) ?? "[]"); }
  catch { return []; }
}
function saveSaved(s: SavedQuery[]) {
  try { localStorage.setItem(STORAGE_SAVED_KEY, JSON.stringify(s)); }
  catch { /* quota */ }
}

export function SQLQuerySection({ datasetId, orgId = "default" }: Props) {
  const [sql, setSql] = useState("SELECT *\nFROM df\nLIMIT 100");
  const [schema, setSchema] = useState<QuerySchemaColumn[]>([]);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [saved, setSaved] = useState<SavedQuery[]>([]);
  const [sidePanel, setSidePanel] = useState<"schema" | "history" | "saved">("schema");
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [copied, setCopied] = useState(false);
  const [limit, setLimit] = useState(1000);
  const [schemaOpen, setSchemaOpen] = useState(true);

  // Load extensions lazily to avoid SSR
  const [extensions, setExtensions] = useState<unknown[]>([]);
  const [theme, setTheme] = useState<unknown>(undefined);
  const runBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setHistory(loadHistory());
    setSaved(loadSaved());

    // Load CodeMirror extensions client-side
    async function loadExts() {
      const [{ sql: sqlLang }, { oneDark }] = await Promise.all([
        import("@codemirror/lang-sql"),
        import("@codemirror/theme-one-dark"),
      ]);
      setExtensions([sqlLang()]);
      setTheme(oneDark);
    }
    loadExts();
  }, []);

  useEffect(() => {
    if (!datasetId) return;
    fetchQuerySchema(datasetId, orgId)
      .then(setSchema)
      .catch(() => setSchema([]));
  }, [datasetId, orgId]);

  const handleRun = useCallback(async () => {
    if (!datasetId || !sql.trim()) return;
    setRunning(true);
    setError(null);
    const start = Date.now();
    try {
      const res = await runSQLQuery(datasetId, sql, limit, orgId);
      const ms = Date.now() - start;
      setResult({ ...res, execution_time_ms: ms });

      // Prepend to history
      const entry: HistoryEntry = { sql: sql.trim(), ts: Date.now(), rows: res.row_count, ms };
      const newHist = [entry, ...history.filter((h) => h.sql !== sql.trim())];
      setHistory(newHist);
      saveHistory(newHist);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      setError(err?.response?.data?.detail ?? err?.message ?? "Query failed");
      setResult(null);
    } finally {
      setRunning(false);
    }
  }, [datasetId, sql, limit, orgId, history]);

  // Ctrl+Enter to run
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        runBtnRef.current?.click();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function handleSaveQuery() {
    if (!saveName.trim()) return;
    const entry: SavedQuery = { id: Date.now().toString(), name: saveName.trim(), sql };
    const newSaved = [entry, ...saved];
    setSaved(newSaved);
    saveSaved(newSaved);
    setSaveName("");
    setShowSaveInput(false);
  }

  function handleDeleteSaved(id: string) {
    const newSaved = saved.filter((s) => s.id !== id);
    setSaved(newSaved);
    saveSaved(newSaved);
  }

  function handleClearHistory() {
    setHistory([]);
    saveHistory([]);
  }

  function handleCopyResults() {
    if (!result) return;
    const tsv = [result.columns.join("\t"), ...result.rows.map((r) => (r as unknown[]).join("\t"))].join("\n");
    navigator.clipboard.writeText(tsv).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  // Panel header button
  function PanelTab({ id, label }: { id: "schema" | "history" | "saved"; label: string }) {
    const active = sidePanel === id;
    return (
      <button
        onClick={() => setSidePanel(id)}
        style={{
          padding: "5px 10px", borderRadius: 7, fontSize: 12, fontWeight: active ? 500 : 400,
          color: active ? "#111010" : "#9a9690",
          background: active ? "rgba(144,96,248,0.1)" : "transparent",
          border: "none", cursor: "pointer", transition: "all 0.12s",
        }}
      >
        {label}
      </button>
    );
  }

  if (!datasetId) {
    return (
      <div style={{ textAlign: "center", padding: "80px 0" }}>
        <p style={{ fontSize: 14, color: "#9a9690" }}>No dataset loaded. Upload or open a dataset first.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 16, height: "calc(100vh - 120px)", overflow: "hidden" }}>

      {/* ── Left: Editor + Results ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, minWidth: 0, overflow: "hidden" }}>

        {/* Editor card */}
        <div style={{
          background: "rgba(255,255,255,0.72)",
          border: "1px solid rgba(255,255,255,0.8)",
          borderRadius: 16,
          boxShadow: "0 2px 16px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)",
          overflow: "hidden",
          flexShrink: 0,
        }}>
          {/* Toolbar */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 14px",
            borderBottom: "1px solid rgba(0,0,0,0.06)",
            background: "rgba(255,255,255,0.5)",
          }}>
            <span style={{
              fontSize: 9, fontFamily: "ui-monospace, Menlo, monospace",
              letterSpacing: "2px", textTransform: "uppercase", color: "#9a9690",
            }}>
              SQL Editor
            </span>
            <span style={{ fontSize: 10, color: "#c0bdb8", marginLeft: 2 }}>· table alias: df</span>

            <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
              {/* Limit selector */}
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 11, color: "#9a9690" }}>Limit</span>
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  style={{
                    padding: "3px 7px", borderRadius: 6, fontSize: 12,
                    border: "1px solid rgba(0,0,0,0.1)",
                    background: "rgba(255,255,255,0.8)",
                    color: "#111010", cursor: "pointer",
                  }}
                >
                  {[100, 500, 1000, 5000, 10000].map((n) => (
                    <option key={n} value={n}>{n.toLocaleString()}</option>
                  ))}
                </select>
              </div>

              {/* Save query */}
              <button
                onClick={() => setShowSaveInput((v) => !v)}
                title="Save query"
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 10px", borderRadius: 7, fontSize: 12,
                  border: "1px solid rgba(0,0,0,0.1)",
                  background: "rgba(255,255,255,0.8)",
                  color: "#6b6860", cursor: "pointer",
                }}
              >
                <Save style={{ width: 12, height: 12 }} />
                Save
              </button>

              {/* Run */}
              <button
                ref={runBtnRef}
                onClick={handleRun}
                disabled={running}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "5px 14px", borderRadius: 7, fontSize: 12, fontWeight: 500,
                  background: "linear-gradient(135deg, #9060f8, #e840c8)",
                  color: "white", border: "none", cursor: "pointer",
                  boxShadow: "0 2px 8px rgba(144,96,248,0.3)",
                  opacity: running ? 0.7 : 1,
                }}
              >
                {running
                  ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} />
                  : <Play style={{ width: 12, height: 12 }} />}
                Run
                <span style={{ fontSize: 10, opacity: 0.7 }}>⌘↵</span>
              </button>
            </div>
          </div>

          {/* Save-name input */}
          {showSaveInput && (
            <div style={{
              display: "flex", gap: 8, padding: "8px 14px",
              borderBottom: "1px solid rgba(0,0,0,0.06)",
              background: "rgba(144,96,248,0.04)",
            }}>
              <input
                autoFocus
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveQuery(); if (e.key === "Escape") setShowSaveInput(false); }}
                placeholder="Query name…"
                style={{
                  flex: 1, padding: "5px 10px", borderRadius: 7, fontSize: 12,
                  border: "1px solid rgba(0,0,0,0.1)",
                  background: "rgba(255,255,255,0.8)",
                  color: "#111010", outline: "none",
                }}
              />
              <button
                onClick={handleSaveQuery}
                disabled={!saveName.trim()}
                style={{
                  padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500,
                  background: "rgba(144,96,248,0.12)",
                  color: "#9060f8", border: "1px solid rgba(144,96,248,0.2)",
                  cursor: "pointer",
                }}
              >
                Save
              </button>
            </div>
          )}

          {/* CodeMirror editor */}
          <div style={{ fontSize: 13 }}>
            {extensions.length > 0 && theme ? (
              <CodeMirror
                value={sql}
                onChange={setSql}
                height="180px"
                // @ts-expect-error dynamic import type
                extensions={extensions}
                // @ts-expect-error dynamic import type
                theme={theme}
                style={{ fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace" }}
                basicSetup={{
                  lineNumbers: true,
                  highlightActiveLine: true,
                  highlightSelectionMatches: true,
                  bracketMatching: true,
                  autocompletion: true,
                  foldGutter: false,
                  dropCursor: false,
                  allowMultipleSelections: true,
                }}
              />
            ) : (
              <textarea
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                rows={7}
                style={{
                  width: "100%", padding: "12px 14px",
                  fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
                  fontSize: 13, lineHeight: 1.6,
                  border: "none", outline: "none", resize: "none",
                  background: "#282c34", color: "#abb2bf",
                  boxSizing: "border-box",
                }}
              />
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: "10px 14px", borderRadius: 12,
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.15)",
            display: "flex", gap: 8, alignItems: "flex-start",
          }}>
            <span style={{ color: "#ef4444", flexShrink: 0, fontSize: 13, fontWeight: 500 }}>Error</span>
            <p style={{ fontSize: 12, color: "#ef4444", fontFamily: "ui-monospace, Menlo, monospace", lineHeight: 1.5 }}>
              {error}
            </p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div style={{
            flex: 1, minHeight: 0, overflow: "hidden",
            background: "rgba(255,255,255,0.72)",
            border: "1px solid rgba(255,255,255,0.8)",
            borderRadius: 16,
            boxShadow: "0 2px 16px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)",
            display: "flex", flexDirection: "column",
          }}>
            {/* Result bar */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 16px",
              borderBottom: "1px solid rgba(0,0,0,0.06)",
              flexShrink: 0,
            }}>
              <Table2 style={{ width: 13, height: 13, color: "#9060f8" }} />
              <span style={{ fontSize: 12, color: "#6b6860" }}>
                <strong style={{ color: "#111010" }}>{result.row_count.toLocaleString()}</strong> rows
                {result.truncated && <span style={{ color: "#f59e0b", marginLeft: 4 }}>(truncated to {limit.toLocaleString()})</span>}
              </span>
              {result.execution_time_ms != null && (
                <span style={{ fontSize: 11, color: "#9a9690", marginLeft: 4 }}>
                  <Clock style={{ width: 10, height: 10, display: "inline", marginRight: 3, verticalAlign: "middle" }} />
                  {result.execution_time_ms}ms
                </span>
              )}
              <button
                onClick={handleCopyResults}
                title="Copy as TSV"
                style={{
                  marginLeft: "auto", display: "flex", alignItems: "center", gap: 5,
                  padding: "4px 10px", borderRadius: 7, fontSize: 11,
                  border: "1px solid rgba(0,0,0,0.1)",
                  background: "rgba(255,255,255,0.8)",
                  color: copied ? "#10b981" : "#6b6860",
                  cursor: "pointer",
                }}
              >
                {copied ? <Check style={{ width: 11, height: 11 }} /> : <Copy style={{ width: 11, height: 11 }} />}
                {copied ? "Copied!" : "Copy TSV"}
              </button>
            </div>

            {/* Table */}
            <div style={{ flex: 1, overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ position: "sticky", top: 0, background: "rgba(240,238,233,0.95)", zIndex: 1 }}>
                    {result.columns.map((col) => (
                      <th key={col} style={{
                        padding: "8px 14px", textAlign: "left",
                        fontFamily: "ui-monospace, Menlo, monospace",
                        fontSize: 11, fontWeight: 600, color: "#6b6860",
                        borderBottom: "1px solid rgba(0,0,0,0.08)",
                        whiteSpace: "nowrap",
                      }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(result.rows as unknown[][]).map((row, ri) => (
                    <tr key={ri} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                      {row.map((cell, ci) => (
                        <td key={ci} style={{
                          padding: "6px 14px",
                          color: cell === null ? "#c0bdb8" : "#111010",
                          fontStyle: cell === null ? "italic" : "normal",
                          maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {cell === null ? "null" : String(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!result && !error && !running && (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            background: "rgba(255,255,255,0.4)",
            border: "1.5px dashed rgba(0,0,0,0.1)",
            borderRadius: 16, padding: 40,
          }}>
            <TerminalSquare style={{ width: 32, height: 32, color: "rgba(144,96,248,0.3)", marginBottom: 12 }} />
            <p style={{ fontSize: 13.5, color: "#9a9690", marginBottom: 4 }}>Run a query to see results</p>
            <p style={{ fontSize: 12, color: "#c0bdb8" }}>Press <kbd style={{ fontFamily: "ui-monospace, Menlo, monospace", background: "rgba(0,0,0,0.06)", padding: "1px 5px", borderRadius: 4 }}>⌘↵</kbd> to execute</p>
          </div>
        )}
      </div>

      {/* ── Right: Side Panel ── */}
      <div style={{
        width: 240, flexShrink: 0,
        display: "flex", flexDirection: "column",
        background: "rgba(255,255,255,0.72)",
        border: "1px solid rgba(255,255,255,0.8)",
        borderRadius: 16,
        boxShadow: "0 2px 16px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)",
        overflow: "hidden",
      }}>
        {/* Tabs */}
        <div style={{
          display: "flex", gap: 2, padding: "8px 8px 0",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
        }}>
          <PanelTab id="schema" label="Schema" />
          <PanelTab id="history" label="History" />
          <PanelTab id="saved" label="Saved" />
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 10 }}>

          {/* ── Schema ── */}
          {sidePanel === "schema" && (
            <div>
              <button
                onClick={() => setSchemaOpen((v) => !v)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  width: "100%", padding: "6px 4px",
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: 600, color: "#6b6860",
                  fontFamily: "ui-monospace, Menlo, monospace",
                  letterSpacing: "0.05em", textTransform: "uppercase",
                }}
              >
                {schemaOpen ? <ChevronDown style={{ width: 11, height: 11 }} /> : <ChevronRight style={{ width: 11, height: 11 }} />}
                df ({schema.length} cols)
              </button>
              {schemaOpen && (
                <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingLeft: 8 }}>
                  {schema.map((col) => (
                    <div
                      key={col.name}
                      onClick={() => setSql((q) => q.includes(`"${col.name}"`) ? q : q.replace(/SELECT \*/, `SELECT "${col.name}"`))}
                      title={`Click to insert "${col.name}"`}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "4px 6px", borderRadius: 6, cursor: "pointer",
                      }}
                    >
                      <span style={{
                        fontFamily: "ui-monospace, Menlo, monospace",
                        fontSize: 11, color: "#111010",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
                      }}>
                        {col.name}
                      </span>
                      <span style={{
                        fontSize: 10, padding: "1px 5px", borderRadius: 4,
                        background: `${typeColor(col.dtype)}18`,
                        color: typeColor(col.dtype),
                        fontFamily: "ui-monospace, Menlo, monospace",
                        flexShrink: 0,
                      }}>
                        {col.dtype.split("(")[0]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── History ── */}
          {sidePanel === "history" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "#9a9690" }}>{history.length} queries</span>
                {history.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#9a9690", background: "none", border: "none", cursor: "pointer" }}
                  >
                    <RotateCcw style={{ width: 10, height: 10 }} /> Clear
                  </button>
                )}
              </div>
              {history.length === 0 && (
                <p style={{ fontSize: 12, color: "#c0bdb8", textAlign: "center", padding: "20px 0" }}>No history yet</p>
              )}
              {history.map((h, i) => (
                <div
                  key={i}
                  onClick={() => setSql(h.sql)}
                  style={{
                    padding: "7px 8px", borderRadius: 8, cursor: "pointer", marginBottom: 3,
                    background: "rgba(0,0,0,0.03)",
                    border: "1px solid rgba(0,0,0,0.05)",
                  }}
                >
                  <p style={{
                    fontSize: 11, fontFamily: "ui-monospace, Menlo, monospace",
                    color: "#6b6860", lineHeight: 1.4,
                    overflow: "hidden", display: "-webkit-box",
                    WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                  }}>
                    {h.sql}
                  </p>
                  <p style={{ fontSize: 10, color: "#9a9690", marginTop: 3 }}>
                    {h.rows != null ? `${h.rows.toLocaleString()} rows` : ""}
                    {h.ms != null ? ` · ${h.ms}ms` : ""}
                    {" · "}{new Date(h.ts).toLocaleTimeString()}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* ── Saved ── */}
          {sidePanel === "saved" && (
            <div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: "#9a9690" }}>{saved.length} saved</span>
              </div>
              {saved.length === 0 && (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <BookOpen style={{ width: 22, height: 22, color: "#d1cfc9", margin: "0 auto 8px" }} />
                  <p style={{ fontSize: 12, color: "#c0bdb8" }}>Use the Save button to bookmark queries</p>
                </div>
              )}
              {saved.map((s) => (
                <div
                  key={s.id}
                  style={{
                    padding: "8px 10px", borderRadius: 8, marginBottom: 4,
                    background: "rgba(0,0,0,0.03)",
                    border: "1px solid rgba(0,0,0,0.05)",
                    display: "flex", alignItems: "flex-start", gap: 6,
                    cursor: "pointer",
                  }}
                  onClick={() => setSql(s.sql)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: "#111010", marginBottom: 2 }}>{s.name}</p>
                    <p style={{
                      fontSize: 10, fontFamily: "ui-monospace, Menlo, monospace",
                      color: "#9a9690", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {s.sql.replace(/\s+/g, " ").slice(0, 50)}…
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteSaved(s.id); }}
                    style={{ padding: 4, border: "none", background: "none", cursor: "pointer", color: "#d1cfc9", flexShrink: 0 }}
                  >
                    <Trash2 style={{ width: 11, height: 11 }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Needed for the no-result empty state icon
function TerminalSquare(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <polyline points="8 10 12 14 8 18" />
      <line x1="14" y1="18" x2="16" y2="18" />
    </svg>
  );
}
