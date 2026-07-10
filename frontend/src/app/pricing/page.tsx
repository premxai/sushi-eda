import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/common/Badge";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    note: "Available now",
    description: "For exploring data and sharing a clear first read.",
    features: ["Files up to 25 MB", "All six supported formats", "Quality score and full report", "Sample dataset", "Seven-day retention"],
    action: "Try Sushi free",
    href: "/#upload",
    featured: true,
  },
  {
    name: "Pro",
    price: "$19",
    note: "Mock pricing · planned",
    description: "A preview of a future plan for frequent individual analysis.",
    features: ["Larger file allowance", "Longer report history", "Higher AI usage", "Saved report templates", "Priority exports"],
    action: "Coming soon",
    href: "/changelog",
  },
  {
    name: "Team",
    price: "$49",
    note: "Mock pricing · planned",
    description: "A preview for shared workflows and governed collaboration.",
    features: ["Shared team workspace", "Roles and permissions", "Private report links", "Usage controls", "Team support"],
    action: "Coming soon",
    href: "/changelog",
  },
];

export default function PricingPage() {
  return (
    <div className="app-paper-page">
      <SiteHeader />
      <main className="container max-w-6xl py-10 sm:py-14">
        <PageHeader title="Pricing" description="Simple access today, with a transparent preview of where paid plans could go next." actions={<Badge tone="brand">Pricing preview</Badge>} />

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-warning/25 bg-warning-weak px-4 py-3 text-[13px] text-ink-secondary">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>Only the Free plan is live. Pro and Team are design mocks for planning purposes and cannot be purchased yet.</p>
        </div>

        <section className="mt-8 grid gap-5 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <article key={plan.name} className={`paper-panel relative flex flex-col p-6 ${plan.featured ? "border-brand/50 shadow-md" : ""}`}>
              {plan.featured && <span className="absolute right-5 top-5 rounded-full bg-brand px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">Live</span>}
              <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-tertiary">{plan.name}</p>
              <div className="mt-5 flex items-end gap-2"><span className="font-display text-[58px] leading-none tracking-[-0.04em] text-ink">{plan.price}</span><span className="pb-1.5 text-[12px] text-ink-tertiary">/ month</span></div>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-brand">{plan.note}</p>
              <p className="mt-5 min-h-12 text-[13.5px] leading-relaxed text-ink-secondary">{plan.description}</p>
              <div className="my-5 ink-divider" />
              <ul className="flex flex-1 flex-col gap-3">
                {plan.features.map((feature) => <li key={feature} className="flex items-center gap-2.5 text-[13px] text-ink-secondary"><Check className="h-4 w-4 text-success" />{feature}</li>)}
              </ul>
              <Link href={plan.href} className={`mt-7 inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold no-underline ${plan.featured ? "bg-ink text-paper" : "border border-border-strong bg-surface-2 text-ink"}`}>
                {plan.action} <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
