import { SignIn } from "@clerk/nextjs";
import { redirect } from "next/navigation";

export default function SignInPage() {
  // Demo mode (no Clerk keys): there is no sign-in — everyone is the demo user.
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    redirect("/");
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-lg rounded-2xl border border-slate-200",
            headerTitle: "text-slate-900",
            headerSubtitle: "text-slate-500",
            socialButtonsBlockButton: "border border-slate-200 hover:bg-slate-50",
            formButtonPrimary: "bg-slate-900 hover:bg-slate-700",
          },
        }}
      />
    </main>
  );
}
