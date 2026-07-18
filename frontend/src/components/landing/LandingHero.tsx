"use client";

import Link from "next/link";
import Image from "next/image";
import { ShieldCheck, X } from "lucide-react";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { FeatureRow } from "@/components/landing/hero/FeatureRow";
import { RawCsvCard } from "@/components/landing/hero/RawCsvCard";
import { CleanedDataCard } from "@/components/landing/hero/CleanedDataCard";
import { SushiReportCard } from "@/components/landing/hero/SushiReportCard";
import { SushiHero } from "@/components/landing/hero/SushiHero";
import { UploadDropzone } from "@/components/upload/UploadDropzone";
import { UploadProgress } from "@/components/upload/UploadProgress";
import { JobStatus } from "@/hooks/useJobStream";

export interface LandingHeroProps {
  isUploading: boolean;
  jobStatus: JobStatus;
  jobProgress: number;
  jobStage: string;
  jobError: string | null;
  topError: string | null;
  onClearTopError: () => void;
  onFileAccepted: (file: File) => void;
  uploadRequiresAuthentication: boolean;
  onAuthenticationRequired: () => void;
  onSample: () => Promise<void>;
  onRetry: () => void;
}

export function LandingHero(props: LandingHeroProps) {
  return (
    <div className="hero-page bg-paper">
      <SushiHero {...props} />
      <MobileHero {...props} />
    </div>
  );
}

function MobileHero({
  isUploading,
  jobStatus,
  jobProgress,
  jobStage,
  jobError,
  topError,
  onClearTopError,
  onFileAccepted,
  uploadRequiresAuthentication,
  onAuthenticationRequired,
  onSample,
  onRetry,
}: LandingHeroProps) {
  return (
    <div className="hero-mobile-shell">
      <SiteHeader showCta showAccount={false} />
      <main className="container py-14 text-center">
        <p className="section-kicker justify-center">Data reports for people who aren&apos;t analysts</p>
        <h1 className="mx-auto mt-4 max-w-2xl font-display text-hero text-ink text-balance">Your <em className="font-display italic text-brand">RAW</em> Data<br />Served <em className="font-display italic text-brand">Perfectly.</em></h1>
        <p className="mx-auto mt-5 max-w-lg text-[16px] leading-relaxed text-ink-secondary">Upload your files. Sushi turns complex data into clear, plain-English reports in minutes.</p>
        <div id="upload" className="mx-auto mt-8 max-w-xl text-left">
          {topError && <div className="mb-4 flex items-start gap-3 rounded-md border border-danger/25 bg-danger-weak px-4 py-3 text-[13px]"><p className="flex-1 text-ink-secondary">{topError}</p><button onClick={onClearTopError} aria-label="Dismiss"><X className="h-3.5 w-3.5" /></button></div>}
          {isUploading ? <UploadProgress status={jobStatus} progress={jobProgress} stage={jobStage} error={jobError} onRetry={onRetry} /> : <UploadDropzone onFileAccepted={onFileAccepted} onSample={onSample} uploadRequiresAuthentication={uploadRequiresAuthentication} onAuthenticationRequired={onAuthenticationRequired} />}
          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[12px] text-ink-tertiary"><ShieldCheck className="h-3.5 w-3.5 text-success" />Unsaved files are deleted after 7 days. <Link href="/privacy" className="underline underline-offset-2">Privacy details</Link></p>
        </div>
        <div className="hero-mobile-art" aria-hidden>
          <Image src="/sushi/hero/chef-transparent.png?v=1" alt="" width={1086} height={1448} />
        </div>
        <div className="hero-mobile-cards" aria-hidden>
          <RawCsvCard className="hero-mobile-card-item" />
          <CleanedDataCard className="hero-mobile-card-item" />
          <SushiReportCard className="hero-mobile-card-item" />
        </div>
        <div className="mt-12"><FeatureRow /></div>
      </main>
    </div>
  );
}
