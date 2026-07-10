"use client";

import Link from "next/link";
import Image from "next/image";
import { useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Lock, Sparkles } from "lucide-react";
import type { LandingHeroProps } from "@/components/landing/LandingHero";
import { HeroConnectionLines } from "@/components/landing/hero/HeroConnectionLines";
import { HeroJapaneseTextLeft, HeroJapaneseTextRight } from "@/components/landing/hero/HeroJapaneseText";
import { CleanedDataCard } from "@/components/landing/hero/CleanedDataCard";
import { FeatureRow } from "@/components/landing/hero/FeatureRow";
import { HeroUploadCard } from "@/components/landing/hero/HeroUploadCard";
import { RawCsvCard } from "@/components/landing/hero/RawCsvCard";
import { SushiReportCard } from "@/components/landing/hero/SushiReportCard";
import { Logo } from "@/components/common/Logo";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/docs", label: "Docs" },
  { href: "/examples", label: "Examples" },
  { href: "/docs#pricing", label: "Pricing" },
  { href: "/privacy", label: "Privacy" },
];

/** The desktop-only 1920×1080 composition. Every visual layer shares this stage. */
export function SushiHero({
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
            <a href="#upload-desktop" className="hero-reference-cta">Get started free <span aria-hidden>{"\u2192"}</span></a>
          </header>

          <div className="hero-reference-copy">
            <h1>
              <span>Your <em>RAW</em> Data</span>
              <span>Served <em>Perfectly.</em></span>
            </h1>
            <p className="hero-reference-subtitle">Upload your CSVs. Sushi turns complex data<br />into clear, plain-English reports in minutes.</p>
            {topError && <div className="hero-reference-error"><span>{topError}</span><button onClick={onClearTopError} aria-label="Dismiss"><span aria-hidden>×</span></button></div>}
          </div>

          <Image src="/sushi/hero/chef-transparent.png?v=1" alt="Sushi chef preparing a data-inspired sushi roll" width={1086} height={1448} className="hero-chef" />

          <HeroUploadCard
            isUploading={isUploading}
            jobStatus={jobStatus}
            jobProgress={jobProgress}
            jobStage={jobStage}
            jobError={jobError}
            onFileAccepted={onFileAccepted}
            onSample={onSample}
            onRetry={onRetry}
          />

          <RawCsvCard compact className="hero-raw-card" />
          <CleanedDataCard className="hero-cleaned-card" />
          <SushiReportCard className="hero-report-card" />
          <HeroConnectionLines />
          <HeroJapaneseTextLeft className="hero-japanese-left" />
          <HeroJapaneseTextRight className="hero-japanese-right" />
          <FlowPill className="hero-private-pill" icon={<Lock className="h-4 w-4" />}>Secure &amp; Private</FlowPill>
          <FlowPill className="hero-action-pill" icon={<Sparkles className="h-4 w-4" />}>Clear. Actionable. Beautiful.</FlowPill>
          <p className="hero-workflow"><span>Raw CSVs in</span><b>{"\u2192"}</b><span className="matcha">Cleaned Data out</span><b>{"\u2192"}</b><span className="coral">Clear Insights delivered</span></p>
          <FeatureRow />
        </div>
      </div>
    </section>
  );
}

function FlowPill({ className, icon, children }: { className: string; icon: ReactNode; children: ReactNode }) {
  return <div className={cn("hero-flow-pill", className)}>{icon}{children}</div>;
}
