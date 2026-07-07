import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// When no Clerk publishable key is configured (build-time constant), the app
// runs in open demo mode and the middleware passes every request through.
// Running clerkMiddleware without keys makes every request hang.
const CLERK_ENABLED = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

// Routes that are publicly accessible without auth
const isPublicRoute = createRouteMatcher([
  "/", // landing page
  // /api/* is rewritten to the backend, which enforces its own JWT auth and
  // serves public endpoints (health, shared reports). Blocking it here would
  // 404 those before the rewrite runs.
  "/api(.*)",
  "/share/(.*)", // public shareable report links
  "/docs(.*)",
  "/changelog(.*)",
  "/compare(.*)",
  "/privacy(.*)",
  "/examples(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

export default CLERK_ENABLED
  ? clerkMiddleware(async (auth, req) => {
      if (!isPublicRoute(req)) {
        await auth.protect();
      }
    })
  : () => NextResponse.next();

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
