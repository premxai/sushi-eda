"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { getApiErrorMessage, getSharedReport, SharedReport } from "@/lib/api";
import { formatDateTime } from "@/lib/formatters";
import { Logo } from "@/components/common/Logo";
import { EmptyState } from "@/components/common/EmptyState";
import { AISummarySection } from "@/components/report/AISummarySection";
import { OverviewSection } from "@/components/report/OverviewSection";
import { FieldHealthSection } from "@/components/report/FieldHealthSection";
import { CorrelationsSection } from "@/components/report/CorrelationsSection";
import { OutliersSection } from "@/components/report/OutliersSection";

export default function SharePage({ params }: { params: { token: string } }) {
  const [shared, setShared] = useState<SharedReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getSharedReport(params.token)
      .then((res) => {
        if (!cancelled) setShared(res);
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err, "This link isn't valid anymore."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <Loader2 className="h-6 w-6 animate-spin text-ink-tertiary" />
      </div>
    );
  }

  if (error || !shared) {
    return (
      <div className="app-workspace-page">
        <PublicHeader />
        <div className="container flex justify-center py-20">
          <EmptyState
            icon={TriangleAlert}
            title="This link has expired or doesn't exist"
            description="Ask whoever shared it with you for a new link."
            className="max-w-md"
          />
        </div>
      </div>
    );
  }

  const { report } = shared.analysis;

  return (
    <div className="app-workspace-page">
      <PublicHeader />
      <div className="container max-w-3xl py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-2/50 px-4 py-3">
          <div>
            <p className="text-[13.5px] font-medium text-ink">{shared.dataset_name}</p>
            <p className="mt-0.5 text-[12px] text-ink-secondary">Shared report · Analyzed {formatDateTime(shared.analysis.created_at)}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-tertiary">
            <ShieldCheck className="h-3.5 w-3.5" /> Read-only, anyone with this link can view it
          </span>
        </div>

        <div className="flex flex-col gap-8">
          <AISummarySection narrative={shared.analysis.ai_narrative} datasetId={null} />
          <Section title="Overview">
            <OverviewSection info={report.basic_info} qualityScore={report.quality_score} />
          </Section>
          <FieldHealthSection columns={report.column_analysis} typeSuggestions={report.type_suggestions} totalRows={report.basic_info.rows} datasetId={null} />
          <CorrelationsSection matrix={report.correlation_matrix} datasetId={null} />
          <OutliersSection outliers={report.outliers} datasetId={null} />
        </div>

        <p className="mt-10 text-center text-[12px] text-ink-tertiary">
          Made with{" "}
          <Link href="/" className="text-brand hover:text-brand-hover">
            Sushi
          </Link>
          {" · "}This report expires {formatDateTime(shared.expires_at)}
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">{title}</h2>
      {children}
    </div>
  );
}

function PublicHeader() {
  return (
    <header className="site-header relative border-b border-border bg-paper/90 backdrop-blur-xl">
      <div className="container flex h-14 items-center">
        <Link href="/" className="flex items-center gap-2 no-underline">
          <Logo size={24} />
          <span className="text-[15px] font-semibold tracking-tight text-ink">Sushi</span>
        </Link>
      </div>
    </header>
  );
}
