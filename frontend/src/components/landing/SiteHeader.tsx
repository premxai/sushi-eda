import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/common/Logo";

const NAV_LINKS = [
  { href: "/docs", label: "Docs" },
  { href: "/examples", label: "Examples" },
  { href: "/compare", label: "Compare" },
  { href: "/datasets", label: "Datasets" },
  { href: "/changelog", label: "Changelog" },
  { href: "/privacy", label: "Privacy" },
];

interface SiteHeaderProps {
  showCta?: boolean;
}

export function SiteHeader({ showCta = false }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-paper/85 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 no-underline">
          <Logo size={30} />
          <span className="text-[16px] font-semibold tracking-tight text-ink">Sushi</span>
        </Link>
        <nav className="hidden items-center gap-1 sm:flex" aria-label="Main">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded px-2.5 py-1.5 text-[13px] text-ink-secondary no-underline transition-colors hover:bg-surface-2 hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        {showCta && (
          <a
            href="#upload"
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-paper no-underline transition-opacity hover:opacity-90"
          >
            Get started
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </header>
  );
}
