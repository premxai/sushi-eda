"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Database, Github } from "lucide-react";
import UploadCard from "@/components/UploadCard";

interface LandingPageProps {
  onFileAccepted: (file: File) => void;
  onTryDemo: () => void;
  isDemoLoading: boolean;
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
  onClearError: () => void;
  isSignedIn?: boolean;
}

export function LandingPage({
  onFileAccepted,
  onTryDemo,
  isDemoLoading,
  isUploading,
  uploadProgress,
  error,
  onClearError,
  isSignedIn = false,
}: LandingPageProps) {
  // Scroll-reveal observer
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        }),
      { threshold: 0.08 },
    );
    document.querySelectorAll(".lp-reveal").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <div className="lp-root">
      {/* ── NAV ── */}
      <nav className="lp-nav" style={{ background: "rgba(240,238,233,0.88)" }}>
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            textDecoration: "none",
          }}
        >
          <div className="lp-logo-icon">
            <Image src="/sushi-logo.png" alt="Sushi" width={22} height={22} />
          </div>
          <span
            style={{
              fontWeight: 600,
              fontSize: 17,
              color: "#111010",
              letterSpacing: "-0.3px",
            }}
          >
            Sushi
          </span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <a
            href="https://github.com/premxai/sushi-eda"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              fontSize: 13.5,
              color: "#6b6860",
              textDecoration: "none",
              borderRadius: 7,
              border: "1px solid rgba(0,0,0,0.1)",
            }}
          >
            <Github size={14} />
            GitHub
          </a>

          <SignedOut>
            <Link
              href="/sign-in"
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 400,
                color: "#111010",
                textDecoration: "none",
                border: "1px solid rgba(0,0,0,0.1)",
              }}
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 500,
                background: "linear-gradient(135deg, #9060f8, #e840c8)",
                color: "#fff",
                textDecoration: "none",
                boxShadow: "0 2px 12px rgba(144,96,248,0.35)",
              }}
            >
              Get started
            </Link>
          </SignedOut>

          <SignedIn>
            <Link
              href="/datasets"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                fontSize: 13.5,
                color: "#6b6860",
                textDecoration: "none",
                borderRadius: 7,
              }}
            >
              <Database size={14} />
              My Datasets
            </Link>
            <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
          </SignedIn>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="lp-hero">
        <div className="lp-badge">
          <div className="lp-badge-dot">✦</div>
          AI-powered insights — no code required
        </div>

        <h1 className="lp-h1">
          Serve your raw data.
          <br />
          <em>Analyze perfectly.</em>
        </h1>

        <p className="lp-sub">
          Drop a file. Get instant quality scores, column stats, outlier
          detection, AI narrative, and shareable reports.
        </p>

        {/* Actual upload card */}
        <UploadCard
          onFileAccepted={onFileAccepted}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
          error={error}
          onClearError={onClearError}
          onLoadSample={onTryDemo}
          isSignedIn={isSignedIn}
        />
      </section>

      {/* ── CINEMATIC DATA FLOW ── */}
      <section className="lp-cinema-section lp-reveal">
        {/* Section label */}
        <div className="lp-cinema-eyebrow">
          <span className="lp-cinema-dot" />
          Raw files in · Instant insights out
        </div>

        <div className="lp-cinema-stage">
          {/* ── LEFT: Files flowing in ── */}
          <div className="lp-cinema-side lp-cinema-left">
            {/* Row A – scrolls toward center */}
            <div className="lp-marquee-wrap">
              <div className="lp-marquee-track lp-marquee-fwd">
                {[
                  { ext: "CSV", label: "sales_2024.csv", size: "12 MB", cls: "lp-ext-csv" },
                  { ext: "PARQ", label: "users.parquet", size: "38 MB", cls: "lp-ext-parq" },
                  { ext: "XLSX", label: "inventory.xlsx", size: "9 MB", cls: "lp-ext-xlsx" },
                  { ext: "JSON", label: "events_log.json", size: "4 MB", cls: "lp-ext-json" },
                  { ext: "TSV", label: "metrics.tsv", size: "2 MB", cls: "lp-ext-tsv" },
                  { ext: "CSV", label: "orders_q4.csv", size: "7 MB", cls: "lp-ext-csv" },
                  { ext: "PARQ", label: "clickstream.parquet", size: "51 MB", cls: "lp-ext-parq" },
                  // duplicate for seamless loop
                  { ext: "CSV", label: "sales_2024.csv", size: "12 MB", cls: "lp-ext-csv" },
                  { ext: "PARQ", label: "users.parquet", size: "38 MB", cls: "lp-ext-parq" },
                  { ext: "XLSX", label: "inventory.xlsx", size: "9 MB", cls: "lp-ext-xlsx" },
                  { ext: "JSON", label: "events_log.json", size: "4 MB", cls: "lp-ext-json" },
                  { ext: "TSV", label: "metrics.tsv", size: "2 MB", cls: "lp-ext-tsv" },
                  { ext: "CSV", label: "orders_q4.csv", size: "7 MB", cls: "lp-ext-csv" },
                  { ext: "PARQ", label: "clickstream.parquet", size: "51 MB", cls: "lp-ext-parq" },
                ].map((f, i) => (
                  <div key={i} className="lp-cinema-chip lp-chip-file">
                    <span className={`lp-ext ${f.cls}`}>{f.ext}</span>
                    <span className="lp-chip-name">{f.label}</span>
                    <span className="lp-chip-size">{f.size}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Row B – scrolls reverse */}
            <div className="lp-marquee-wrap">
              <div className="lp-marquee-track lp-marquee-rev">
                {[
                  { ext: "XLSX", label: "customers.xlsx", size: "6 MB", cls: "lp-ext-xlsx" },
                  { ext: "CSV", label: "products.csv", size: "3 MB", cls: "lp-ext-csv" },
                  { ext: "PARQ", label: "sessions.parquet", size: "22 MB", cls: "lp-ext-parq" },
                  { ext: "JSON", label: "api_logs.json", size: "8 MB", cls: "lp-ext-json" },
                  { ext: "CSV", label: "revenue_2025.csv", size: "14 MB", cls: "lp-ext-csv" },
                  { ext: "TSV", label: "analytics.tsv", size: "5 MB", cls: "lp-ext-tsv" },
                  { ext: "XLSX", label: "budget.xlsx", size: "1 MB", cls: "lp-ext-xlsx" },
                  // duplicate
                  { ext: "XLSX", label: "customers.xlsx", size: "6 MB", cls: "lp-ext-xlsx" },
                  { ext: "CSV", label: "products.csv", size: "3 MB", cls: "lp-ext-csv" },
                  { ext: "PARQ", label: "sessions.parquet", size: "22 MB", cls: "lp-ext-parq" },
                  { ext: "JSON", label: "api_logs.json", size: "8 MB", cls: "lp-ext-json" },
                  { ext: "CSV", label: "revenue_2025.csv", size: "14 MB", cls: "lp-ext-csv" },
                  { ext: "TSV", label: "analytics.tsv", size: "5 MB", cls: "lp-ext-tsv" },
                  { ext: "XLSX", label: "budget.xlsx", size: "1 MB", cls: "lp-ext-xlsx" },
                ].map((f, i) => (
                  <div key={i} className="lp-cinema-chip lp-chip-file">
                    <span className={`lp-ext ${f.cls}`}>{f.ext}</span>
                    <span className="lp-chip-name">{f.label}</span>
                    <span className="lp-chip-size">{f.size}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── CENTER ENGINE ── */}
          <div className="lp-cinema-engine">
            <div className="lp-engine-orbit lp-orbit-1" />
            <div className="lp-engine-orbit lp-orbit-2" />
            <div className="lp-engine-glow" />
            <div className="lp-engine-body">
              <Image src="/sushi-logo.png" alt="Sushi" width={36} height={36} />
            </div>
            <div className="lp-engine-pulse" />
            {/* Beam lines */}
            <div className="lp-engine-beam lp-beam-left" />
            <div className="lp-engine-beam lp-beam-right" />
            {/* Label below */}
            <div className="lp-engine-tag">
              <span className="lp-engine-tag-dot" />
              Sushi Engine
            </div>
          </div>

          {/* ── RIGHT: Insights flowing out ── */}
          <div className="lp-cinema-side lp-cinema-right">
            {/* Row A */}
            <div className="lp-marquee-wrap">
              <div className="lp-marquee-track lp-marquee-rev">
                {[
                  { icon: "◈", label: "Quality Score", value: "98 / 100", accent: "#00e8a0" },
                  { icon: "⊞", label: "154,321 rows", value: "23 columns", accent: "#9060f8" },
                  { icon: "◉", label: "Anomalies", value: "0.05%", accent: "#e840c8" },
                  { icon: "⌬", label: "Null rate", value: "0.8%", accent: "#00d4e8" },
                  { icon: "◈", label: "Completeness", value: "99.2%", accent: "#00e8a0" },
                  { icon: "⊞", label: "Correlations", value: "8 strong", accent: "#9060f8" },
                  { icon: "◉", label: "Outliers", value: "12 flagged", accent: "#e840c8" },
                  // duplicate
                  { icon: "◈", label: "Quality Score", value: "98 / 100", accent: "#00e8a0" },
                  { icon: "⊞", label: "154,321 rows", value: "23 columns", accent: "#9060f8" },
                  { icon: "◉", label: "Anomalies", value: "0.05%", accent: "#e840c8" },
                  { icon: "⌬", label: "Null rate", value: "0.8%", accent: "#00d4e8" },
                  { icon: "◈", label: "Completeness", value: "99.2%", accent: "#00e8a0" },
                  { icon: "⊞", label: "Correlations", value: "8 strong", accent: "#9060f8" },
                  { icon: "◉", label: "Outliers", value: "12 flagged", accent: "#e840c8" },
                ].map((c, i) => (
                  <div key={i} className="lp-cinema-chip lp-chip-insight">
                    <span className="lp-chip-icon" style={{ color: c.accent }}>{c.icon}</span>
                    <span className="lp-chip-name">{c.label}</span>
                    <span className="lp-chip-val" style={{ color: c.accent }}>{c.value}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Row B */}
            <div className="lp-marquee-wrap">
              <div className="lp-marquee-track lp-marquee-fwd">
                {[
                  { icon: "▲", label: "Revenue", value: "↑ 23% MoM", accent: "#00e8a0" },
                  { icon: "◎", label: "Top Segment", value: "US · 42%", accent: "#9060f8" },
                  { icon: "⌁", label: "Type", value: "Time series", accent: "#00d4e8" },
                  { icon: "◈", label: "AI Narrative", value: "Ready", accent: "#e840c8" },
                  { icon: "⊟", label: "Skew detected", value: "price col", accent: "#f8d030" },
                  { icon: "◉", label: "Duplicates", value: "0 rows", accent: "#00e8a0" },
                  { icon: "▲", label: "Schema", value: "23 cols inferred", accent: "#9060f8" },
                  // duplicate
                  { icon: "▲", label: "Revenue", value: "↑ 23% MoM", accent: "#00e8a0" },
                  { icon: "◎", label: "Top Segment", value: "US · 42%", accent: "#9060f8" },
                  { icon: "⌁", label: "Type", value: "Time series", accent: "#00d4e8" },
                  { icon: "◈", label: "AI Narrative", value: "Ready", accent: "#e840c8" },
                  { icon: "⊟", label: "Skew detected", value: "price col", accent: "#f8d030" },
                  { icon: "◉", label: "Duplicates", value: "0 rows", accent: "#00e8a0" },
                  { icon: "▲", label: "Schema", value: "23 cols inferred", accent: "#9060f8" },
                ].map((c, i) => (
                  <div key={i} className="lp-cinema-chip lp-chip-insight">
                    <span className="lp-chip-icon" style={{ color: c.accent }}>{c.icon}</span>
                    <span className="lp-chip-name">{c.label}</span>
                    <span className="lp-chip-val" style={{ color: c.accent }}>{c.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Format pills */}
        <div className="lp-format-strip">
          {["CSV", "TSV", "Excel", "JSON", "Parquet", "SQLite"].map(
            (f, i) => (
              <React.Fragment key={f}>
                {i > 0 && (
                  <span style={{ color: "rgba(0,0,0,0.15)", fontSize: 12 }}>
                    ·
                  </span>
                )}
                <span className="lp-fmt-pill">{f}</span>
              </React.Fragment>
            ),
          )}
          <span style={{ color: "rgba(0,0,0,0.15)", fontSize: 12 }}>·</span>
          <span style={{ fontSize: 12, color: "#6b6860" }}>up to 100 MB</span>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <div className="lp-stats-bar lp-reveal">
        {[
          { num: "12K+", desc: "Active analysts" },
          { num: "400M", desc: "Rows processed" },
          { num: "<200ms", desc: "Avg. analysis time" },
          { num: "99.9%", desc: "Uptime SLA" },
        ].map((s) => (
          <div key={s.desc} className="lp-stat-item">
            <div className="lp-stat-num">{s.num}</div>
            <div className="lp-stat-desc">{s.desc}</div>
          </div>
        ))}
      </div>

      {/* ── CTA ── */}
      <div className="lp-cta lp-reveal">
        <span className="lp-cta-label">Get started for free</span>
        <h2 className="lp-cta-title">
          Your data,
          <br />
          <em style={{ color: "rgba(255,255,255,0.45)", fontStyle: "italic" }}>
            perfectly served.
          </em>
        </h2>
        <p className="lp-cta-sub">
          No credit card. No install. Upload a file and your first analysis is
          on us.
        </p>
        <div className="lp-cta-btns">
          <button
            onClick={onTryDemo}
            disabled={isDemoLoading}
            className="lp-btn-cta-primary"
            style={{ border: "none", cursor: "pointer" }}
          >
            {isDemoLoading ? "Loading..." : "Try with sample data →"}
          </button>
          <a
            href="https://github.com/premxai/sushi-eda"
            target="_blank"
            rel="noopener noreferrer"
            className="lp-btn-cta-ghost"
          >
            View on GitHub
          </a>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="lp-footer">
        <div className="lp-footer-logo">
          <Image src="/sushi-logo.png" alt="Sushi" width={22} height={22} />
          Sushi
        </div>
        <div className="lp-footer-links">
          <a href="/docs/privacy">Privacy</a>
          <a href="/docs/terms">Terms</a>
          <a
            href="https://github.com/premxai/sushi-eda"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <a href="/docs">Docs</a>
        </div>
      </footer>
    </div>
  );
}
