/** Fixed design-coordinate flow lines for the supplied 1920x1080 hero frame. */
export function HeroConnectionLines({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1920 1080" fill="none" preserveAspectRatio="none" aria-hidden className={className}>
      <path d="M694 630 C 770 630 790 445 905 315" className="flow-coral" />
      <path d="M1065 345 C 1115 365 1110 398 1060 430" className="flow-coral-light" />
      <path d="M1265 520 C 1335 548 1335 598 1300 635" className="flow-matcha" />
      <path d="M1300 765 C 1415 765 1450 730 1535 710" className="flow-coral" />
      <circle cx="694" cy="630" r="5" fill="#D86645" />
      <circle cx="905" cy="315" r="5" fill="#D86645" />
      <circle cx="1060" cy="430" r="4" fill="#D86645" />
      <circle cx="1535" cy="710" r="5" fill="#D86645" />
    </svg>
  );
}
