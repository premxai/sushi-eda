"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Send, Bot, User, Code2, Table, Loader2, Sparkles } from "lucide-react";
import { askDataset, ChatMessage, ChatResult } from "@/lib/api";

interface AIChatPanelProps {
  datasetId: string;
  orgId?: string;
}

interface Turn {
  role: "user" | "assistant";
  content: string;
  sql?: string | null;
  results?: ChatResult["results"];
  error?: string | null;
}

const SUGGESTED_QUESTIONS = [
  "What are the top 5 values by count?",
  "Show me the average and max of each numeric column",
  "Which rows have the most missing values?",
  "Find the correlation between numeric columns",
];

export default function AIChatPanel({ datasetId, orgId = "default" }: AIChatPanelProps) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSQL, setShowSQL] = useState<Record<number, boolean>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, loading]);

  const history: ChatMessage[] = turns.map((t) => ({
    role: t.role,
    content: t.content,
  }));

  async function send(question: string) {
    if (!question.trim() || loading) return;
    const q = question.trim();
    setInput("");
    setTurns((prev) => [...prev, { role: "user", content: q }]);
    setLoading(true);

    try {
      const result = await askDataset(datasetId, q, history, orgId);
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.answer,
          sql: result.sql,
          results: result.results,
          error: result.error,
        },
      ]);
    } catch (err: any) {
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
          error: err?.response?.data?.detail || "Unknown error",
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  function toggleSQL(idx: number) {
    setShowSQL((prev) => ({ ...prev, [idx]: !prev[idx] }));
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-neutral-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-100 bg-neutral-50">
        <Sparkles className="h-4 w-4 text-violet-500" />
        <span className="text-sm font-semibold text-neutral-800">Ask Your Data</span>
        <span className="ml-auto text-xs text-neutral-400">Powered by Claude</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {turns.length === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-neutral-500 text-center py-4">
              Ask any question about your dataset in plain English.
            </p>
            <div className="grid grid-cols-1 gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-left text-xs px-3 py-2 rounded-lg border border-neutral-200
                             text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300
                             transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn, idx) => (
          <div key={idx} className={`flex gap-3 ${turn.role === "user" ? "justify-end" : "justify-start"}`}>
            {turn.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="h-4 w-4 text-violet-600" />
              </div>
            )}

            <div className={`max-w-[85%] space-y-2 ${turn.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
              <div
                className={`rounded-2xl px-3 py-2 text-sm ${
                  turn.role === "user"
                    ? "bg-neutral-900 text-white rounded-tr-sm"
                    : "bg-neutral-100 text-neutral-800 rounded-tl-sm"
                }`}
              >
                {turn.content}
              </div>

              {/* SQL toggle */}
              {turn.sql && (
                <button
                  onClick={() => toggleSQL(idx)}
                  className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
                >
                  <Code2 className="h-3 w-3" />
                  {showSQL[idx] ? "Hide SQL" : "Show SQL"}
                </button>
              )}
              {turn.sql && showSQL[idx] && (
                <pre className="text-xs bg-neutral-900 text-green-400 rounded-lg px-3 py-2 overflow-x-auto w-full">
                  {turn.sql}
                </pre>
              )}

              {/* Results table */}
              {turn.results && turn.results.row_count > 0 && (
                <div className="w-full">
                  <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1">
                    <Table className="h-3 w-3" />
                    {turn.results.row_count} row{turn.results.row_count !== 1 ? "s" : ""}
                    {turn.results.truncated && " (truncated)"}
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-neutral-200 text-xs">
                    <table className="w-full">
                      <thead className="bg-neutral-50">
                        <tr>
                          {turn.results.columns.map((col) => (
                            <th key={col} className="px-2 py-1.5 text-left font-medium text-neutral-600 whitespace-nowrap">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {turn.results.rows.slice(0, 10).map((row, ri) => (
                          <tr key={ri} className="border-t border-neutral-100">
                            {row.map((cell, ci) => (
                              <td key={ci} className="px-2 py-1.5 text-neutral-700 whitespace-nowrap">
                                {cell === null ? <span className="text-neutral-300">null</span> : String(cell)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {turn.error && (
                <p className="text-xs text-red-500">{turn.error}</p>
              )}
            </div>

            {turn.role === "user" && (
              <div className="w-7 h-7 rounded-full bg-neutral-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="h-4 w-4 text-neutral-600" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
              <Bot className="h-4 w-4 text-violet-600" />
            </div>
            <div className="bg-neutral-100 rounded-2xl rounded-tl-sm px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-neutral-100 px-3 py-3">
        <div className="flex items-end gap-2 bg-neutral-50 rounded-xl border border-neutral-200 px-3 py-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask a question about your data…"
            rows={1}
            className="flex-1 bg-transparent text-sm text-neutral-800 placeholder-neutral-400
                       resize-none outline-none max-h-32 overflow-y-auto"
            style={{ minHeight: "24px" }}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center
                       text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity
                       hover:bg-neutral-700"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-neutral-400 mt-1 text-center">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
