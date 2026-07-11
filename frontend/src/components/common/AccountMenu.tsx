"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

interface AccountMenuProps {
  className?: string;
  fallback?: "cta" | "sign-in" | "none";
}

function initials(name: string, email: string) {
  const value = name.trim() || email.trim();
  return value
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "S";
}

/** Compact account control shared by the marketing and report headers. */
export function AccountMenu({ className, fallback = "sign-in" }: AccountMenuProps) {
  const [account, setAccount] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabaseBrowserClient();
    const sync = () => supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user) return setAccount(null);
      const metadata = user.user_metadata as { full_name?: string; name?: string } | undefined;
      setAccount({ name: metadata?.full_name || metadata?.name || "", email: user.email || "" });
    });
    void sync();
    const { data: subscription } = supabase.auth.onAuthStateChange(() => { void sync(); });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    if (isSupabaseConfigured) await getSupabaseBrowserClient().auth.signOut();
    window.location.assign("/");
  };

  if (!account) {
    if (fallback === "none") return null;
    if (fallback === "cta") {
      return <Link href="/sign-up" className={cn("hero-reference-cta", className)}>Get started free</Link>;
    }
    return <Link href="/sign-in" className={cn("inline-flex items-center rounded-full border border-border bg-surface px-4 py-2 text-[13px] font-semibold text-ink no-underline transition-colors hover:bg-surface-2", className)}>Sign in</Link>;
  }

  const displayName = account.name || account.email.split("@")[0] || "Sushi user";
  return (
    <details className={cn("account-menu relative", className)}>
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-border bg-surface/90 py-1.5 pl-1.5 pr-3 text-ink shadow-sm transition-colors hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-[11px] font-bold tracking-[0.04em] text-paper">{initials(displayName, account.email)}</span>
        <span className="hidden max-w-28 truncate text-[13px] font-semibold sm:block">{displayName}</span>
        <ChevronDown className="h-3.5 w-3.5 text-ink-tertiary" aria-hidden />
        <span className="sr-only">Open account menu</span>
      </summary>
      <div className="absolute right-0 top-[calc(100%+10px)] z-50 min-w-60 rounded-2xl border border-border bg-surface p-2 shadow-lg">
        <div className="border-b border-border px-3 py-2.5">
          <p className="truncate text-[13px] font-semibold text-ink">{displayName}</p>
          <p className="mt-0.5 truncate text-[11.5px] text-ink-tertiary">{account.email}</p>
        </div>
        <Link href="/dashboard" className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium text-ink-secondary no-underline hover:bg-surface-2 hover:text-ink"><UserRound className="h-4 w-4" />Overview dashboard</Link>
        <button type="button" onClick={() => void signOut()} className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-danger hover:bg-danger-weak"><LogOut className="h-4 w-4" />Log out</button>
      </div>
    </details>
  );
}
