// Browser-side Sentry initialization.
// This file is automatically loaded by @sentry/nextjs before the app bootstraps.
import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_ENVIRONMENT ?? "production",

    // Capture 10% of traces for performance monitoring
    tracesSampleRate: 0.1,

    // Replay 1% of sessions; 100% of sessions with errors
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      Sentry.replayIntegration({
        // Mask all text and inputs by default for privacy
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Don't send errors in development
    enabled: process.env.NODE_ENV === "production",
  });
}
