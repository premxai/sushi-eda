import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Routes that are publicly accessible without auth
const isPublicRoute = createRouteMatcher([
  "/", // landing page
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)", // Clerk webhooks bypass auth
  "/share/(.*)", // public shareable report links
  "/pricing",
  "/docs(.*)",
  "/changelog(.*)",
  "/catalog(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
