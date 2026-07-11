import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

function safeNext(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const destination = new URL(next, request.url);

  if (!url || !publishableKey) {
    destination.pathname = "/sign-in";
    destination.searchParams.set("error", "Authentication is not configured yet.");
    return NextResponse.redirect(destination);
  }

  const code = request.nextUrl.searchParams.get("code");
  const response = NextResponse.redirect(destination);
  if (!code) return response;

  const cookieStore = cookies();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(values) {
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    destination.pathname = "/sign-in";
    destination.searchParams.set("error", "Your confirmation link has expired. Please try again.");
    return NextResponse.redirect(destination);
  }
  return response;
}
