"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArchiveX, ArrowRight, FileBarChart2, FilePlus2, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { getApiErrorMessage, getPersonalDashboard, PersonalDashboard, removeDashboardDataset, removeDashboardReport } from "@/lib/api";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function DashboardPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<PersonalDashboard | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDashboard(await getPersonalDashboard());
    } catch (err) {
      setError(getApiErrorMessage(err, "Couldn’t load your dashboard."));
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      router.replace("/sign-in?next=/dashboard");
      return;
    }
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return router.replace("/sign-in?next=/dashboard");
      setCheckingAuth(false);
      await load();
    });
  }, [load, router]);

  const remove = async (kind: "dataset" | "report", id: string) => {
    setBusy(`${kind}:${id}`);
    setError(null);
    try {
      if (kind === "dataset") await removeDashboardDataset(id);
      else await removeDashboardReport(id);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Couldn’t remove that saved item."));
    } finally {
      setBusy(null);
    }
  };

  if (checkingAuth) return <main className="app-paper-page grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-brand" /></main>;

  const name = dashboard?.profile.name || dashboard?.profile.email?.split("@")[0] || "there";
  const datasetLimit = dashboard?.limits.datasets ?? 3;
  const reportLimit = dashboard?.limits.reports ?? 3;

  return (
    <main className="app-paper-page min-h-screen">
      <SiteHeader />
      <div className="container py-12 sm:py-16">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="section-kicker">Personal workspace</p>
            <h1 className="mt-4 font-display text-[52px] leading-[0.94] tracking-[-0.045em] text-ink sm:text-[68px]">Welcome back, {name}.</h1>
            <p className="mt-5 max-w-xl text-[16px] leading-7 text-ink-secondary">Analyze as many files as you need. Keep only the work that matters most in your personal dashboard.</p>
          </div>
          <Link href="/new-file" className="inline-flex w-fit items-center gap-2 rounded-full bg-ink px-5 py-3 text-[13px] font-semibold text-paper no-underline transition-opacity hover:opacity-90"><FilePlus2 className="h-4 w-4" />New file</Link>
        </div>

        {error && <p role="alert" className="mt-7 rounded-xl border border-danger/25 bg-danger-weak px-4 py-3 text-[13px] text-danger">{error}</p>}

        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          <Metric label="Saved datasets" value={`${dashboard?.saved_datasets.length ?? 0}/${datasetLimit}`} detail="Your curated source files" />
          <Metric label="Saved reports" value={`${dashboard?.saved_reports.length ?? 0}/${reportLimit}`} detail="The insights worth returning to" />
          <div className="paper-panel flex items-center gap-3 p-5"><span className="grid h-10 w-10 place-items-center rounded-full border border-success/30 bg-success-weak text-success"><ShieldCheck className="h-5 w-5" /></span><p className="text-[13px] leading-5 text-ink-secondary">Saved items stay private in your dashboard; unsaved uploads follow your retention settings.</p></div>
        </section>

        <section className="mt-10 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <SavedSection title="Saved datasets" eyebrow={`${dashboard?.saved_datasets.length ?? 0} of ${datasetLimit} kept`} empty="Save a dataset from any completed report to keep it here." action="Save a dataset" >
            {dashboard?.saved_datasets.map((dataset) => (
              <article key={dataset.id} className="rounded-2xl border border-border bg-surface/80 p-4">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[14px] font-semibold text-ink">{dataset.name}</p><p className="mt-1 text-[12px] text-ink-tertiary">{dataset.file_format.toUpperCase()} · {dataset.row_count ?? "—"} rows · {dataset.column_count ?? "—"} fields</p></div><button disabled={busy === `dataset:${dataset.id}`} onClick={() => void remove("dataset", dataset.id)} className="shrink-0 rounded-full p-2 text-ink-tertiary hover:bg-danger-weak hover:text-danger disabled:opacity-50" aria-label={`Remove ${dataset.name} from dashboard`}><ArchiveX className="h-4 w-4" /></button></div>
                <Link href={`/?open=${dataset.id}&name=${encodeURIComponent(dataset.name)}`} className="mt-4 inline-flex text-[12px] font-semibold text-brand no-underline hover:underline">Open dataset →</Link>
              </article>
            ))}
          </SavedSection>
          <SavedSection title="Saved reports" eyebrow={`${dashboard?.saved_reports.length ?? 0} of ${reportLimit} kept`} empty="Save a report from the analysis header to keep it here." action="Save a report" >
            {dashboard?.saved_reports.map((report) => (
              <article key={report.analysis_id} className="rounded-2xl border border-border bg-surface/80 p-4">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-[14px] font-semibold text-ink">{report.name}</p><p className="mt-1 text-[12px] text-ink-tertiary">{report.rows ?? "—"} rows · {report.columns ?? "—"} fields · Quality {report.quality_score ?? "—"}</p></div><button disabled={busy === `report:${report.analysis_id}`} onClick={() => void remove("report", report.analysis_id)} className="shrink-0 rounded-full p-2 text-ink-tertiary hover:bg-danger-weak hover:text-danger disabled:opacity-50" aria-label={`Remove ${report.name} report from dashboard`}><ArchiveX className="h-4 w-4" /></button></div>
                <Link href={`/?open=${report.dataset_id}&name=${encodeURIComponent(report.name)}`} className="mt-4 inline-flex text-[12px] font-semibold text-brand no-underline hover:underline">Open report →</Link>
              </article>
            ))}
          </SavedSection>
        </section>

        <section className="paper-panel mt-10 flex flex-col gap-5 p-7 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="flex items-start gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-brand/30 bg-brand-weak text-brand"><Sparkles className="h-5 w-5" /></span><div><h2 className="text-[18px] font-semibold tracking-[-0.025em] text-ink">Keep the dashboard intentional</h2><p className="mt-2 max-w-2xl text-[13.5px] leading-6 text-ink-secondary">You can analyze unlimited files. When all three saved slots are full, remove one from this dashboard before saving another.</p></div></div>
          <Link href="/new-file" className="inline-flex shrink-0 items-center gap-2 rounded-full border border-brand/30 bg-brand-weak px-4 py-2.5 text-[13px] font-semibold text-brand no-underline hover:bg-brand hover:text-paper">Analyze a file <ArrowRight className="h-4 w-4" /></Link>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="paper-panel p-5"><p className="section-kicker">{label}</p><p className="mt-3 font-display text-[38px] leading-none tracking-[-0.04em] text-ink">{value}</p><p className="mt-2 text-[12.5px] text-ink-secondary">{detail}</p></div>;
}

function SavedSection({ title, eyebrow, empty, action, children }: { title: string; eyebrow: string; empty: string; action: string; children?: React.ReactNode }) {
  return <section className="paper-panel p-6 sm:p-7"><div className="flex items-end justify-between gap-4"><div><p className="section-kicker">{eyebrow}</p><h2 className="mt-2 text-[20px] font-semibold tracking-[-0.025em] text-ink">{title}</h2></div><FileBarChart2 className="h-5 w-5 text-brand" /></div><div className="mt-6 space-y-3">{children || <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[13px] leading-6 text-ink-secondary">{empty}<br /><span className="font-semibold text-brand">{action}</span></p>}</div></section>;
}
