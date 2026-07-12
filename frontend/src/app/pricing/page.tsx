import { Clock3, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/common/Badge";

export default function PricingPage() {
  return (
    <div className="app-paper-page min-h-screen">
      <SiteHeader />
      <main className="container max-w-5xl py-10 sm:py-14">
        <PageHeader title="Pricing" description="Sushi is in its early access phase. Plans and billing will be introduced when the product is ready." actions={<Badge tone="brand">Upcoming</Badge>} />
        <section className="paper-panel mx-auto mt-10 max-w-2xl p-8 text-center sm:p-12">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-brand/25 bg-brand-weak text-brand"><Clock3 className="h-6 w-6" /></span>
          <p className="section-kicker mt-6">Coming soon</p>
          <h2 className="mt-3 font-display text-[46px] leading-[0.94] tracking-[-0.045em] text-ink sm:text-[60px]">Plans are <span className="text-brand">on the way.</span></h2>
          <p className="mx-auto mt-5 max-w-lg text-[15px] leading-7 text-ink-secondary">There are no prices or subscriptions to choose from today. Keep using Sushi while we shape a simple, fair plan for the product.</p>
          <div className="mx-auto mt-7 flex max-w-md items-start gap-3 rounded-2xl border border-warning/25 bg-warning-weak px-4 py-3 text-left text-[13px] text-ink-secondary">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <p>We will announce pricing before billing is enabled. Nothing on this page is available to purchase yet.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
