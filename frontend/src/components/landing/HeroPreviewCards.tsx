import Image from "next/image";
import { ShieldCheck, Sparkles } from "lucide-react";
import { RawCsvCard } from "@/components/landing/hero/RawCsvCard";
import { SushiReportCard } from "@/components/landing/hero/SushiReportCard";
import { HeroConnectionLines } from "@/components/landing/hero/HeroConnectionLines";

/** The illustrated right half of the hero. Only the chef photo is a real
 * image asset; the RAW CSV and SUSHI REPORT cards, the pills, and the
 * coral connection lines are all coded so they stay crisp and responsive.
 * Shown only on very wide screens where there's room for it. */
export function HeroPreviewCards() {
  return (
    <div aria-hidden className="pointer-events-none relative hidden h-[760px] w-full select-none 2xl:block">
      <HeroConnectionLines className="absolute inset-0 h-full w-full" />

      <div className="absolute right-0 top-0 h-full w-[340px]">
        <Image src="/sushi/hero/chef-data-sushi.webp" alt="" fill sizes="340px" className="object-contain object-top" priority />
      </div>

      <RawCsvCard className="absolute left-0 top-[24px] w-[290px]" />
      <div className="absolute left-[24px] top-[392px] flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[11.5px] font-medium text-ink shadow-sm">
        <ShieldCheck className="h-3.5 w-3.5 text-brand" />
        Secure &amp; Private
      </div>

      <SushiReportCard className="absolute left-0 top-[440px] w-[320px]" />
      <div className="absolute left-[36px] top-[706px] flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[11.5px] font-medium text-ink shadow-sm">
        <Sparkles className="h-3.5 w-3.5 text-brand" />
        Clear. Actionable. Beautiful.
      </div>
    </div>
  );
}
