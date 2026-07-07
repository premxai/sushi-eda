import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { Card, Container, Eyebrow, LinkButton } from "@/components/sushi/primitives";
import { SushiLogo } from "@/components/sushi/SushiLogo";

export const metadata: Metadata = { title: "Sign up" };

export default function SignUpPage() {
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
            Try it before you sign up
          </h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-muted-ink">
            You can upload a file and get a full report right now, no account required.
            Sign up will let you save workspaces and reopen them later.
          </p>
          <div className="mt-7">
            <LinkButton href="/" size="lg" variant="brand">
              Analyze a file now <ArrowRight className="h-4 w-4" />
            </LinkButton>
          </div>
          <p className="mt-5 text-[13px] text-faint-ink">
            Already exploring?{" "}
            <Link href="/sign-in" className="text-brand no-underline hover:underline">
              Log in
            </Link>
          </p>
        </Card>
      </Container>
    </div>
  );
}
