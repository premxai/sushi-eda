import type { CSSProperties } from "react";
import Image from "next/image";

/** The exact supplied Sushi analytics mark, tightly cropped to its outer ring. */
export function Logo({ size = 30, className }: { size?: number; className?: string }) {
  const frameStyle: CSSProperties = {
    position: "relative",
    display: "inline-flex",
    flexShrink: 0,
    overflow: "hidden",
    width: size,
    height: size,
    borderRadius: "50%",
  };

  return (
    <span
      className={className}
      style={frameStyle}
      role="img"
      aria-label="Sushi"
    >
      <Image
        src="/sushi/hero/sushi-logo-exact.png"
        alt=""
        fill
        sizes={`${size}px`}
        unoptimized
        className="sushi-logo-exact"
        aria-hidden="true"
      />
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return <span className={className}>Sushi</span>;
}
