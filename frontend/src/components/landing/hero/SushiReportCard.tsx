import { ArrowUp } from "lucide-react";
import { HERO_STATS } from "@/components/landing/hero/heroData";

const DONUT_SEGMENTS = [
  { frac: 0.2, color: "#d86645" },
  { frac: 0.15, color: "#a7bda0" },
  { frac: 0.4, color: "#2f6d3a" },
  { frac: 0.25, color: "#8fae6a" },
];

const BARS = [
  { h: 32, color: "#8fae6a" },
  { h: 54, color: "#2f6d3a" },
  { h: 44, color: "#3f6b47" },
  { h: 60, color: "#e08a5a" },
  { h: 80, color: "#d86645" },
  { h: 100, color: "#c9502f" },
];

/** Coded recreation of the "SUSHI REPORT" reference card. */
export function SushiReportCard({ className }: { className?: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  let acc = 0;

  return (
    <div className={`rounded-2xl border border-border bg-surface p-5 shadow-lg ${className ?? ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink">Sushi Report</p>
          <h3 className="mt-1.5 text-[18px] font-bold leading-tight text-ink">Executive Summary</h3>
          <p className="mt-1.5 max-w-[15rem] text-[12.5px] leading-snug text-ink-secondary">
            Revenue grew 18.6% QoQ, strongest performance in the East region.
          </p>
        </div>
        <div className="relative shrink-0">
          <svg width="82" height="82" viewBox="0 0 92 92" aria-hidden>
            {DONUT_SEGMENTS.map((s, i) => {
              const len = s.frac * c;
              const dash = `${len} ${c - len}`;
              const offset = -acc * c;
              acc += s.frac;
              return (
                <circle
                  key={i}
                  cx="46"
                  cy="46"
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="9"
                  strokeDasharray={dash}
                  strokeDashoffset={offset}
                  transform="rotate(-90 46 46)"
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[15px] font-bold leading-none text-ink">18.6%</span>
            <span className="mt-0.5 text-[8.5px] text-ink-secondary">QoQ Growth</span>
          </div>
        </div>
      </div>

      <div className="my-4 h-px bg-border" />

      <div className="flex items-end justify-between gap-3">
        {HERO_STATS.map((s) => (
          <div key={s.label}>
            <p className="text-[11px] text-ink-tertiary">{s.label}</p>
            <p className="mt-1 text-[19px] font-bold leading-none text-ink">{s.value}</p>
            <p className="mt-1.5 flex items-center gap-0.5 text-[11.5px] font-medium text-success">
              <ArrowUp className="h-3 w-3" /> {s.delta}
            </p>
          </div>
        ))}
        <svg width="88" height="56" viewBox="0 0 88 56" aria-hidden className="shrink-0 self-end">
          {BARS.map((b, i) => {
            const bw = 10;
            const gap = 4;
            const x = i * (bw + gap);
            const h = (b.h / 100) * 52;
            return <rect key={i} x={x} y={56 - h} width={bw} height={h} rx="1.5" fill={b.color} />;
          })}
        </svg>
      </div>
    </div>
  );
}
