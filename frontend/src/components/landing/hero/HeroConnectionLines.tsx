/** Curved coral/matcha "data flow" lines linking the upload handoff to the
 * RAW CSV card, down to the SUSHI REPORT card, and out to the sushi roll.
 * Pure SVG so it stays crisp; routed to avoid the chef's hands and face. */
export function HeroConnectionLines({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 700 760" fill="none" preserveAspectRatio="none" aria-hidden className={className}>
      {/* upload handoff -> RAW CSV card */}
      <path d="M40 350 C 40 250 90 150 200 140" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      {/* RAW CSV -> SUSHI REPORT */}
      <path d="M150 300 C 200 340 200 360 175 400" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      {/* SUSHI REPORT -> sushi roll */}
      <path d="M300 470 C 380 470 400 430 445 405" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" opacity="0.65" />
      <circle cx="40" cy="350" r="4" fill="var(--brand)" />
      <circle cx="200" cy="140" r="4" fill="var(--brand)" />
      <circle cx="175" cy="400" r="4" fill="var(--success)" />
      <circle cx="445" cy="405" r="4" fill="var(--brand)" />
    </svg>
  );
}
