import Link from "next/link";
import { ArrowRight, Menu } from "lucide-react";
import { Logo } from "@/components/common/Logo";

const NAV_LINKS = [
  { href: "/docs", label: "Docs" },
  { href: "/examples", label: "Examples" },
  { href: "/pricing", label: "Pricing" },
  { href: "/privacy", label: "Privacy" },
];

interface SiteHeaderProps {
  showCta?: boolean;
}

export function SiteHeader({ showCta = false }: SiteHeaderProps) {
  return (
    <header className="site-header sticky top-0 z-40 border-b border-border bg-paper/90 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 no-underline">
          <Logo size={30} />
          <span className="text-[18px] font-semibold tracking-[-0.04em] text-ink">Sushi</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
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
        <details className="relative md:hidden">
          <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full border border-border bg-surface text-ink [&::-webkit-details-marker]:hidden">
            <Menu className="h-[18px] w-[18px]" aria-hidden />
            <span className="sr-only">Open navigation</span>
          </summary>
          <nav className="absolute right-0 top-12 grid min-w-52 gap-1 rounded-2xl border border-border bg-surface p-2 shadow-lg" aria-label="Mobile navigation">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="rounded-lg px-3 py-2 text-[13px] text-ink-secondary no-underline hover:bg-surface-2 hover:text-ink">
                {link.label}
              </Link>
            ))}
          </nav>
        </details>
        {showCta && (
          <a
            href="/#upload"
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-paper no-underline transition-opacity hover:opacity-90"
          >
            Get started free
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </header>
  );
}
