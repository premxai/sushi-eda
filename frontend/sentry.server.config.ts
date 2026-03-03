// Server-side Sentry initialization (Node.js runtime).
// This file is automatically loaded by @sentry/nextjs on the server.
import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.ENVIRONMENT ?? "production",

    // 10% of server-side traces
    tracesSampleRate: 0.1,

    enabled: process.env.NODE_ENV === "production",
  });
}
