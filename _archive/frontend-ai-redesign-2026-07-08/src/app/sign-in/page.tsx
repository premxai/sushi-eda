import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { Card, Container, Eyebrow, LinkButton } from "@/components/sushi/primitives";
import { SushiLogo } from "@/components/sushi/SushiLogo";

export const metadata: Metadata = { title: "Log in" };

export default function SignInPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-paper px-6">
      <Container size="sm" className="max-w-md">
        <Card className="p-9 text-center">
          <div className="mx-auto mb-5 flex items-center justify-center gap-2">
            <SushiLogo size={30} />
            <span className="text-[17px] font-semibold text-ink">Sushi</span>
          </div>
          <Eyebrow className="justify-center">Accounts open at launch</Eyebrow>
          <h1 className="mt-3 font-display text-[30px] leading-tight text-ink">
            No account needed yet
          </h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-muted-ink">
            Sushi is free to use right now, no sign in required. Saved workspaces and
            private share links arrive when accounts launch.
          </p>
          <div className="mt-7">
            <LinkButton href="/" size="lg" variant="brand">
              Start analyzing now <ArrowRight className="h-4 w-4" />
            </LinkButton>
          </div>
          <p className="mt-5 text-[13px] text-faint-ink">
            New here?{" "}
            <Link href="/sign-up" className="text-brand no-underline hover:underline">
              Create an account
            </Link>
          </p>
        </Card>
      </Container>
    </div>
  );
}
