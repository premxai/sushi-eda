"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Logo } from "@/components/common/Logo";
import { AccountMenu } from "@/components/common/AccountMenu";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

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
  const [homeHref, setHomeHref] = useState("/");

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabaseBrowserClient();
    const sync = () => supabase.auth.getSession().then(({ data }) => setHomeHref(data.session ? "/dashboard" : "/"));
    void sync();
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => setHomeHref(session ? "/dashboard" : "/"));
    return () => subscription.subscription.unsubscribe();
  }, []);

  return (
    <header className="site-header sticky top-0 z-40 border-b border-border bg-paper/90 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Link href={homeHref} className="flex items-center gap-2 no-underline">
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
        <AccountMenu fallback={showCta ? "cta" : "sign-in"} />
      </div>
    </header>
  );
}
