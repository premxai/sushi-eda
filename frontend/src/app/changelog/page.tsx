import { SiteHeader } from "@/components/landing/SiteHeader";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/common/Badge";

const ENTRIES = [
  {
    date: "July 2026",
    tag: "New",
    title: "Advanced Queries, AI Notes, and full report exports",
    items: [
      "A real SQL editor with schema browser, query history, and EXPLAIN plans. Your dataset is queryable as df.",
      "AI Notes: automatic, rule-based observations that stay available even when the AI summary can't run.",
      "Export a report as PDF, Markdown, JSON, or Excel, with your own analyst notes included.",
    ],
  },
  {
    date: "June 2026",
    tag: "New",
    title: "Compare two files, side by side",
    items: [
      "Upload two files on the Compare page to see schema differences and row/column deltas at a glance.",
      "A dataset library to star, rename, and archive anything you've uploaded.",
      "Public share links: a read-only report anyone can open, no account required.",
    ],
  },
  {
    date: "May 2026",
    tag: "New",
    title: "12 statistical tests, in plain English",
    items: [
      "T-test, ANOVA, chi-square, correlation, regression, time-series forecasting, cohort analysis, and A/B significance. Pick a test, choose your columns, get a plain-English result.",
      "A correlation heatmap and a ranked list of the strongest relationships in your data.",
      "Per-column outlier detection with severity indicators and a box plot.",
    ],
  },
  {
    date: "April 2026",
    tag: "Launch",
    title: "Sushi: your raw data, served perfectly",
    items: [
      "Drop in a file and get a 0–100 quality score, an AI-written summary, and an interactive chart builder.",
      "Ask Your Data: natural-language questions answered with the SQL behind them shown for trust.",
      "CSV, TSV, Excel, JSON, Parquet, and SQLite support, up to 25 MB per file.",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-paper">
      <SiteHeader />
      <div className="container max-w-2xl py-8">
        <PageHeader title="Changelog" description="What's new in Sushi." />
        <div className="mt-8 flex flex-col gap-8">
          {ENTRIES.map((entry) => (
            <div key={entry.title} className="flex gap-4">
              <div className="w-24 shrink-0 pt-0.5 text-[12px] text-ink-tertiary">{entry.date}</div>
              <div className="flex-1 border-l border-border pb-1 pl-4">
                <div className="mb-1.5 flex items-center gap-2">
                  <Badge tone={entry.tag === "Launch" ? "brand" : "neutral"}>{entry.tag}</Badge>
                  <h2 className="text-[14.5px] font-semibold text-ink">{entry.title}</h2>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {entry.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] text-ink-secondary">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-tertiary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
