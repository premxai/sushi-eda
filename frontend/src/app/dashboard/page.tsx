"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, FilePlus2, ShieldCheck, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function DashboardPage() {
  const [name, setName] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      const metadata = data.user?.user_metadata as { full_name?: string; name?: string } | undefined;
      setName(metadata?.full_name || metadata?.name || data.user?.email?.split("@")[0] || "there");
    });
  }, []);

  return (
    <main className="app-paper-page min-h-screen">
      <SiteHeader />
      <div className="container py-12 sm:py-16">
        <p className="section-kicker">Sushi workspace</p>
        <div className="mt-4 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h1 className="font-display text-[52px] leading-[0.94] tracking-[-0.045em] text-ink sm:text-[68px]">Welcome back{ name ? `, ${name}` : "" }.</h1>
            <p className="mt-5 max-w-xl text-[16px] leading-7 text-ink-secondary">Start with a file, then let Sushi turn the structure, quality, and patterns into a report you can actually use.</p>
          </div>
          <Link href="/new-file" className="inline-flex w-fit items-center gap-2 rounded-full bg-ink px-5 py-3 text-[13px] font-semibold text-paper no-underline transition-opacity hover:opacity-90"><FilePlus2 className="h-4 w-4" />Add new file</Link>
        </div>

        <section className="mt-12 grid gap-5 lg:grid-cols-[1.45fr_0.85fr]">
          <div className="paper-panel overflow-hidden p-7 sm:p-9">
            <span className="grid h-12 w-12 place-items-center rounded-full border border-brand/30 bg-brand-weak text-brand"><Sparkles className="h-5 w-5" /></span>
            <p className="section-kicker mt-7">Start an analysis</p>
            <h2 className="mt-3 max-w-xl font-display text-[43px] leading-[0.98] tracking-[-0.04em] text-ink">A fresh file,<br /><span className="text-brand">served clearly.</span></h2>
            <p className="mt-5 max-w-lg text-[14px] leading-7 text-ink-secondary">CSV, TSV, XLSX, JSON, Parquet, and SQLite files up to 25 MB are ready for a focused quality and insight report.</p>
            <Link href="/new-file" className="mt-7 inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand-weak px-5 py-2.5 text-[13px] font-semibold text-brand no-underline hover:bg-brand hover:text-paper">Choose a file <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="paper-panel flex flex-col justify-between p-7 sm:p-8">
            <div>
              <span className="grid h-11 w-11 place-items-center rounded-full border border-success/30 bg-success-weak text-success"><ShieldCheck className="h-5 w-5" /></span>
              <h2 className="mt-6 text-[18px] font-semibold tracking-[-0.025em] text-ink">Private by design</h2>
              <p className="mt-3 text-[13.5px] leading-6 text-ink-secondary">Your uploaded file is kept with your account and automatically removed after seven days.</p>
            </div>
            <Link href="/privacy" className="mt-8 text-[13px] font-semibold text-brand no-underline hover:underline">Read privacy details →</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
