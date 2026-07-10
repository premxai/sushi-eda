"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BarChart3, Gauge, Loader2, MessageSquareText, Sparkles } from "lucide-react";
import { fetchDatasetAnalysis, fetchExampleDataset } from "@/lib/api";
import { EDAReport } from "@/lib/types";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ExampleCard } from "@/components/examples/ExampleCard";

interface Example { datasetId: string; filename: string; report: EDAReport }

const REPORT_LENSES = [
  { icon: Gauge, title: "Quality at a glance", body: "See missing values, duplicates, consistency, and a clear readiness score." },
  { icon: MessageSquareText, title: "Plain-English story", body: "Start with the executive summary before opening the detailed evidence." },
  { icon: BarChart3, title: "Evidence you can inspect", body: "Move from charts into fields, correlations, outliers, and statistical tests." },
];

export default function ExamplesPage() {
  const router = useRouter();
  const [example, setExample] = useState<Example | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchExampleDataset()
      .then(async (res) => {
        if (!res) { if (!cancelled) setUnavailable(true); return; }
        const data = await fetchDatasetAnalysis(res.dataset_id);
        if (!cancelled) setExample({ datasetId: res.dataset_id, filename: res.filename, report: data.report });
      })
      .catch(() => { if (!cancelled) setUnavailable(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="app-paper-page">
      <SiteHeader />
      <main className="container max-w-6xl py-10 sm:py-14">
        <PageHeader title="Examples" description="Open a prepared report, inspect the evidence, and see how Sushi turns a file into a decision-ready story." />

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="paper-panel p-6 sm:p-8">
            <p className="section-kicker">Live sample</p>
            <h2 className="mt-4 font-display text-[38px] leading-[1.02] tracking-[-0.035em] text-ink">Sales performance,<br /><span className="text-brand">served clearly.</span></h2>
            <p className="mt-4 text-[13.5px] leading-7 text-ink-secondary">A realistic sales file with dates, regions, products, and revenue—prepared so you can explore the complete report without finding a file first.</p>
            <Link href="/?sample=1" className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-paper no-underline hover:opacity-90">Try sample data <ArrowRight className="h-4 w-4" /></Link>
          </div>

          <div className="paper-panel p-5 sm:p-6">
            {loading ? (
              <div className="flex min-h-48 items-center justify-center text-ink-tertiary"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : unavailable || !example ? (
              <EmptyState icon={Sparkles} title="The prepared report is waking up" description="You can still run the bundled sample from the button beside this card." />
            ) : (
              <ExampleCard filename={example.filename} report={example.report} onOpen={() => router.push(`/?open=${example.datasetId}&name=${encodeURIComponent(example.filename)}`)} />
            )}
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {REPORT_LENSES.map(({ icon: Icon, title, body }) => (
            <article key={title} className="paper-panel p-6">
              <span className="grid h-10 w-10 place-items-center rounded-full border border-brand/25 bg-brand-weak text-brand"><Icon className="h-[18px] w-[18px]" /></span>
              <h2 className="mt-4 text-[15px] font-semibold text-ink">{title}</h2>
              <p className="mt-2 text-[13px] leading-6 text-ink-secondary">{body}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
