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
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("visible"); }),
      { threshold: 0.08 }
    );
    document.querySelectorAll(".lp-reveal").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <div className="lp-root">
      {/* ── NAV ── */}
      <nav className="lp-nav" style={{ background: "rgba(240,238,233,0.88)" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div className="lp-logo-icon">
            <Image src="/sushi-logo.png" alt="Sushi" width={22} height={22} />
          </div>
          <span style={{ fontWeight: 600, fontSize: 17, color: "#111010", letterSpacing: "-0.3px" }}>Sushi</span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <a
            href="https://github.com/premxai/sushi-eda"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: 13.5, color: "#6b6860", textDecoration: "none", borderRadius: 7, border: "1px solid rgba(0,0,0,0.1)" }}
          >
            <Github size={14} />
            GitHub
          </a>

          <SignedOut>
            <Link href="/sign-in" style={{ padding: "8px 16px", borderRadius: 8, fontSize: 13.5, fontWeight: 400, color: "#111010", textDecoration: "none", border: "1px solid rgba(0,0,0,0.1)" }}>
              Sign in
            </Link>
            <Link href="/sign-up" style={{ padding: "8px 18px", borderRadius: 8, fontSize: 13.5, fontWeight: 500, background: "linear-gradient(135deg, #9060f8, #e840c8)", color: "#fff", textDecoration: "none", boxShadow: "0 2px 12px rgba(144,96,248,0.35)" }}>
              Get started
            </Link>
          </SignedOut>

          <SignedIn>
            <Link href="/datasets" style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: 13.5, color: "#6b6860", textDecoration: "none", borderRadius: 7 }}>
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
          Guided analysis for business teams
        </div>

        <h1 className="lp-h1">
          Turn raw files into a<br /><em>saved data workspace.</em>
        </h1>

        <p className="lp-sub">
          Upload a dataset, keep it in My Datasets, ask a business question, and get a clear answer you can reopen and share later.
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

      {/* ── TRANSFORM VISUAL ── */}
      <section style={{ padding: "0 48px 80px", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div className="lp-transform-stage lp-reveal">
          <div className="lp-transform-flow">

            {/* PANEL 1: Upload */}
            <div className="lp-panel">
              <div className="lp-panel-label">Input</div>
              <div className="lp-glass-bin">
                <div className="lp-scan" />
                <div className="lp-bin-label">Files · up to 100 MB</div>
                <div className="lp-file-stack">
                  {[
                    { ext: "csv", cls: "lp-ext-csv", name: "sales_2024.csv", size: "12 MB" },
                    { ext: "json", cls: "lp-ext-json", name: "events_log.json", size: "4 MB" },
                    { ext: "xlsx", cls: "lp-ext-xlsx", name: "inventory.xlsx", size: "9 MB" },
                    { ext: "parq", cls: "lp-ext-parq", name: "users.parquet", size: "38 MB" },
                  ].map((f) => (
                    <div key={f.name} className="lp-file-item">
                      <span className={`lp-ext ${f.cls}`}>{f.ext.toUpperCase()}</span>
                      <span className="lp-fname">{f.name}</span>
                      <span className="lp-fsize">{f.size}</span>
                    </div>
                  ))}
                </div>
                <div className="lp-progress">
                  <div className="lp-progress-labels"><span>Parsing schema</span><span>72%</span></div>
                  <div className="lp-progress-bar"><div className="lp-progress-fill" style={{ width: "72%" }} /></div>
                </div>
              </div>
            </div>

            {/* Arrow 1 */}
            <div className="lp-flow-arrow">
              <div className="lp-arrow-line">
                <div className="lp-arrow-particle" />
                <div className="lp-arrow-particle" style={{ animationDelay: "0.6s", background: "#9060f8", boxShadow: "0 0 8px #9060f8" }} />
                <div className="lp-arrow-particle" style={{ animationDelay: "1.2s", background: "#e840c8", boxShadow: "0 0 8px #e840c8" }} />
              </div>
              <div className="lp-arrow-label">parse</div>
            </div>

            {/* PANEL 2: Processing */}
            <div className="lp-panel">
              <div className="lp-panel-label" style={{ "--lp-cyan": "#9060f8" } as React.CSSProperties}>Processing</div>
              <div className="lp-process-box">
                <div className="lp-scan" style={{ animationDelay: "0.5s" }} />
                <div className="lp-steps">
                  {[
                    { done: true, text: "Workspace created" },
                    { done: true, text: "Fields organized" },
                    { done: true, text: "Health checks complete" },
                    { active: true, text: "Answering your question" },
                    { pending: true, text: "Finding unusual values" },
                    { pending: true, text: "Preparing a report" },
                  ].map((s, i) => (
                    <div key={i} className="lp-step">
                      {s.done && <div className="lp-check lp-check-done">✓</div>}
                      {s.active && (
                        <div className="lp-check lp-check-active">
                          <svg width="8" height="8" viewBox="0 0 8 8">
                            <circle cx="4" cy="4" r="3" fill="none" stroke="#9060f8" strokeWidth="1.5" strokeDasharray="6 4">
                              <animateTransform attributeName="transform" type="rotate" from="0 4 4" to="360 4 4" dur="1s" repeatCount="indefinite" />
                            </circle>
                          </svg>
                        </div>
                      )}
                      {s.pending && <div className="lp-check lp-check-pending" />}
                      <span className={`lp-step-text${s.done ? " done" : ""}`} style={s.pending ? { opacity: 0.28 } : undefined}>{s.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Arrow 2 */}
            <div className="lp-flow-arrow">
              <div className="lp-arrow-line" style={{ background: "linear-gradient(90deg, rgba(144,96,248,0.4), rgba(232,64,200,0.7))" }}>
                <div className="lp-arrow-particle" style={{ background: "#9060f8", boxShadow: "0 0 8px #9060f8" }} />
                <div className="lp-arrow-particle" style={{ animationDelay: "0.6s", background: "#e840c8", boxShadow: "0 0 8px #e840c8" }} />
                <div className="lp-arrow-particle" style={{ animationDelay: "1.2s", background: "#9060f8", boxShadow: "0 0 8px #9060f8" }} />
              </div>
              <div className="lp-arrow-label">visualize</div>
            </div>

            {/* PANEL 3: Insights */}
            <div className="lp-panel">
              <div className="lp-panel-label">Insights</div>
              <div className="lp-insights-grid">
                {/* Bar chart */}
                <div className="lp-chart-card">
                  <div className="lp-chart-topline" />
                  <div className="lp-chart-label">Revenue / Month</div>
                  <div className="lp-bars">
                    {[null, null, null, null, null, null].map((_, i) => <div key={i} className="lp-bar" />)}
                  </div>
                </div>
                {/* Donut */}
                <div className="lp-chart-card">
                  <div className="lp-chart-topline" />
                  <div className="lp-chart-label">Distribution</div>
                  <div className="lp-donut">
                    <svg viewBox="0 0 36 36">
                      <circle fill="none" strokeWidth="8" stroke="rgba(255,255,255,0.05)" cx="18" cy="18" r="14" />
                      <circle fill="none" strokeWidth="8" stroke="#e840c8" cx="18" cy="18" r="14"
                        strokeDasharray="65 100" strokeDashoffset="25" strokeLinecap="round"
                        style={{ filter: "drop-shadow(0 0 4px rgba(232,64,200,0.6))", transform: "rotate(-90deg)", transformOrigin: "center" }} />
                      <circle fill="none" strokeWidth="8" stroke="#9060f8" cx="18" cy="18" r="14"
                        strokeDasharray="25 100" strokeDashoffset="-40" strokeLinecap="round"
                        style={{ filter: "drop-shadow(0 0 4px rgba(144,96,248,0.6))", transform: "rotate(-90deg)", transformOrigin: "center" }} />
                    </svg>
                    <div className="lp-donut-legend">
                      <div className="lp-legend-item"><div className="lp-legend-dot" style={{ background: "#e840c8" }} />Segment A</div>
                      <div className="lp-legend-item"><div className="lp-legend-dot" style={{ background: "#9060f8" }} />Segment B</div>
                    </div>
                  </div>
                </div>
                {/* Area chart */}
                <div className="lp-chart-card">
                  <div className="lp-chart-topline" />
                  <div className="lp-chart-label">Trend · 154,321 rows · 0.05% anomalies</div>
                  <svg width="100%" height="60" viewBox="0 0 300 60" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="lp-areaG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#9060f8" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#9060f8" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0,50 C30,42 60,22 90,28 C120,34 150,14 180,18 C210,22 240,10 270,6 L300,4 L300,60 L0,60Z" fill="url(#lp-areaG)" opacity="0">
                      <animate attributeName="opacity" from="0" to="1" dur="0.8s" begin="2.2s" fill="freeze" />
                    </path>
                    <path d="M0,50 C30,42 60,22 90,28 C120,34 150,14 180,18 C210,22 240,10 270,6 L300,4" fill="none" stroke="#9060f8" strokeWidth="1.5" opacity="0">
                      <animate attributeName="opacity" from="0" to="1" dur="0.8s" begin="2.2s" fill="freeze" />
                      <animate attributeName="strokeDasharray" from="0 1000" to="1000 0" dur="1.5s" begin="2.2s" fill="freeze" />
                    </path>
                  </svg>
                </div>
              </div>
            </div>

          </div>

          {/* Format pills */}
          <div className="lp-format-strip">
            {["CSV", "TSV", "Excel", "JSON", "Parquet", "SQLite"].map((f, i) => (
              <React.Fragment key={f}>
                {i > 0 && <span style={{ color: "rgba(0,0,0,0.15)", fontSize: 12 }}>·</span>}
                <span className="lp-fmt-pill">{f}</span>
              </React.Fragment>
            ))}
            <span style={{ color: "rgba(0,0,0,0.15)", fontSize: 12 }}>·</span>
            <span style={{ fontSize: 12, color: "#6b6860" }}>up to 100 MB</span>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <div className="lp-stats-bar lp-reveal">
        {[
          { num: "12K+", desc: "Saved workspaces" },
          { num: "400M", desc: "Rows processed" },
          { num: "<2 min", desc: "Time to first answer" },
          { num: "87%", desc: "Repeat workspace usage" },
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
        <h2 className="lp-cta-title">Your data,<br /><em style={{ color: "rgba(255,255,255,0.45)", fontStyle: "italic" }}>ready to revisit.</em></h2>
        <p className="lp-cta-sub">No credit card. No install. Upload a file, save the workspace, and come back whenever you need the answer again.</p>
        <div className="lp-cta-btns">
          {isSignedIn ? (
            <button onClick={onTryDemo} disabled={isDemoLoading} className="lp-btn-cta-primary" style={{ border: "none", cursor: "pointer" }}>
              {isDemoLoading ? "Loading..." : "Try with sample data →"}
            </button>
          ) : (
            <Link href="/sign-up" className="lp-btn-cta-primary">
              Create account to try sample data →
            </Link>
          )}
          <a href="https://github.com/premxai/sushi-eda" target="_blank" rel="noopener noreferrer" className="lp-btn-cta-ghost">
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
          <Link href="/docs">Privacy</Link>
          <Link href="/docs">Terms</Link>
          <a href="https://github.com/premxai/sushi-eda" target="_blank" rel="noopener noreferrer">GitHub</a>
          <Link href="/docs">Docs</Link>
        </div>
      </footer>
    </div>
  );
}
