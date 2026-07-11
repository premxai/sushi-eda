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
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  let session = data.session;
  if (!session) return null;

  // A tab may stay open long enough for its access token to expire. Refresh
  // shortly before expiry so a valid signed-in user does not encounter an
  // opaque failed upload request.
  const expiresAt = (session.expires_at ?? 0) * 1000;
  if (expiresAt && expiresAt <= Date.now() + 60_000) {
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    if (error || !refreshed.session) return null;
    session = refreshed.session;
  }

  return session.access_token;
}
