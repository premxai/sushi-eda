import Link from "next/link";
import { ArrowRight, BarChart3, Database, FileJson, FileSpreadsheet, FileText, Gauge, MessageSquareText, ShieldCheck, Share2, UploadCloud } from "lucide-react";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { PageHeader } from "@/components/common/PageHeader";

const FORMATS = [
  { name: "CSV & TSV", detail: "Delimited exports", icon: FileText },
  { name: "XLSX", detail: "First Excel sheet", icon: FileSpreadsheet },
  { name: "JSON", detail: "Arrays of objects", icon: FileJson },
  { name: "Parquet", detail: "Columnar datasets", icon: BarChart3 },
  { name: "SQLite", detail: "First database table", icon: Database },
];

const GUIDE_SECTIONS = [
  {
    id: "quality",
    title: "Read the quality score first",
    icon: Gauge,
    body: "Every report opens with a 0–100 score built from missing values, duplicate rows, unusual values, type consistency, and uniqueness. A lower score is a prompt to review the recommendations—not a judgment that the file is unusable.",
  },
  {
    id: "ask",
    title: "Ask questions in plain English",
    icon: MessageSquareText,
    body: "Ask things like “which region grew fastest?” and inspect the computation behind the answer. If AI is unavailable, the quality checks, fields, charts, statistics, and query tools remain available.",
  },
  {
    id: "share",
    title: "Export or share deliberately",
    icon: Share2,
    body: "Export PDF, Markdown, JSON, or Excel from the report. Public links are read-only and visible to anyone who has the URL, so share only data you are comfortable making accessible.",
  },
  {
    id: "privacy",
    title: "Seven-day retention by default",
    icon: ShieldCheck,
    body: "Unsaved uploaded files and generated reports are deleted automatically after seven days. Saved dashboard items remain until you delete them. Sushi does not use uploaded data to train AI models.",
  },
];

export default function DocsPage() {
  return (
    <div className="app-paper-page">
      <SiteHeader />
      <main className="container max-w-6xl py-10 sm:py-14">
        <PageHeader title="Docs" description="From raw file to trustworthy report—everything you need to work confidently in Sushi." />

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="paper-panel p-6 sm:p-8">
            <p className="section-kicker">Quick start</p>
            <div className="mt-6 grid gap-5 sm:grid-cols-3">
              {[
                ["01", "Choose a file", "Drop or browse any supported file up to 25 MB."],
                ["02", "Watch it prepare", "Sushi reads, profiles, scores, and summarizes the data."],
                ["03", "Open the story", "Start with the summary, then verify fields, charts, and tests."],
              ].map(([number, title, body]) => (
                <div key={number}>
                  <span className="font-display text-[34px] leading-none text-brand">{number}</span>
                  <h2 className="mt-3 text-[15px] font-semibold text-ink">{title}</h2>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">{body}</p>
                </div>
              ))}
            </div>
            <Link href="/#upload" className="mt-7 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-paper no-underline hover:opacity-90">
              Analyze a file <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <aside className="paper-panel p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full border border-brand/30 bg-brand-weak text-brand"><UploadCloud className="h-5 w-5" /></span>
              <div><p className="text-[15px] font-semibold text-ink">Six supported formats</p><p className="text-[12px] text-ink-tertiary">Maximum 25 MB per file</p></div>
            </div>
            <div className="mt-5 grid gap-2">
              {FORMATS.map(({ name, detail, icon: Icon }) => (
                <div key={name} className="flex items-center gap-3 rounded-xl border border-border/80 bg-surface-2/70 px-3 py-2.5">
                  <Icon className="h-4 w-4 text-success" />
                  <div><p className="text-[12.5px] font-semibold text-ink">{name}</p><p className="text-[11px] text-ink-tertiary">{detail}</p></div>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2">
          {GUIDE_SECTIONS.map(({ id, title, icon: Icon, body }) => (
            <article key={id} id={id} className="paper-panel scroll-mt-24 p-6">
              <span className="grid h-10 w-10 place-items-center rounded-full border border-border bg-surface-2 text-brand"><Icon className="h-[18px] w-[18px]" /></span>
              <h2 className="mt-4 font-display text-[28px] leading-tight tracking-[-0.02em] text-ink">{title}</h2>
              <p className="mt-3 text-[13.5px] leading-7 text-ink-secondary">{body}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
