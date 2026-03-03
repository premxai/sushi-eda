// Edge runtime Sentry initialization (middleware, edge API routes).
// This file is automatically loaded by @sentry/nextjs for edge runtimes.
import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.ENVIRONMENT ?? "production",
    tracesSampleRate: 0.1,
    enabled: process.env.NODE_ENV === "production",
  });
}
