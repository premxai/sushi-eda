"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { Logo } from "@/components/common/Logo";
import { Input } from "@/components/ui/input";
import { authReturnPath, saveLocalSession, type AuthIntent } from "@/lib/auth-gate";

function getIntent(value: string | null): AuthIntent {
  return value === "sample" ? "sample" : "upload";
}

export default function SignInPage() {
  return <Suspense fallback={null}><SignInForm /></Suspense>;
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const intent = getIntent(searchParams.get("intent"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.includes("@")) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Your password must be at least 8 characters.");
    saveLocalSession({ email: email.trim().toLowerCase() });
    router.push(authReturnPath(intent));
  };

  return (
    <main className="app-paper-page flex min-h-screen items-center justify-center px-5 py-10">
      <section className="w-full max-w-md paper-panel p-7 sm:p-9">
        <Link href="/" className="inline-flex items-center gap-2 no-underline"><Logo size={32} /><span className="text-[19px] font-semibold tracking-[-0.04em] text-ink">Sushi</span></Link>
        <span className="mt-7 grid h-12 w-12 place-items-center rounded-full border border-brand/30 bg-brand-weak text-brand"><LockKeyhole className="h-5 w-5" /></span>
        <p className="section-kicker mt-5">Welcome back</p>
        <h1 className="mt-3 font-display text-[42px] leading-none tracking-[-0.035em] text-ink">Sign in to continue.</h1>
        <p className="mt-3 text-[13.5px] leading-6 text-ink-secondary">{intent === "sample" ? "Sign in to open the sample report." : "Sign in to choose a file and start your report."}</p>

        <form className="mt-7 space-y-4" onSubmit={submit} noValidate>
          <label className="block"><span className="mb-1.5 block text-[12px] font-semibold text-ink">Email address</span><Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></label>
          <label className="block"><span className="mb-1.5 block text-[12px] font-semibold text-ink">Password</span><Input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>
          {error && <p role="alert" className="rounded-lg border border-danger/25 bg-danger-weak px-3 py-2 text-[12.5px] text-danger">{error}</p>}
          <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-[13px] font-semibold text-paper hover:opacity-90">Sign in <ArrowRight className="h-4 w-4" /></button>
        </form>
        <p className="mt-6 text-center text-[13px] text-ink-secondary">Don&apos;t have an account? <Link href={`/sign-up?intent=${intent}`} className="font-semibold text-brand">Sign up</Link></p>
      </section>
    </main>
  );
}
