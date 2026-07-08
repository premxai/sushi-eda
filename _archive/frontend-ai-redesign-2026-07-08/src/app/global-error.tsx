"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="text-center space-y-4 p-8">
          <h2 className="text-xl font-semibold text-neutral-800">
            Something went wrong
          </h2>
          <p className="text-sm text-neutral-500">
            An unexpected error occurred. Our team has been notified.
          </p>
          <button
            onClick={reset}
            className="px-4 py-2 text-sm bg-neutral-900 text-white rounded-lg hover:bg-neutral-700 transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
