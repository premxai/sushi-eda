"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && publishableKey);

let browserClient: SupabaseClient | undefined;

/** Cookie-backed browser client. It is deliberately unavailable until the
 * public project URL and publishable key are configured. */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (!url || !publishableKey) {
    throw new Error("Authentication is not configured yet.");
  }
  browserClient ??= createBrowserClient(url, publishableKey);
  return browserClient;
}

export async function getSupabaseAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await getSupabaseBrowserClient().auth.getSession();
  return data.session?.access_token ?? null;
}
