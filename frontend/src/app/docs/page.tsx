import { SiteHeader } from "@/components/landing/SiteHeader";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

const SECTIONS = [
  {
    title: "Quick start",
    body: [
      "Drop a file on the home page — CSV, TSV, Excel, JSON, Parquet, or SQLite, up to 25 MB — or click \"try a sample dataset\" if you just want to look around first.",
      "Analysis usually takes 5–30 seconds. You'll see it move through reading your file, analyzing it, and writing a summary.",
      "When it's done, you land in the report. Start with the AI Summary at the top — it's a plain-English readout of what the data says before you dig into anything else.",
    ],
  },
  {
    title: "Supported file formats",
    body: [
      "CSV and TSV — the most common export format from spreadsheets and databases.",
      "Excel (XLSX) — the first sheet is used.",
      "JSON — an array of flat objects works best.",
      "Parquet and SQLite — for larger or more structured exports.",
      "Files over 25 MB aren't accepted yet. If you're close to the limit, try exporting a narrower date range or fewer columns.",
    ],
  },
  {
    title: "How the quality score works",
    body: [
      "Every report opens with a 0–100 score and a letter grade, built from five weighted checks: missing data (30%), duplicate rows (20%), unusual values (20%), column type consistency (15%), and uniqueness (15%).",
      "A high score means you can present numbers from the data with confidence. A lower score doesn't mean the data is unusable — it means you should read the recommendations on the Overview tab before you rely on exact totals.",
    ],
  },
  {
    title: "Ask Your Data",
    body: [
      "Type a question in plain English — \"what's the average order value?\", \"which region has the most cancellations?\" — and get an answer in plain English back.",
      "Every answer has a \"how was this computed?\" disclosure that shows the exact query behind it, so you can verify it rather than just trust it.",
      "Questions are limited per day to keep the tool available for everyone. If you hit the limit, the rest of the report still works normally.",
    ],
  },
  {
    title: "Advanced Queries (SQL editor)",
    body: [
      "Your dataset is available as a table named df. Write any read-only SELECT query and run it directly.",
      "Queries are capped at 10,000 rows and cancelled automatically after 20 seconds, so it's safe to experiment — there's no way to modify data or affect other users.",
      "Use \"Explain query plan\" to see how DuckDB will execute a query before you run it on a large dataset.",
    ],
  },
  {
    title: "Sharing a report",
    body: [
      "From the Reports tab, export a PDF, Markdown, JSON, or Excel copy of the report — no account needed.",
      "You can also create a public share link. Anyone with that link can view a read-only version of the report; they don't need an account and can't edit anything or run queries.",
      "Shared links and the underlying files expire automatically after 7 days.",
    ],
  },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-paper">
      <SiteHeader />
      <div className="container max-w-3xl py-8">
        <PageHeader title="Docs" description="Everything you need to get the most out of a report." />
        <div className="mt-6 flex flex-col gap-4">
          {SECTIONS.map((section) => (
            <Card key={section.title}>
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
              </CardHeader>
              <div className="flex flex-col gap-2 text-[13.5px] leading-relaxed text-ink-secondary">
                {section.body.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
