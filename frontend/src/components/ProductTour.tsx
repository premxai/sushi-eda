"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart2,
  Bell,
  ChevronRight,
  FlaskConical,
  Share2,
  Sparkles,
  TerminalSquare,
  Upload,
  X,
} from "lucide-react";

const TOUR_KEY = "sushi_tour_v2_done";

const STEPS = [
  {
    icon: Upload,
    accent: "#9060f8",
    title: "Drop your data, get instant insights",
    description:
      "Upload CSV, Excel, JSON, Parquet, or SQLite — up to 100 MB. Sushi runs a full EDA in seconds: quality score, column stats, outliers, and a plain-English narrative.",
  },
  {
    icon: Sparkles,
    accent: "#e840c8",
    title: "AI that reads your data for you",
    description:
      "Ask questions in natural language — Sushi writes and runs the SQL. Get AI-powered cleaning suggestions and column explanations, all credit-metered per org.",
  },
  {
    icon: TerminalSquare,
    accent: "#9060f8",
    title: "SQL Editor powered by DuckDB",
    description:
      "Write ad-hoc SQL directly against your dataset. Results render in a live table with column types. Save and re-run queries from history.",
  },
  {
    icon: BarChart2,
    accent: "#00d4e8",
    title: "Statistics, Visualizations & Feature Engineering",
    description:
      "Run t-tests, regressions, and correlations. Generate 10+ chart types. Apply log transforms, normalization, lag features, and interaction products — no code needed.",
  },
  {
    icon: Bell,
    accent: "#f97316",
    title: "Monitors & drift alerts",
    description:
      "Set thresholds on row count, null rates, quality score, or column drift. Monitors run on a schedule and alert you the moment something changes.",
  },
  {
    icon: FlaskConical,
    accent: "#e840c8",
    title: "Data Connectors & Catalog",
    description:
      "Connect PostgreSQL, Google Sheets, S3, or REST APIs. Browse all your datasets in the Data Catalog with pipeline lineage and profile snapshots.",
  },
  {
    icon: Share2,
    accent: "#22c55e",
    title: "Share reports with one link",
    description:
      "Generate a shareable link anyone can view — no login required. Export as PDF, Markdown, or JSON. Perfect for clients and teammates.",
  },
];

interface ProductTourProps {
  onDismiss?: () => void;
}

export function ProductTour({ onDismiss }: ProductTourProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem(TOUR_KEY)) {
      const t = setTimeout(() => setVisible(true), 900);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(TOUR_KEY, "1");
    setVisible(false);
    onDismiss?.();
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else dismiss();
  };

  if (!visible) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      {/* Backdrop */}
      <div
        onClick={dismiss}
        style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.35)",
          backdropFilter: "blur(6px)",
        }}
      />

      {/* Modal */}
      <div style={{
        position: "relative",
        width: "100%", maxWidth: 440,
        borderRadius: 20,
        background: "rgba(255,255,255,0.97)",
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.18)",
        overflow: "hidden",
      }}>
        <style>{`@keyframes shimmer { 0%{background-position:0% 0} 100%{background-position:200% 0} }`}</style>

        {/* Iridescent top stripe */}
        <div style={{
          height: 3,
          background: "linear-gradient(90deg, #9060f8, #e840c8, #00d4e8, #9060f8)",
          backgroundSize: "200% 100%",
          animation: "shimmer 4s linear infinite",
        }} />

        {/* Close */}
        <button
          onClick={dismiss}
          style={{
            position: "absolute", top: 14, right: 14,
            background: "none", border: "none", cursor: "pointer",
            color: "#9a9690", padding: 4, borderRadius: 8,
          }}
        >
          <X size={16} />
        </button>

        <div style={{ padding: "20px 24px 24px" }}>
          {/* Step dots */}
          <div style={{ display: "flex", gap: 5, marginBottom: 20 }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                style={{
                  height: 4, borderRadius: 99,
                  transition: "all 0.3s",
                  width: i === step ? 24 : 8,
                  background: i <= step ? current.accent : "rgba(0,0,0,0.1)",
                }}
              />
            ))}
          </div>

          {/* Icon */}
          <div style={{
            display: "inline-flex", padding: 12, borderRadius: 14, marginBottom: 16,
            background: `${current.accent}18`,
          }}>
            <Icon size={24} style={{ color: current.accent }} />
          </div>

          {/* Content */}
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111010", margin: "0 0 8px", lineHeight: 1.3 }}>
            {current.title}
          </h2>
          <p style={{ fontSize: 13.5, color: "#6b6860", lineHeight: 1.6, margin: 0 }}>
            {current.description}
          </p>

          {/* Step indicator */}
          <p style={{
            fontSize: 11, color: "#c8c4be", marginTop: 12,
            fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
          }}>
            {step + 1} / {STEPS.length}
          </p>

          {/* Actions */}
          <div style={{ marginTop: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button
              onClick={dismiss}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 12, color: "#9a9690",
              }}
            >
              Skip tour
            </button>

            <button
              onClick={next}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "9px 18px", borderRadius: 10,
                background: `linear-gradient(135deg, ${current.accent}, ${isLast ? "#22c55e" : "#e840c8"})`,
                color: "#fff", fontSize: 13, fontWeight: 600,
                border: "none", cursor: "pointer",
              }}
            >
              {isLast ? "Get started" : "Next"}
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
