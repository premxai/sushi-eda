import Image from "next/image";

/** The real Sushi brand mark (public/logo.png): a dark nori ring around
 * a rice-paper field split into a data "nigiri" of four quadrants with
 * an ascending bar chart. A fixed brand asset, so it's the same image
 * across light and dark mode. */
export function Logo({ size = 26, className }: { size?: number; className?: string }) {
  return <Image src="/logo.png" alt="Sushi" width={size} height={size} className={className} priority unoptimized />;
}

export function Wordmark({ className }: { className?: string }) {
  return <span className={className}>Sushi</span>;
}
