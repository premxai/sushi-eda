import React from "react";

/** A restrained mark: a rounded square holding a small ascending-bar
 * glyph — reads as "analytics" without being literal or cute. Ink/paper
 * colors flip automatically with the theme via CSS variables. */
export function Logo({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} role="img" aria-label="Sushi">
      <rect x="0.5" y="0.5" width="31" height="31" rx="8" fill="var(--ink)" />
      <rect x="8" y="17" width="4" height="8" rx="1" fill="var(--brand)" />
      <rect x="14" y="12" width="4" height="13" rx="1" fill="var(--paper)" opacity="0.9" />
      <rect x="20" y="7" width="4" height="18" rx="1" fill="var(--brand)" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return <span className={className}>Sushi</span>;
}
