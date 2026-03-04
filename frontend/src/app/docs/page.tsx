import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Quick-start guide for Sushi EDA. Learn how to upload datasets, run AI analysis, use the SQL editor, set up monitors, and connect your data sources.",
};


function Code({ children }: { children: string }) {
  return (
    <code style={{
      padding: "1px 6px", borderRadius: 5, fontSize: 12.5,
      background: "#1a1917", color: "#e8e4de",
      fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
    }}>{children}</code>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111010", margin: "20px 0 8px" }}>{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 13.5, color: "#3a3835", lineHeight: 1.6, margin: "0 0 10px" }}>{children}</p>;
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ fontSize: 13.5, color: "#3a3835", lineHeight: 1.6, margin: "4px 0" }}>
      {children}
    </li>
  );
}

const SECTIONS = [
  {
    id: "quickstart",
    title: "Quick Start",
    emoji: "🚀",
    content: (
      <>
        <P>Get from zero to insight in under 60 seconds:</P>
        <ol style={{ paddingLeft: 20, margin: 0 }}>
          <Li>Open Sushi and click <strong>Drop a file</strong> or drag a CSV, Excel, Parquet, or JSON file onto the landing page.</Li>
          <Li>Sushi uploads your file to Cloudflare R2 and queues an analysis job via Celery.</Li>
          <Li>Watch the progress bar — analysis usually completes in 5–30 seconds depending on file size.</Li>
          <Li>When ready, you land on the <strong>Overview</strong> tab with quality score, row/column counts, and an AI narrative.</Li>
          <Li>Use the left sidebar to navigate: Columns, Statistics, SQL Editor, Monitors, Reports, and more.</Li>
        </ol>
        <P>Or try the demo dataset instantly — no account required on the free tier.</P>
      </>
    ),
  },
  {
    id: "upload",
    title: "Supported File Formats",
    emoji: "📂",
    content: (
      <>
        <P>Sushi accepts the following formats (up to 100 MB per file):</P>
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          <Li><Code>.csv</Code> and <Code>.tsv</Code> — auto-detected delimiter and encoding</Li>
          <Li><Code>.xlsx</Code> / <Code>.xls</Code> — first sheet imported by default</Li>
          <Li><Code>.parquet</Code> — columnar format, fastest to analyze</Li>
          <Li><Code>.json</Code> — array-of-objects or newline-delimited JSON</Li>
          <Li><Code>.sqlite</Code> / <Code>.db</Code> — all tables extracted as separate datasets</Li>
        </ul>
        <P>Files are streamed through Polars for fast I/O, then stored in Cloudflare R2. Raw data never leaves the region you deploy to.</P>
      </>
    ),
  },
  {
    id: "analysis",
    title: "Understanding Your Analysis",
    emoji: "📊",
    content: (
      <>
        <H3>Quality Score</H3>
        <P>A 0–100 score based on completeness (missing values), uniqueness (duplicates), and type consistency. Grades: A (90–100), B (75–89), C (60–74), D/F below that.</P>
        <H3>Column Analysis</H3>
        <P>Each column gets: data type, null%, unique count, top values, min/max, mean/median/std (numeric), and length stats (text).</P>
        <H3>Correlations</H3>
        <P>Pearson correlation matrix for all numeric columns. Pairs with |r| &gt; 0.5 are highlighted as strong correlations in the Report tab.</P>
        <H3>Outliers</H3>
        <P>IQR-based outlier detection per numeric column. Outlier rows are shown in a table with the actual vs. expected range.</P>
      </>
    ),
  },
  {
    id: "sql",
    title: "SQL Editor",
    emoji: "🖥️",
    content: (
      <>
        <P>Query your dataset with full SQL using DuckDB — no database setup required.</P>
        <H3>Keyboard shortcuts</H3>
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          <Li><Code>Cmd/Ctrl + Enter</Code> — run query</Li>
          <Li><Code>Cmd/Ctrl + K</Code> — clear editor</Li>
        </ul>
        <H3>Tips</H3>
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          <Li>The table name is always <Code>data</Code>: <Code>SELECT * FROM data LIMIT 100</Code></Li>
          <Li>DuckDB supports window functions, CTEs, regex, and JSON extraction</Li>
          <Li>Query history is saved in <Code>localStorage</Code> — use the history button to restore past queries</Li>
          <Li>Use the AI Chat tab to write queries in natural language</Li>
        </ul>
      </>
    ),
  },
  {
    id: "ai",
    title: "AI Features",
    emoji: "✨",
    content: (
      <>
        <P>All AI features consume credits from your org&apos;s monthly allowance (10 free / month on the free tier).</P>
        <H3>AI Chat (NL → SQL)</H3>
        <P>Type a question like <em>&quot;What are the top 5 customers by revenue?&quot;</em> and Sushi writes and runs the SQL. Toggle between natural language and raw SQL with the mode button.</P>
        <H3>AI Narrative</H3>
        <P>Auto-generated plain-English summary of your dataset — key findings, patterns, and data quality issues.</P>
        <H3>Cleaning Suggestions</H3>
        <P>Claude analyzes your column stats and suggests specific cleaning operations (fill nulls, normalize, remove duplicates, cast types).</P>
        <H3>Column Explainer</H3>
        <P>Click any column in the Columns tab to get an AI explanation of what it likely represents based on its name, values, and distribution.</P>
      </>
    ),
  },
  {
    id: "monitors",
    title: "Monitors & Alerts",
    emoji: "🔔",
    content: (
      <>
        <P>Monitors watch a dataset metric over time and alert when a threshold is breached.</P>
        <H3>Supported metrics</H3>
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          <Li><strong>row_count</strong> — alert when row count drops below or exceeds a value</Li>
          <Li><strong>null_rate</strong> — alert when a column&apos;s null % exceeds a threshold</Li>
          <Li><strong>quality_score</strong> — alert when overall quality drops</Li>
          <Li><strong>column_drift</strong> — alert when a numeric column&apos;s mean shifts by more than N%</Li>
        </ul>
        <H3>Schedule</H3>
        <P>Monitors run via Celery beat. Supported intervals: hourly, daily, weekly. You can also trigger a manual run from the Monitors tab.</P>
      </>
    ),
  },
  {
    id: "connectors",
    title: "Data Connectors",
    emoji: "🔌",
    content: (
      <>
        <P>Connect live data sources instead of uploading static files.</P>
        <ul style={{ paddingLeft: 20, margin: 0 }}>
          <Li><strong>PostgreSQL</strong> — connect a database and pick a table or write a query</Li>
          <Li><strong>REST API</strong> — fetch JSON from any HTTP endpoint with optional auth headers</Li>
          <Li><strong>S3 / R2</strong> — coming soon</Li>
          <Li><strong>Google Sheets</strong> — coming soon</Li>
          <Li><strong>Snowflake / BigQuery</strong> — coming soon</Li>
        </ul>
        <P>Credentials are Fernet-encrypted before storage. Use the <Link href="/connectors" style={{ color: "#9060f8" }}>Connectors</Link> page to add a new source.</P>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Sharing Reports",
    emoji: "🔗",
    content: (
      <>
        <P>Generate a public link to share a full EDA report — no login required for viewers.</P>
        <ol style={{ paddingLeft: 20, margin: 0 }}>
          <Li>Open a dataset and click the <strong>Share</strong> button in the top bar.</Li>
          <Li>Copy the link — it&apos;s valid for 7 days by default (configurable in backend settings).</Li>
          <Li>Share it with anyone. The recipient sees the full report at <Code>/share/[token]</Code>.</Li>
        </ol>
        <P>Public share links are read-only. The underlying data never leaves your R2 bucket.</P>
      </>
    ),
  },
  {
    id: "self-host",
    title: "Self-Hosting",
    emoji: "🐳",
    content: (
      <>
        <P>Sushi is fully self-hostable via Docker Compose.</P>
        <ol style={{ paddingLeft: 20, margin: 0 }}>
          <Li>Copy <Code>.env.example</Code> to <Code>.env</Code> and fill in all required values.</Li>
          <Li>Run <Code>docker compose up -d</Code> — starts Redis, Celery worker, FastAPI backend, and Next.js frontend.</Li>
          <Li>Run database migrations: <Code>docker compose exec backend alembic upgrade head</Code></Li>
          <Li>Visit <Code>http://localhost:3000</Code> to access your local Sushi instance.</Li>
        </ol>
        <P>Required services: PostgreSQL, Redis, Cloudflare R2 (or any S3-compatible storage), Clerk (auth), Anthropic API (AI features), Stripe (billing — optional).</P>
      </>
    ),
  },
];

export default function DocsPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#f0eee9", fontFamily: "inherit" }}>
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
          background: "linear-gradient(90deg,#9060f8,#e840c8,#00d4e8,#9060f8)",
          backgroundSize: "200% 100%", animation: "shimmer 4s linear infinite",
        }} />
        <Link href="/" style={{ color: "#9a9690", display: "flex", alignItems: "center", gap: 6, textDecoration: "none", fontSize: 13 }}>
          <ArrowLeft size={15} /> Back
        </Link>
        <span style={{ color: "rgba(0,0,0,0.15)" }}>|</span>
        <span style={{ fontWeight: 700, fontSize: 16, color: "#111010" }}>Documentation</span>
        <nav style={{ marginLeft: "auto", display: "flex", gap: 20 }}>
          <Link href="/changelog" style={{ fontSize: 13, color: "#6b6860", textDecoration: "none" }}>Changelog</Link>
          <Link href="/pricing"   style={{ fontSize: 13, color: "#6b6860", textDecoration: "none" }}>Pricing</Link>
        </nav>
      </div>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: "40px 24px", display: "flex", gap: 48 }}>

        {/* Sidebar nav */}
        <aside style={{
          width: 200, flexShrink: 0,
          position: "sticky", top: 80, height: "fit-content",
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              style={{
                fontSize: 13, color: "#6b6860", textDecoration: "none",
                padding: "5px 10px", borderRadius: 8,
                display: "flex", alignItems: "center", gap: 7,
              }}
            >
              <span>{s.emoji}</span>
              {s.title}
            </a>
          ))}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(0,0,0,0.07)" }}>
            <Link href="/integrations" style={{ fontSize: 12.5, color: "#9060f8", textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
              Integrations <ArrowRight size={11} />
            </Link>
            <Link href="/changelog" style={{ fontSize: 12.5, color: "#9060f8", textDecoration: "none", display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
              Changelog <ArrowRight size={11} />
            </Link>
          </div>
        </aside>

        {/* Content */}
        <main style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: "#111010", margin: "0 0 6px", letterSpacing: "-0.4px" }}>
            Sushi Documentation
          </h1>
          <p style={{ fontSize: 14, color: "#9a9690", margin: "0 0 40px" }}>
            Quick-start guide and feature reference. Last updated March 2026.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
            {SECTIONS.map((s) => (
              <section key={s.id} id={s.id}>
                <div style={{
                  background: "rgba(255,255,255,0.72)",
                  border: "1px solid rgba(0,0,0,0.07)",
                  borderRadius: 16, padding: "20px 24px",
                }}>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111010", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 10 }}>
                    <span>{s.emoji}</span> {s.title}
                  </h2>
                  {s.content}
                </div>
              </section>
            ))}
          </div>

          <div style={{ marginTop: 48, padding: "20px 24px", borderRadius: 16, background: "linear-gradient(135deg, rgba(144,96,248,0.08), rgba(232,64,200,0.06))", border: "1px solid rgba(144,96,248,0.15)" }}>
            <p style={{ fontSize: 14, color: "#3a3835", margin: "0 0 10px", fontWeight: 600 }}>Still need help?</p>
            <p style={{ fontSize: 13, color: "#6b6860", margin: "0 0 14px" }}>
              Open an issue on GitHub or reach out via the in-app chat. We respond within 24 hours.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <a
                href="https://github.com/premxai/sushi-eda/issues"
                target="_blank"
                rel="noreferrer"
                style={{ padding: "7px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "linear-gradient(135deg,#9060f8,#e840c8)", color: "#fff", textDecoration: "none" }}
              >
                GitHub Issues
              </a>
              <Link href="/changelog" style={{ padding: "7px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, background: "rgba(0,0,0,0.06)", color: "#6b6860", textDecoration: "none" }}>
                View Changelog
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
