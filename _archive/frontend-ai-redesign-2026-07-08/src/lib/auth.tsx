"use client";

/**
 * Auth shim over Clerk.
 *
 * When NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set (a build-time constant),
 * these exports are the real Clerk hooks/components. When it is absent the
 * app runs in open demo mode: everyone is treated as a signed-in "Demo"
 * user and the Clerk UI is replaced with inert stand-ins, so the app works
 * with zero configuration. Components should import from "@/lib/auth"
 * instead of "@clerk/nextjs".
 */

import {
  useUser as clerkUseUser,
  SignedIn as ClerkSignedIn,
  SignedOut as ClerkSignedOut,
  UserButton as ClerkUserButton,
} from "@clerk/nextjs";

export const CLERK_ENABLED = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
);

const demoUser = {
  firstName: "Demo",
  username: "demo",
  fullName: "Demo User",
  imageUrl: "",
};

function demoUseUser() {
  return {
    isLoaded: true,
    isSignedIn: true,
    user: demoUser,
  } as unknown as ReturnType<typeof clerkUseUser>;
}

function DemoSignedIn({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

const DemoSignedOut: React.FC<{ children?: React.ReactNode }> = () => null;

const DemoUserButton: React.FC<Record<string, unknown>> = () => (
  <div
    className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center text-white text-sm font-semibold select-none"
    title="Demo user (auth disabled)"
  >
    D
  </div>
);

export const useUser = CLERK_ENABLED ? clerkUseUser : demoUseUser;
export const SignedIn = CLERK_ENABLED ? ClerkSignedIn : DemoSignedIn;
export const SignedOut = CLERK_ENABLED ? ClerkSignedOut : DemoSignedOut;
export const UserButton = (CLERK_ENABLED
  ? ClerkUserButton
  : DemoUserButton) as typeof ClerkUserButton;
