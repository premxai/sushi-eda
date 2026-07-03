import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import { Badge, Card, Container, Eyebrow, LinkButton } from "@/components/sushi/primitives";

export const metadata: Metadata = {
  title: "Example reports",
  description: "See what a finished Sushi report looks like on real-world datasets.",
};

type Example = {
  title: string;
  blurb: string;
  emoji: string;
  href?: string; // set = live; unset = coming soon
};

const EXAMPLES: Example[] = [
  { title: "Sales data", blurb: "Orders, revenue, regions — the classic quarterly export.", emoji: "📈", href: "/?demo=1" },
  { title: "Survey results", blurb: "Likert responses, free text, and drop-off by question.", emoji: "🗳️" },
  { title: "Product usage", blurb: "Events, active users, and what tracks retention.", emoji: "📊" },
  { title: "A/B test", blurb: "Control vs variant, with a real significance check.", emoji: "🧪" },
  { title: "Support tickets", blurb: "Volume, categories, and resolution times.", emoji: "🎫" },
  { title: "SaaS metrics", blurb: "MRR, churn, and cohort behavior over time.", emoji: "💳" },
];

export default function ExamplesPage() {
  return (
    <div className="min-h-screen bg-paper">
      <div className="sticky top-0 z-50 border-b border-line bg-[rgba(250,249,245,0.8)] backdrop-blur-xl">
        <Container size="xl" className="flex h-16 items-center gap-4">
          <Link href="/" className="flex items-center gap-1.5 text-[13px] text-muted-ink no-underline hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <span className="text-line-2">|</span>
          <span className="text-[15px] font-semibold text-ink">Example reports</span>
        </Container>
      </div>

      <Container size="xl" className="py-16">
        <Eyebrow>Examples</Eyebrow>
        <h1 className="mt-3 max-w-2xl font-display text-[clamp(32px,4.5vw,52px)] leading-[1.05] tracking-[-0.01em] text-ink">
          See a finished report before you upload a thing
        </h1>
        <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-muted-ink">
          Every report opens with a plain-English summary, a quality score, and charts that
          support the story. Open the live one to explore it end to end.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {EXAMPLES.map((ex) => {
            const live = Boolean(ex.href);
            const body = (
              <Card hover={live} className={`h-full p-6 ${live ? "" : "opacity-70"}`}>
                <div className="flex items-start justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-weak text-[20px]">
                    {ex.emoji}
                  </span>
                  {live ? (
                    <Badge tone="brand">Live</Badge>
                  ) : (
                    <Badge tone="neutral">
                      <Lock className="h-3 w-3" /> Soon
                    </Badge>
                  )}
                </div>
                <h3 className="mt-5 font-display text-[22px] leading-tight text-ink">{ex.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted-ink">{ex.blurb}</p>
                {live && (
                  <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand">
                    Open report <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Card>
            );
            return live ? (
              <Link key={ex.title} href={ex.href!} className="no-underline">
                {body}
              </Link>
            ) : (
              <div key={ex.title}>{body}</div>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <p className="text-[15px] text-muted-ink">Got your own file?</p>
          <div className="mt-4">
            <LinkButton href="/" variant="brand" size="lg">
              Upload a dataset <ArrowRight className="h-4 w-4" />
            </LinkButton>
          </div>
        </div>
      </Container>
    </div>
  );
}
