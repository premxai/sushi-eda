import React from "react";

const NORI = "#26282b";
const PAPER = "#ffffff";
const SALMON = "#f0876a";
const TUNA = "#c0392e";
const WASABI = "#86a050";

/** The Sushi mark: a dark nori ring around a rice-paper field, split
 * into a data "nigiri" of four quadrants (salmon, tuna, wasabi, paper)
 * with a small ascending bar chart in the paper cell. A fixed brand
 * asset, so its colors stay constant across light and dark mode. */
export function Logo({ size = 26, className }: { size?: number; className?: string }) {
  const id = React.useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className} role="img" aria-label="Sushi">
      <defs>
        <clipPath id={`${id}-clip`}>
          <circle cx="32" cy="32" r="24" />
        </clipPath>
      </defs>

      <circle cx="32" cy="32" r="31" fill={NORI} />
      <circle cx="32" cy="32" r="24" fill={PAPER} />

      <g clipPath={`url(#${id}-clip)`}>
        <rect x="8" y="8" width="24" height="24" fill={SALMON} />
        <rect x="8" y="32" width="24" height="24" fill={TUNA} />
        <rect x="32" y="32" width="24" height="24" fill={WASABI} />
        <rect x="32" y="8" width="24" height="24" fill={PAPER} />

        <rect x="35.5" y="26" width="4" height="8" rx="0.75" fill={SALMON} />
        <rect x="41.5" y="20" width="4" height="14" rx="0.75" fill={TUNA} />
        <rect x="47.5" y="13" width="4" height="21" rx="0.75" fill={WASABI} />
      </g>
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return <span className={className}>Sushi</span>;
}
