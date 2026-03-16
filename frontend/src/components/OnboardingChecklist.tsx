"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  FlaskConical,
  Sigma,
  TerminalSquare,
  Upload,
  Unplug,
  X,
} from "lucide-react";

const STORAGE_KEY = "sushi_onboarding_v2";

interface Step {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  href?: string;
}

const STEPS: Step[] = [
  {
    id: "upload",
    label: "Upload your first dataset",
    description: "Drop a CSV, Excel, Parquet, or JSON file to get started.",
    icon: Upload,
  },
  {
    id: "overview",
    label: "Explore the Overview",
    description: "Check the quality score, column types, and basic stats.",
    icon: BookOpen,
  },
  {
    id: "sql",
    label: "Run a SQL query",
    description: "Open the SQL Editor and query your data with DuckDB.",
    icon: TerminalSquare,
  },
  {
    id: "stats",
    label: "Run a statistical test",
    description: "Try a t-test, regression, or correlation in Statistics.",
    icon: Sigma,
  },
  {
    id: "transform",
    label: "Engineer a feature",
    description:
      "Apply a transform like log, normalize, or interaction product.",
    icon: FlaskConical,
  },
  {
    id: "monitor",
    label: "Create a monitor",
    description: "Set a quality threshold alert that runs on a schedule.",
    icon: Bell,
  },
  {
    id: "connect",
    label: "Connect a data source",
    description: "Link a PostgreSQL, S3, Google Sheets, or REST API connector.",
    icon: Unplug,
  },
  {
    id: "catalog",
    label: "Explore the Data Catalog",
    description: "Browse all your datasets and pipeline lineage.",
    icon: BookOpen,
    href: "/catalog",
  },
];

function loadDone(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDone(done: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(done)));
  } catch {}
}

interface Props {
  /** Pass current active section so we can auto-check steps */
  activeSection?: string;
  hasDataset?: boolean;
}

export function OnboardingChecklist({ activeSection, hasDataset }: Props) {
  const [done, setDone] = useState<Set<string>>(() => new Set());
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const doneRef = useRef(done);
  doneRef.current = done;

  useEffect(() => {
    const d = loadDone();
    setDone(d);
    setDismissed(!!localStorage.getItem("sushi_onboarding_dismissed"));
    setHydrated(true);
  }, []);

  // Auto-mark steps based on context
  useEffect(() => {
    if (!hydrated) return;
    const prev = doneRef.current;
    const next = new Set(prev);
    if (hasDataset) next.add("upload");
    if (
      hasDataset &&
      (activeSection === "overview" || activeSection === "columns")
    )
      next.add("overview");
    if (activeSection === "sql") next.add("sql");
    if (activeSection === "statistics") next.add("stats");
    if (activeSection === "transforms") next.add("transform");
    if (activeSection === "monitors") next.add("monitor");
    if (
      JSON.stringify(Array.from(next).sort()) !==
      JSON.stringify(Array.from(prev).sort())
    ) {
      setDone(next);
      saveDone(next);
    }
  }, [activeSection, hasDataset, hydrated]);

  const toggleDone = (id: string) => {
    const next = new Set(done);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDone(next);
    saveDone(next);
  };

  const dismiss = () => {
    try {
      localStorage.setItem("sushi_onboarding_dismissed", "1");
    } catch {}
    setDismissed(true);
  };

  if (!hydrated || dismissed) return null;

  const completedCount = STEPS.filter((s) => done.has(s.id)).length;
  const allDone = completedCount === STEPS.length;
  const pct = Math.round((completedCount / STEPS.length) * 100);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 200,
        width: open ? 320 : "auto",
        borderRadius: 16,
        background: "rgba(255,255,255,0.96)",
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.14)",
        overflow: "hidden",
        backdropFilter: "blur(20px)",
      }}
    >
      <style>{`@keyframes shimmer { 0%{background-position:0% 0} 100%{background-position:200% 0} }`}</style>

      {/* Iridescent stripe */}
      <div
        style={{
          height: 3,
          background:
            "linear-gradient(90deg, #9060f8, #e840c8, #00d4e8, #9060f8)",
          backgroundSize: "200% 100%",
          animation: "shimmer 4s linear infinite",
        }}
      />

      {/* Toggle button / header */}
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: open ? "12px 14px 10px" : "10px 14px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        {/* Progress ring */}
        <div
          style={{ position: "relative", width: 32, height: 32, flexShrink: 0 }}
        >
          <svg width={32} height={32} viewBox="0 0 32 32">
            <circle
              cx={16}
              cy={16}
              r={13}
              fill="none"
              stroke="rgba(0,0,0,0.06)"
              strokeWidth={4}
            />
            <circle
              cx={16}
              cy={16}
              r={13}
              fill="none"
              stroke={allDone ? "#22c55e" : "#9060f8"}
              strokeWidth={4}
              strokeDasharray={`${(81.7 * pct) / 100} 81.7`}
              strokeLinecap="round"
              transform="rotate(-90 16 16)"
            />
          </svg>
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 9,
              fontWeight: 700,
              color: "#111010",
            }}
          >
            {pct}%
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontWeight: 600,
              fontSize: 13,
              color: "#111010",
              margin: 0,
            }}
          >
            {allDone ? "🎉 All done!" : "Getting started"}
          </p>
          <p style={{ fontSize: 11, color: "#9a9690", margin: 0 }}>
            {completedCount}/{STEPS.length} steps completed
          </p>
        </div>

        {open ? (
          <ChevronDown size={14} style={{ color: "#9a9690", flexShrink: 0 }} />
        ) : (
          <ChevronUp size={14} style={{ color: "#9a9690", flexShrink: 0 }} />
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            dismiss();
          }}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#9a9690",
            padding: 2,
            flexShrink: 0,
          }}
        >
          <X size={12} />
        </button>
      </div>

      {/* Steps list */}
      {open && (
        <div style={{ maxHeight: 360, overflowY: "auto" }}>
          {STEPS.map((step) => {
            const isDone = done.has(step.id);
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                onClick={() => toggleDone(step.id)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "10px 14px",
                  borderTop: "1px solid rgba(0,0,0,0.04)",
                  cursor: "pointer",
                  background: isDone ? "rgba(34,197,94,0.04)" : "transparent",
                  transition: "background 0.15s",
                }}
              >
                {isDone ? (
                  <CheckCircle2
                    size={16}
                    style={{ color: "#22c55e", flexShrink: 0, marginTop: 1 }}
                  />
                ) : (
                  <Circle
                    size={16}
                    style={{ color: "#c8c4be", flexShrink: 0, marginTop: 1 }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 12.5,
                      fontWeight: isDone ? 400 : 600,
                      color: isDone ? "#9a9690" : "#111010",
                      textDecoration: isDone ? "line-through" : "none",
                      margin: 0,
                    }}
                  >
                    {step.label}
                  </p>
                  {!isDone && (
                    <p
                      style={{
                        fontSize: 11,
                        color: "#9a9690",
                        margin: "2px 0 0",
                      }}
                    >
                      {step.description}
                    </p>
                  )}
                </div>
                <Icon
                  size={13}
                  style={{
                    color: isDone ? "#c8c4be" : "#9060f8",
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                />
              </div>
            );
          })}

          {allDone && (
            <div
              style={{
                padding: "12px 14px",
                borderTop: "1px solid rgba(0,0,0,0.04)",
                textAlign: "center",
              }}
            >
              <p style={{ fontSize: 12, color: "#9a9690" }}>
                You&apos;re a Sushi pro 🍣 Dismiss to hide this panel.
              </p>
              <button
                onClick={dismiss}
                style={{
                  marginTop: 8,
                  padding: "6px 16px",
                  borderRadius: 8,
                  background: "linear-gradient(135deg, #9060f8, #e840c8)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
