import React from "react";

/** The Sushi mark, recreated in SVG (crisp at any size): a coral roundel
 * reading as both a sunrise and a sushi-roll cross-section — a paper sun
 * disc over two paper wave bands. Uses the brand coral token so it stays
 * on-theme in light and dark mode. */
export function Logo({ size = 30, className }: { size?: number; className?: string }) {
  const id = React.useId();
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className} role="img" aria-label="Sushi">
      <defs>
        <clipPath id={`${id}-c`}>
          <circle cx="20" cy="20" r="19" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-c)`}>
        <circle cx="20" cy="20" r="19" fill="var(--brand)" />
        {/* rising sun */}
        <circle cx="20" cy="16" r="6.5" fill="var(--paper)" />
        {/* two wave bands */}
        <path d="M-2 27 Q 8 22 20 27 T 42 27 V 42 H -2 Z" fill="var(--paper)" />
        <path d="M-2 33 Q 10 28 20 33 T 42 33" stroke="var(--brand)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return <span className={className}>Sushi</span>;
}
