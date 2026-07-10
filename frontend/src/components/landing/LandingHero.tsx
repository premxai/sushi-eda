"use client";

import Link from "next/link";
import Image from "next/image";
import { useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import { BarChart3, Lock, Share2, ShieldCheck, Sparkles, X } from "lucide-react";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { HeroConnectionLines } from "@/components/landing/hero/HeroConnectionLines";
import { RawCsvCard } from "@/components/landing/hero/RawCsvCard";
import { CleanedDataCard } from "@/components/landing/hero/CleanedDataCard";
import { SushiReportCard } from "@/components/landing/hero/SushiReportCard";
import { UploadDropzone } from "@/components/upload/UploadDropzone";
import { UploadProgress } from "@/components/upload/UploadProgress";
import { JobStatus } from "@/hooks/useJobStream";
import { Logo } from "@/components/common/Logo";
import { cn } from "@/lib/utils";

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

const NAV_LINKS = [
  { href: "/docs", label: "Docs" },
  { href: "/examples", label: "Examples" },
  { href: "/docs#pricing", label: "Pricing" },
  { href: "/privacy", label: "Privacy" },
];

export function LandingHero(props: LandingHeroProps) {
  return (
    <div className="hero-page bg-paper">
      <DesktopHero {...props} />
      <MobileHero {...props} />
      <footer className="border-t border-border py-8">
        <div className="container flex flex-col items-center justify-between gap-3 text-[12.5px] text-ink-tertiary sm:flex-row">
          <span>© {new Date().getFullYear()} Sushi</span>
          <div className="flex gap-4">
            <Link href="/docs" className="text-ink-tertiary no-underline hover:text-ink">Docs</Link>
            <Link href="/privacy" className="text-ink-tertiary no-underline hover:text-ink">Privacy</Link>
            <Link href="/changelog" className="text-ink-tertiary no-underline hover:text-ink">Changelog</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function DesktopHero({
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
  const viewportRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const shell = viewport.parentElement;

    const resizeStage = () => {
      const containerWidth = shell?.clientWidth ?? viewport.clientWidth;
      const availableHeight = window.innerHeight;
      const scale = Math.min(containerWidth / 1920, availableHeight / 1080);
      viewport.style.setProperty("--hero-scale", String(scale));
      viewport.style.height = `${1080 * scale}px`;
    };

    const observer = new ResizeObserver(resizeStage);
    observer.observe(shell ?? viewport);
    window.addEventListener("resize", resizeStage);
    resizeStage();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resizeStage);
    };
  }, []);

  return (
    <section className="sushiHeroShell" aria-label="Sushi data analysis">
      <div ref={viewportRef} className="sushiHeroViewport">
      <div className="sushiHeroStage">
        <Image src="/sushi/hero/background-paper-16x9.png" alt="" fill priority className="hero-background" sizes="100vw" />

        <header className="hero-reference-header">
          <Link href="/" className="hero-reference-logo" aria-label="Sushi home">
            <Logo size={58} />
            <span>Sushi</span>
          </Link>
          <nav aria-label="Main" className="hero-reference-nav">
            {NAV_LINKS.map((link) => <Link key={link.label} href={link.href}>{link.label}</Link>)}
          </nav>
          <a href="#upload-desktop" className="hero-reference-cta">Get started free <span aria-hidden>→</span></a>
        </header>

        <Image src="/sushi/hero/japanese-left.png?v=3" alt="" width={941} height={1672} className="hero-japanese-left" />
        <Image src="/sushi/hero/japanese-right.png?v=3" alt="" width={887} height={1774} className="hero-japanese-right" />

        <div className="hero-reference-copy">
          <p className="hero-reference-eyebrow">Data reports for people who aren&apos;t analysts</p>
          <h1>
            <span>Your <em>RAW</em> Data</span>
            <span>Served <em>Perfectly.</em></span>
          </h1>
          <p className="hero-reference-subtitle">Upload your CSVs. Sushi turns complex data<br />into clear, plain-English reports in minutes.</p>
          {topError && <div className="hero-reference-error"><span>{topError}</span><button onClick={onClearTopError} aria-label="Dismiss"><X className="h-4 w-4" /></button></div>}
        </div>

        <div id="upload-desktop" className="hero-reference-upload">
          {isUploading ? (
            <UploadProgress status={jobStatus} progress={jobProgress} stage={jobStage} error={jobError} onRetry={onRetry} />
          ) : (
            <UploadDropzone hero onFileAccepted={onFileAccepted} onSample={onSample} />
          )}
        </div>

        <RawCsvCard compact className="hero-raw-card" />
        <CleanedDataCard className="hero-cleaned-card" />
        <SushiReportCard className="hero-report-card" />
        <FlowPill className="hero-private-pill" icon={<Lock className="h-4 w-4" />}>Secure &amp; Private</FlowPill>
        <FlowPill className="hero-action-pill" icon={<Sparkles className="h-4 w-4" />}>Clear. Actionable. Beautiful.</FlowPill>
        <HeroConnectionLines />
        <Image src="/sushi/hero/chef-transparent.png?v=1" alt="Sushi chef preparing a data-inspired sushi roll" width={1086} height={1448} className="hero-chef" />
        <p className="hero-workflow"><span>Raw CSVs in</span><b>→</b><span className="matcha">Cleaned Data out</span><b>→</b><span className="coral">Clear Insights delivered</span></p>
        <FeatureRow />
      </div>
      </div>
    </section>
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
  onSample,
  onRetry,
}: LandingHeroProps) {
  return (
    <div className="hero-mobile-shell">
      <SiteHeader showCta />
      <main className="container py-14 text-center">
        <p className="section-kicker justify-center">Data reports for people who aren&apos;t analysts</p>
        <h1 className="mx-auto mt-4 max-w-2xl font-display text-hero text-ink text-balance">Your <em className="font-display italic text-brand">RAW</em> Data<br />Served <em className="font-display italic text-brand">Perfectly.</em></h1>
        <p className="mx-auto mt-5 max-w-lg text-[16px] leading-relaxed text-ink-secondary">Upload your CSVs. Sushi turns complex data into clear, plain-English reports in minutes.</p>
        <div id="upload" className="mx-auto mt-8 max-w-xl text-left">
          {topError && <div className="mb-4 flex items-start gap-3 rounded-md border border-danger/25 bg-danger-weak px-4 py-3 text-[13px]"><p className="flex-1 text-ink-secondary">{topError}</p><button onClick={onClearTopError} aria-label="Dismiss"><X className="h-3.5 w-3.5" /></button></div>}
          {isUploading ? <UploadProgress status={jobStatus} progress={jobProgress} stage={jobStage} error={jobError} onRetry={onRetry} /> : <UploadDropzone onFileAccepted={onFileAccepted} onSample={onSample} />}
          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[12px] text-ink-tertiary"><ShieldCheck className="h-3.5 w-3.5 text-success" />Your file is deleted after 7 days. <Link href="/privacy" className="underline underline-offset-2">Privacy details</Link></p>
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

function FlowPill({ className, icon, children }: { className: string; icon: ReactNode; children: ReactNode }) {
  return <div className={cn("hero-flow-pill", className)}>{icon}{children}</div>;
}

function FeatureRow() {
  const items = [
    { icon: ShieldCheck, title: "Privacy by Design", body: "Your data stays yours." },
    { icon: Sparkles, title: "Plain-English Reports", body: "No jargon. Just insights." },
    { icon: BarChart3, title: "Charts That Tell the Story", body: "Automated visuals that make sense." },
    { icon: Share2, title: "Export & Share", body: "PDF, CSV, and more." },
  ];
  return <div className="hero-feature-row">{items.map(({ icon: Icon, title, body }, index) => <div key={title} className="hero-feature-item"><span className={index === 2 ? "matcha" : "coral"}><Icon /></span><div><strong>{title}</strong><small>{body}</small></div></div>)}</div>;
}
