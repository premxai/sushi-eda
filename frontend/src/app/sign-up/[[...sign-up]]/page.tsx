import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <SignUp
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
