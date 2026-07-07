import React from "react";

/**
 * Sushi mark — recreated as SVG from the brand logo: a dark ring around a
 * white field holding a data "sushi roll" (coral + red pie slices, a green
 * quadrant, and a small ascending bar chart). Scales cleanly at any size.
 *
 * To use the exact raster instead, drop it at /public/logo.png and swap this
 * for <Image src="/logo.png" .../>.
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

      {/* dark ring + white field */}
      <circle cx="32" cy="32" r="31" fill="#2C332F" />
      <circle cx="32" cy="32" r="24" fill="#FFFFFF" />

      {/* chart quadrants (2px white gap through the centre) */}
      <g clipPath={`url(#${id}-clip)`}>
        <rect x="8" y="8" width="23" height="23" fill="#EC7A63" />
        <rect x="8" y="33" width="23" height="23" fill="#CE4130" />
        <rect x="33" y="33" width="23" height="23" fill="#98C23D" />
        <rect x="33" y="8" width="23" height="23" fill="#FFFFFF" />

        {/* ascending bars in the top-right cell */}
        <rect x="35" y="23" width="3.4" height="7" rx="1" fill="#EC7A63" />
        <rect x="40" y="20" width="3.4" height="10" rx="1" fill="#CE4130" />
        <rect x="45" y="17" width="3.4" height="13" rx="1" fill="#98C23D" />
      </g>
    </svg>
  );
}
