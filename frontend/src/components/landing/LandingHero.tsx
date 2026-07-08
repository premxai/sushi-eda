"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { PromiseCards } from "@/components/landing/PromiseCards";
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
      <SiteHeader />

      <section className="container pb-8 pt-16 text-center sm:pt-24">
        <p className="eyebrow">Data reports for people who aren&apos;t analysts</p>
        <h1 className="mx-auto mt-4 max-w-2xl font-display text-hero text-ink text-balance">
          A data report you can <em className="italic text-brand">trust</em>, in minutes.
        </h1>
        <p className="mx-auto mt-5 max-w-lg text-[16px] leading-relaxed text-ink-secondary">
          Drop in a CSV, survey export, or usage dump. Get a plain-English report you can show your team — no code,
          no analyst required.
        </p>
      </section>

      <section className="container pb-4">
        <div className="mx-auto max-w-xl">
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

          <p className="mt-4 text-center text-[12px] text-ink-tertiary">
            Your file is deleted after 7 days.{" "}
            <Link href="/privacy" className="text-ink-secondary underline underline-offset-2 hover:text-ink">
              How we handle your data
            </Link>
          </p>
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
