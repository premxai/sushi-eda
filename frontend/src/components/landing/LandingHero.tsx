"use client";

import Link from "next/link";
import Image from "next/image";
import { ShieldCheck, X } from "lucide-react";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { PromiseCards } from "@/components/landing/PromiseCards";
import { HeroPreviewCards } from "@/components/landing/HeroPreviewCards";
import { UploadDropzone } from "@/components/upload/UploadDropzone";
import { UploadProgress } from "@/components/upload/UploadProgress";
import { JobStatus } from "@/hooks/useJobStream";

interface LandingHeroProps {
  isUploading: boolean;
  jobStatus: JobStatus;
  jobProgress: number;
  jobStage: string;
  jobError: string | null;
  topError: string | null;
  onClearTopError: () => void;
  onFileAccepted: (file: File) => void;
  onSample: () => void;
  onRetry: () => void;
}

export function LandingHero({
  isUploading,
  jobStatus,
  jobProgress,
  jobStage,
  jobError,
  topError,
  onClearTopError,
  onFileAccepted,
  onSample,
  onRetry,
}: LandingHeroProps) {
  return (
    <div className="min-h-screen bg-paper">
      <SiteHeader showCta />

      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <Image src="/hero/inkwash-bg.png" alt="" fill priority className="object-cover opacity-90" sizes="100vw" />
        </div>

        <div className="container relative grid grid-cols-1 gap-10 pb-8 pt-16 sm:pt-24 2xl:grid-cols-[minmax(0,600px)_1fr] 2xl:items-start 2xl:gap-4">
          <div className="relative text-center 2xl:text-left">
            <div className="pointer-events-none absolute -left-16 top-1/2 hidden h-[380px] w-[52px] -translate-y-1/2 2xl:block">
              <Image src="/hero/vertical-text-value.png" alt="" fill sizes="52px" className="object-contain" />
            </div>

            <p className="eyebrow">Data reports for people who aren&apos;t analysts</p>
            <h1 className="mx-auto mt-4 max-w-2xl font-display text-hero text-ink text-balance 2xl:mx-0">
              Your <em className="mx-1 font-display italic text-brand">RAW</em> Data Served Perfectly.
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-[16px] leading-relaxed text-ink-secondary 2xl:mx-0">
              Drop in a CSV, survey export, or usage dump. Get a plain-English report you can show your team. No code,
              no analyst required.
            </p>

            <div id="upload" className="mx-auto mt-8 max-w-xl 2xl:mx-0">
              {topError && (
                <div className="mb-4 flex items-start gap-3 rounded-md border border-danger/25 bg-danger-weak px-4 py-3 text-[13px]">
                  <p className="flex-1 text-ink-secondary">{topError}</p>
                  <button onClick={onClearTopError} aria-label="Dismiss" className="text-ink-tertiary hover:text-ink">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {isUploading ? (
                <UploadProgress status={jobStatus} progress={jobProgress} stage={jobStage} error={jobError} onRetry={onRetry} />
              ) : (
                <UploadDropzone onFileAccepted={onFileAccepted} onSample={onSample} />
              )}

              <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[12px] text-ink-tertiary 2xl:justify-start">
                <ShieldCheck className="h-3.5 w-3.5 text-success" />
                Your file is deleted after 7 days.{" "}
                <Link href="/privacy" className="text-ink-secondary underline underline-offset-2 hover:text-ink">
                  How we handle your data
                </Link>
              </p>
            </div>

            <div className="mx-auto mt-8 hidden max-w-xl items-center gap-2 text-[12.5px] font-medium text-ink-tertiary 2xl:mx-0 2xl:flex">
              <span className="text-ink-secondary">Raw CSVs in</span>
              <span aria-hidden>&rarr;</span>
              <span className="text-success">Cleaned data out</span>
              <span aria-hidden>&rarr;</span>
              <span className="text-brand">Clear insights delivered</span>
            </div>
          </div>

          <HeroPreviewCards />
        </div>
      </section>

      <section className="container py-20">
        <PromiseCards />
      </section>

      <footer className="border-t border-border py-8">
        <div className="container flex flex-col items-center justify-between gap-3 text-[12.5px] text-ink-tertiary sm:flex-row">
          <span>© {new Date().getFullYear()} Sushi</span>
          <div className="flex gap-4">
            <Link href="/docs" className="text-ink-tertiary no-underline hover:text-ink">
              Docs
            </Link>
            <Link href="/privacy" className="text-ink-tertiary no-underline hover:text-ink">
              Privacy
            </Link>
            <Link href="/changelog" className="text-ink-tertiary no-underline hover:text-ink">
              Changelog
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
