/** Live, coded vertical Japanese decoration (no image). Left variant reads
 * "データを価値に変える" (turn data into value) with a 寿司 seal; right
 * variant is a large "洞察" (insight) with a vertical INSIGHT label and seal. */

function Seal({ children }: { children: string }) {
  return (
    <span
      className="flex flex-col items-center gap-1 rounded-[6px] border-[1.5px] border-brand px-1.5 py-2 font-display text-[15px] leading-none text-brand"
      style={{ writingMode: "vertical-rl" }}
    >
      {children}
    </span>
  );
}

export function HeroJapaneseTextLeft({ className }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-5 ${className ?? ""}`} aria-hidden>
      <span className="font-display text-[26px] leading-[1.35] tracking-[0.15em] text-ink" style={{ writingMode: "vertical-rl" }}>
        データを価値に変える
      </span>
      <Seal>寿司</Seal>
    </div>
  );
}

export function HeroJapaneseTextRight({ className }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-4 ${className ?? ""}`} aria-hidden>
      <div className="flex items-start gap-2">
        <span className="font-display text-[40px] font-medium leading-[1.1] text-ink" style={{ writingMode: "vertical-rl" }}>
          洞察
        </span>
        <span className="mt-2 text-[11px] font-medium uppercase tracking-[0.35em] text-ink-tertiary" style={{ writingMode: "vertical-rl" }}>
          Insight
        </span>
      </div>
      <Seal>寿司</Seal>
    </div>
  );
}
