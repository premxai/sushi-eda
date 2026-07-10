import Image from "next/image";
import { ShieldCheck, Sparkles } from "lucide-react";

/** The illustrated right half of the hero: the chef + sushi-roll photo,
 * a mocked "RAW CSV" card and a mocked "SUSHI REPORT" card connected by
 * curved coral lines, exactly as commissioned for the hero mockup.
 * Purely decorative marketing art (static, hardcoded numbers), shown
 * only on very wide screens where there's room for it. */
export function HeroPreviewCards() {
  return (
    <div aria-hidden className="pointer-events-none relative hidden h-[720px] w-full select-none 2xl:block">
      <svg viewBox="0 0 640 720" className="absolute inset-0 h-full w-full" fill="none">
        <path d="M280,190 C330,215 330,255 300,270" stroke="#d86645" strokeWidth="1.75" strokeLinecap="round" opacity="0.65" fill="none" />
        <path d="M150,300 C220,340 220,380 280,405" stroke="#5f7e4b" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" fill="none" />
        <circle cx="280" cy="190" r="4" fill="#d86645" />
        <circle cx="300" cy="270" r="4" fill="#d86645" />
        <circle cx="280" cy="405" r="4" fill="#5f7e4b" />
      </svg>

      <div className="absolute right-0 top-0 h-full w-[340px]">
        <Image src="/hero/chef-sushi-roll.png" alt="" fill sizes="340px" className="object-contain object-top" priority />
      </div>

      <div className="absolute left-0 top-[70px] w-[280px] drop-shadow-md">
        <Image src="/hero/card-raw-csv.png" alt="" width={1219} height={881} className="h-auto w-full" priority />
      </div>
      <div className="absolute left-[24px] top-[335px] flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[11.5px] font-medium text-ink shadow-sm">
        <ShieldCheck className="h-3.5 w-3.5 text-brand" />
        Secure &amp; Private
      </div>

      <div className="absolute left-0 top-[400px] w-[280px] drop-shadow-md">
        <Image src="/hero/card-sushi-report.png" alt="" width={1368} height={876} className="h-auto w-full" />
      </div>
      <div className="absolute left-[36px] top-[596px] flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[11.5px] font-medium text-ink shadow-sm">
        <Sparkles className="h-3.5 w-3.5 text-brand" />
        Clear. Actionable. Beautiful.
      </div>
    </div>
  );
}
