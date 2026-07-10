"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { Logo } from "@/components/common/Logo";
import { Input } from "@/components/ui/input";
import { authReturnPath, saveLocalSession, type AuthIntent } from "@/lib/auth-gate";

function getIntent(value: string | null): AuthIntent {
  return value === "sample" ? "sample" : "upload";
}

export default function SignUpPage() {
  return <Suspense fallback={null}><SignUpForm /></Suspense>;
}

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const intent = getIntent(searchParams.get("intent"));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim().length < 2) return setError("Enter your name.");
    if (!email.includes("@")) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Choose a password with at least 8 characters.");
    saveLocalSession({ name: name.trim(), email: email.trim().toLowerCase() });
    router.push(authReturnPath(intent));
  };

  return (
    <main className="app-paper-page flex min-h-screen items-center justify-center px-5 py-10">
      <section className="w-full max-w-md paper-panel p-7 sm:p-9">
        <Link href="/" className="inline-flex items-center gap-2 no-underline"><Logo size={32} /><span className="text-[19px] font-semibold tracking-[-0.04em] text-ink">Sushi</span></Link>
        <span className="mt-7 grid h-12 w-12 place-items-center rounded-full border border-success/30 bg-success-weak text-success"><Sparkles className="h-5 w-5" /></span>
        <p className="section-kicker mt-5">Create your account</p>
        <h1 className="mt-3 font-display text-[42px] leading-none tracking-[-0.035em] text-ink">Start with a clearer view.</h1>
        <p className="mt-3 text-[13.5px] leading-6 text-ink-secondary">Create your account, then {intent === "sample" ? "open the sample report" : "bring in your first file"}.</p>

        <form className="mt-7 space-y-4" onSubmit={submit} noValidate>
          <label className="block"><span className="mb-1.5 block text-[12px] font-semibold text-ink">Name</span><Input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></label>
          <label className="block"><span className="mb-1.5 block text-[12px] font-semibold text-ink">Email address</span><Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></label>
          <label className="block"><span className="mb-1.5 block text-[12px] font-semibold text-ink">Password</span><Input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></label>
          {error && <p role="alert" className="rounded-lg border border-danger/25 bg-danger-weak px-3 py-2 text-[12.5px] text-danger">{error}</p>}
          <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-[13px] font-semibold text-paper hover:opacity-90">Create account <ArrowRight className="h-4 w-4" /></button>
        </form>
        <p className="mt-6 text-center text-[13px] text-ink-secondary">Already have an account? <Link href={`/sign-in?intent=${intent}`} className="font-semibold text-brand">Sign in</Link></p>
      </section>
    </main>
  );
}
