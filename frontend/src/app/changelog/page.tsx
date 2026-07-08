import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "Stay up to date with every new feature, fix, and improvement to the Sushi EDA platform.",
};

interface Release {
  version: string;
  date: string;
  badge?: string;
  badgeColor?: string;
  items: { type: "feat" | "fix" | "perf" | "infra"; text: string }[];
}

const RELEASES: Release[] = [
  {
    version: "v0.36",
    date: "2026-03-03",
    badge: "Latest",
    badgeColor: "#6E8F2E",
    items: [
      { type: "feat", text: "SEO: sitemap.xml, robots.txt, changelog and docs pages" },
      { type: "feat", text: "Open Graph & Twitter card meta tags on all public pages" },
    ],
  },
  {
    version: "v0.35",
    date: "2026-03-03",
    items: [
      { type: "feat", text: "Enterprise: Audit log viewer with CSV export, action and resource filters" },
      { type: "feat", text: "Enterprise: Team management — view members, change roles, remove" },
      { type: "feat", text: "Enterprise: Security tab — SSO/SAML via Clerk, RBAC docs, data retention" },
      { type: "infra", text: "Backend: /orgs/{org_id}/audit-logs and /orgs/{org_id}/members endpoints" },
    ],
  },
  {
    version: "v0.34",
    date: "2026-03-02",
    items: [
      { type: "feat", text: "Integrations page: Slack setup guide + slash command docs (/sushi help, report, credits)" },
      { type: "feat", text: "Integrations page: GitHub webhook auto-analysis on push" },
      { type: "feat", text: "Integrations page: Sushi CLI install & usage guide with CI example" },
      { type: "feat", text: "Integrations page: Chrome extension preview with waitlist" },
    ],
  },
  {
    version: "v0.33",
    date: "2026-03-02",
    items: [
      { type: "feat", text: "Multiplayer: threaded comment system per dataset and per column" },
      { type: "feat", text: "Comments: inline edit/delete, threaded replies, 30s auto-poll" },
      { type: "feat", text: "Comments: avatar initials with deterministic color, timeAgo timestamps" },
      { type: "infra", text: "Backend: dataset_comments table + CRUD router + org/dataset scoping" },
    ],
  },
  {
    version: "v0.32",
    date: "2026-03-01",
    items: [
      { type: "feat", text: "Onboarding checklist: 8-step floating widget with progress ring, localStorage persistence" },
      { type: "feat", text: "Product tour: expanded to 7 steps covering all major features, warm redesign" },
      { type: "perf", text: "Auto-marks checklist steps based on active section and whether a dataset is loaded" },
    ],
  },
  {
    version: "v0.31",
    date: "2026-02-28",
    items: [
      { type: "feat", text: "Data Catalog: dataset grid with search, format filters, and profile panel" },
      { type: "feat", text: "Data Lineage: pipeline chain visualization (source → pipeline → destination)" },
      { type: "feat", text: "Catalog profile panel: quality score ring, column types, missing%, open in Analyzer" },
    ],
  },
  {
    version: "v0.30",
    date: "2026-02-27",
    items: [
      { type: "feat", text: "Feature Engineering: interaction product, interaction ratio, rolling stats, lag features" },
      { type: "feat", text: "Transform UI: two-column pickers for interactions, window and lag inputs" },
      { type: "infra", text: "Backend: DataTransformer extended with 4 new methods in cleaner.py" },
    ],
  },
  {
    version: "v0.29",
    date: "2026-02-26",
    items: [
      { type: "feat", text: "Reports: quality score ring, metric cards, correlations, outlier flags, column quality table" },
      { type: "feat", text: "Export: PDF (jsPDF), Markdown, and JSON download" },
      { type: "feat", text: "Analyst notes: sticky textarea persisted in localStorage (sushi_pinned_notes)" },
    ],
  },
  {
    version: "v0.28",
    date: "2026-02-25",
    items: [
      { type: "feat", text: "Monitors: list view with status badges (ok / firing / never run)" },
      { type: "feat", text: "Monitors: run history, manual trigger, pause/resume, delete with confirm" },
      { type: "feat", text: "Summary counters: Total / Active / Firing / OK" },
    ],
  },
  {
    version: "v0.27",
    date: "2026-02-24",
    items: [
      { type: "feat", text: "Pipeline Builder: node graph editor with source, transform, and destination nodes" },
      { type: "feat", text: "Pipeline run history with status, start/end times, and log preview" },
    ],
  },
  {
    version: "v0.26",
    date: "2026-02-23",
    items: [
      { type: "feat", text: "Statistical Analysis Suite: t-test, ANOVA, chi-square, regression, correlation, Mann-Whitney" },
      { type: "feat", text: "Rich results display: test stats, p-values, confidence intervals, effect sizes" },
    ],
  },
  {
    version: "v0.25",
    date: "2026-02-22",
    items: [
      { type: "feat", text: "Visualizations: 10+ chart types via Plotly.js — histogram, scatter, box, heatmap, bar, pie, violin" },
      { type: "feat", text: "Chart persistence: last chart config saved per dataset in sessionStorage" },
    ],
  },
  {
    version: "v0.24",
    date: "2026-02-21",
    items: [
      { type: "feat", text: "SQL Editor: DuckDB-powered, syntax highlighting, query history, results table" },
      { type: "feat", text: "SQL: row count + execution time in status bar, Cmd/Ctrl+Enter to run" },
    ],
  },
  {
    version: "v0.23",
    date: "2026-02-20",
    items: [
      { type: "feat", text: "Data Connectors: PostgreSQL and REST API connectors with encrypted credential storage" },
      { type: "feat", text: "Connector test endpoint: validates connection before saving" },
    ],
  },
  {
    version: "v0.22",
    date: "2026-02-15",
    items: [
      { type: "infra", text: "Docker Compose: redis + celery worker + backend + frontend, multi-stage Dockerfiles" },
      { type: "infra", text: ".env.example: all 30+ env vars documented" },
    ],
  },
  {
    version: "v0.21",
    date: "2026-02-10",
    items: [
      { type: "infra", text: "Sentry: FastAPI, Celery, and Redis integrations; Next.js client/server/edge configs" },
      { type: "perf", text: "Error tracking, performance tracing, and session replays in production" },
    ],
  },
  {
    version: "v0.20",
    date: "2026-02-05",
    items: [
      { type: "feat", text: "Shareable public report URLs — Redis-backed tokens, no login required" },
      { type: "feat", text: "/share/[token] public page with full EDA report view" },
    ],
  },
  {
    version: "v0.15–0.19",
    date: "2026-01-20",
    items: [
      { type: "feat", text: "AI Chat: natural language → SQL, streaming SSE, SQL results table" },
      { type: "feat", text: "AI Cleaning Suggestions: rule-based + Claude-powered recommendations" },
      { type: "feat", text: "AI Narrative: Claude-written plain-English analysis summary" },
      { type: "feat", text: "AI Credits: per-org metering, check/consume/status endpoints" },
      { type: "feat", text: "Stripe Billing: checkout, customer portal, webhook events" },
    ],
  },
  {
    version: "v0.10–0.14",
    date: "2025-12-15",
    items: [
      { type: "infra", text: "Clerk JWT auth: get_current_user, org validation, RBAC role gates on all endpoints" },
      { type: "feat", text: "DuckDB: ad-hoc SQL on Polars DataFrames, schema introspection" },
      { type: "perf", text: "Polars rewrite: CSV/Parquet I/O, sampling removed — full dataset always analyzed" },
      { type: "feat", text: "Dataset CRUD: org-scoped, starred, archived, versioned analyses" },
    ],
  },
  {
    version: "v0.1–0.9",
    date: "2025-11-01",
    items: [
      { type: "infra", text: "FastAPI backend, PostgreSQL models, Alembic migrations, multi-tenant orgs" },
      { type: "infra", text: "Cloudflare R2 storage, Celery + Redis task queue" },
      { type: "feat", text: "EDA worker pipeline: upload → analyze → R2 → DB → SSE stream" },
      { type: "feat", text: "Quality score, type detection, outlier detection, correlation matrix" },
      { type: "feat", text: "Next.js 14 App Router frontend with Clerk auth, Tailwind, warm design system" },
    ],
  },
];

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  feat:  { label: "feat",  color: "var(--salmon)" },
  fix:   { label: "fix",   color: "#6E8F2E" },
  perf:  { label: "perf",  color: "#3C8FA0" },
  infra: { label: "infra", color: "#B48A3C" },
};

export default function ChangelogPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--paper)", fontFamily: "inherit" }}>
      <style>{`@keyframes shimmer{0%{background-position:0% 0}100%{background-position:200% 0}}`}</style>

      {/* Header */}
      <div style={{
        background: "rgba(240,238,233,0.92)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0,0,0,0.07)",
        padding: "14px 32px",
        display: "flex", alignItems: "center", gap: 16,
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{
          height: 3, position: "absolute", top: 0, left: 0, right: 0,
          background: "linear-gradient(90deg,var(--salmon),var(--tuna),#6E8F2E,var(--salmon))",
          backgroundSize: "200% 100%", animation: "shimmer 4s linear infinite",
        }} />
        <Link href="/" style={{ color: "var(--muted-ink)", display: "flex", alignItems: "center", gap: 6, textDecoration: "none", fontSize: 13 }}>
          <ArrowLeft size={15} /> Back
        </Link>
        <span style={{ color: "rgba(0,0,0,0.15)" }}>|</span>
        <span style={{ fontWeight: 700, fontSize: 16, color: "var(--ink)" }}>Changelog</span>
        <nav style={{ marginLeft: "auto", display: "flex", gap: 20 }}>
          <Link href="/docs"    style={{ fontSize: 13, color: "var(--muted-ink)", textDecoration: "none" }}>Docs</Link>
        </nav>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
        <h1 style={{ fontSize: 34, fontWeight: 800, color: "var(--ink)", margin: "0 0 8px", letterSpacing: "-0.5px" }}>
          Changelog
        </h1>
        <p style={{ fontSize: 15, color: "var(--muted-ink)", margin: "0 0 48px" }}>
          Every release, big and small. Sushi ships fast.
        </p>

        <div style={{ position: "relative" }}>
          {/* Vertical timeline line */}
          <div style={{
            position: "absolute", left: 7, top: 8, bottom: 0, width: 2,
            background: "linear-gradient(180deg, var(--salmon), var(--tuna), #6E8F2E, rgba(0,0,0,0.05))",
          }} />

          <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
            {RELEASES.map((r) => (
              <div key={r.version} style={{ display: "flex", gap: 24, paddingLeft: 28, position: "relative" }}>
                {/* Dot */}
                <div style={{
                  position: "absolute", left: 0, top: 6,
                  width: 16, height: 16, borderRadius: "50%",
                  background: "linear-gradient(135deg,var(--salmon),var(--tuna))",
                  border: "3px solid var(--paper)",
                }} />

                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", margin: 0 }}>{r.version}</h2>
                    {r.badge && (
                      <span style={{
                        padding: "2px 8px", borderRadius: 99, fontSize: 10.5, fontWeight: 700,
                        background: `${r.badgeColor}18`, color: r.badgeColor,
                      }}>{r.badge}</span>
                    )}
                    <span style={{ fontSize: 12, color: "var(--faint-ink)", marginLeft: "auto" }}>{r.date}</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {r.items.map((item, i) => {
                      const t = TYPE_LABELS[item.type];
                      return (
                        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                          <span style={{
                            padding: "1px 7px", borderRadius: 6, fontSize: 10.5, fontWeight: 700,
                            background: `${t.color}15`, color: t.color,
                            flexShrink: 0, marginTop: 1,
                            fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
                          }}>{t.label}</span>
                          <p style={{ fontSize: 13.5, color: "var(--ink)", margin: 0, lineHeight: 1.5 }}>{item.text}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
