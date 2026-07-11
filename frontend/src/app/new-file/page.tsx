"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { UploadDropzone } from "@/components/upload/UploadDropzone";
import { getApiErrorMessage, uploadFileAsync } from "@/lib/api";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const REPORT_KEYS = ["sushi_report", "sushi_filename", "sushi_dataset_id", "sushi_narrative", "sushi_sample_mode"];

export default function NewFilePage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      router.replace("/sign-in?next=/new-file");
      return;
    }
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return router.replace("/sign-in?next=/new-file");
      setIsAuthenticated(true);
      setCheckingAuth(false);
    });
  }, [router]);

  const handleFileAccepted = useCallback(async (file: File) => {
    if (!isAuthenticated) return router.replace("/sign-in?next=/new-file");
    setIsUploading(true);
    setError(null);
    try {
      const result = await uploadFileAsync(file);
      REPORT_KEYS.forEach((key) => sessionStorage.removeItem(key));
      router.replace(`/?pending=${encodeURIComponent(result.dataset_id)}&name=${encodeURIComponent(file.name)}`);
    } catch (err) {
      setError(getApiErrorMessage(err, "Upload failed. Please try again."));
      setIsUploading(false);
    }
  }, [isAuthenticated, router]);

  if (checkingAuth) return <main className="app-paper-page grid min-h-screen place-items-center"><Loader2 className="h-6 w-6 animate-spin text-brand" /></main>;

  return (
    <main className="app-paper-page min-h-screen">
      <SiteHeader />
      <div className="container py-12 sm:py-16">
        <Link href="/dashboard" className="text-[13px] font-medium text-ink-secondary no-underline hover:text-ink">← Overview dashboard</Link>
        <div className="mx-auto mt-10 max-w-2xl text-center">
          <p className="section-kicker">New analysis</p>
          <h1 className="mt-4 font-display text-[52px] leading-[0.94] tracking-[-0.045em] text-ink sm:text-[68px]">Bring us your <span className="text-brand">data.</span></h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-7 text-ink-secondary">Choose a file and Sushi will prepare a clear report with quality checks, fields, charts, and practical insights.</p>
        </div>
        <section className="mx-auto mt-10 max-w-xl paper-panel p-5 sm:p-7">
          {isUploading ? (
            <div className="grid min-h-72 place-items-center text-center"><div><Loader2 className="mx-auto h-7 w-7 animate-spin text-brand" /><p className="mt-4 text-[16px] font-semibold text-ink">Preparing your analysis…</p><p className="mt-2 text-[13px] text-ink-secondary">We’ll open the report as soon as it’s ready.</p></div></div>
          ) : (
            <UploadDropzone onFileAccepted={handleFileAccepted} onSample={async () => router.push("/?sample=1")} />
          )}
          {error && <p role="alert" className="mt-4 rounded-xl border border-danger/25 bg-danger-weak px-4 py-3 text-[13px] text-danger">{error}</p>}
          <p className="mt-5 flex items-center justify-center gap-2 text-center text-[12px] leading-5 text-ink-tertiary"><ShieldCheck className="h-4 w-4 shrink-0 text-success" />Your file is private and automatically deleted after 7 days.</p>
        </section>
      </div>
    </main>
  );
}
