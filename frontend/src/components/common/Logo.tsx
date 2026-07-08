import React from "react";

/** A sushi roll cross-section: a dark nori ring around a rice-paper
 * field, with a small ascending bar-chart glyph in antique gold at the
 * center standing in for data. Ink/paper/brand colors flip automatically
 * with the theme via CSS variables. */
export function Logo({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} role="img" aria-label="Sushi">
      <circle cx="16" cy="16" r="15.5" fill="var(--ink)" />
      <circle cx="16" cy="16" r="11.5" fill="var(--paper)" />
      <rect x="10.5" y="17" width="3" height="6.5" rx="1" fill="var(--brand)" />
      <rect x="14.5" y="13.5" width="3" height="10" rx="1" fill="var(--brand)" opacity="0.75" />
      <rect x="18.5" y="9.5" width="3" height="14" rx="1" fill="var(--brand)" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return <span className={className}>Sushi</span>;
}
