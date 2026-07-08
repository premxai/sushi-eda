import React from "react";
import { cn } from "@/lib/utils";

type StampTone = "salmon" | "tuna" | "wasabi" | "ink";

const TONE_VAR: Record<StampTone, string> = {
  salmon: "var(--salmon)",
  tuna: "var(--tuna)",
  wasabi: "var(--wasabi)",
  ink: "var(--ink)",
};

interface HankoStampProps {
  /** Big centered figure — a score, a grade letter, a short word. */
  value: string | number;
  /** Small curved/straight caption under the value, e.g. "VERIFIED CLEAN". */
  label?: string;
  tone?: StampTone;
  size?: number;
  /** Degrees, negative tilts counter-clockwise like a hand stamp. */
  rotation?: number;
  className?: string;
}

/**
 * A hanko/inspector's-seal mark: a rough-edged double ring stamped at an
 * angle, used wherever a number needs to read as "trust this," not just
 * "here's a number" — quality scores, verified exports, share pages.
 * The ragged edge comes from feTurbulence/feDisplacementMap on the ring
 * strokes, not a hand-drawn path, so it stays crisp at any size.
 */
export function HankoStamp({
  value,
  label,
  tone = "tuna",
  size = 84,
  rotation = -12,
  className,
}: HankoStampProps) {
  const id = React.useId();
  const color = TONE_VAR[tone];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={cn("select-none", className)}
      style={{ transform: `rotate(${rotation}deg)` }}
      role="img"
      aria-label={label ? `${value} — ${label}` : String(value)}
    >
      <defs>
        <filter id={`${id}-ink`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>

      <g filter={`url(#${id}-ink)`}>
        <circle cx="50" cy="50" r="45" fill="none" stroke={color} strokeWidth="3.5" opacity="0.9" />
        <circle cx="50" cy="50" r="37" fill="none" stroke={color} strokeWidth="1.6" opacity="0.7" />
      </g>

      <text
        x="50"
        y={label ? "48" : "56"}
        textAnchor="middle"
        fontFamily="var(--font-instrument-serif), Georgia, serif"
        fontSize={typeof value === "number" && value >= 100 ? "26" : "30"}
        fill={color}
      >
        {value}
      </text>

      {label && (
        <text
          x="50"
          y="66"
          textAnchor="middle"
          fontFamily="var(--font-inter), sans-serif"
          fontWeight={700}
          fontSize="6.5"
          letterSpacing="0.6"
          fill={color}
        >
          {label.toUpperCase()}
        </text>
      )}
    </svg>
  );
}
