import React from "react";

/**
 * Sushi mark: a dark ring around a paper-white field holding a data
 * "nigiri" — four quadrants (salmon, tuna, wasabi, paper) plus a small
 * ascending bar chart in the top-right cell. Ring/field read from the
 * --ink/--paper tokens so the mark flips automatically in dark mode.
 */
export function SushiLogo({ size = 32, className }: { size?: number; className?: string }) {
  const id = React.useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Sushi logo"
    >
      <defs>
        <clipPath id={`${id}-clip`}>
          <circle cx="32" cy="32" r="20" />
        </clipPath>
      </defs>

      {/* dark ring + paper field */}
      <circle cx="32" cy="32" r="31" fill="var(--ink)" />
      <circle cx="32" cy="32" r="24" fill="var(--paper)" />

      {/* chart quadrants (2px gap through the centre) */}
      <g clipPath={`url(#${id}-clip)`}>
        <rect x="8" y="8" width="23" height="23" fill="var(--salmon)" />
        <rect x="8" y="33" width="23" height="23" fill="var(--tuna)" />
        <rect x="33" y="33" width="23" height="23" fill="var(--wasabi)" />
        <rect x="33" y="8" width="23" height="23" fill="var(--paper)" />

        {/* ascending bars in the top-right cell */}
        <rect x="35" y="23" width="3.4" height="7" rx="1" fill="var(--salmon)" />
        <rect x="40" y="20" width="3.4" height="10" rx="1" fill="var(--tuna)" />
        <rect x="45" y="17" width="3.4" height="13" rx="1" fill="var(--wasabi)" />
      </g>
    </svg>
  );
}
