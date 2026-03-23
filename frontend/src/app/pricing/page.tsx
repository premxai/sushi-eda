import type { Metadata } from "next";
import Link from "next/link";
import { Check, Zap, Building2, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, transparent pricing for Sushi EDA. Start free, upgrade when you need more AI credits, " +
    "data connectors, and team features.",
};

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for exploring your first datasets.",
    icon: Sparkles,
    highlight: false,
    cta: "Get started free",
    ctaHref: "/sign-up",
    credits: "100 AI credits / month",
    features: [
      "Core dataset upload and profiling",
      "Visualizations, correlations, and outlier review",
      "Report export and public share links",
      "Compare two datasets",
      "CSV, Excel, Parquet, JSON, TSV, and SQLite upload",
    ],
    missing: [
      "Saved connectors and automated imports",
      "Scheduled monitors and pipeline automation",
      "Advanced team administration",
    ],
  },
  {
    name: "Pro",
    price: "$29",
    period: "/ month",
    description: "For analysts and data teams who need more power.",
    icon: Zap,
    highlight: true,
    cta: "Start Pro trial",
    ctaHref: "/sign-up?plan=pro",
    credits: "2,000 AI credits / month",
    features: [
      "Everything in Free",
      "Higher AI usage limits",
      "SQL exploration and AI-assisted workflows",
      "Connector import flows for supported sources",
      "Manual monitor runs and pipeline execution",
      "Priority launch support",
    ],
    missing: ["Some automation and integration surfaces remain beta"],
  },
  {
    name: "Team",
    price: "$99",
    period: "/ month",
    description: "For organisations with multiple analysts.",
    icon: Building2,
    highlight: false,
    cta: "Contact us",
    ctaHref: "mailto:team@sushi-eda.com",
    credits: "Unlimited AI credits",
    features: [
      "Everything in Pro",
      "Expanded team permissions and audit visibility",
      "Dedicated onboarding for connectors and monitoring",
      "Shared launch planning and support",
    ],
    missing: ["Custom enterprise controls are handled case-by-case during MVP launch"],
  },
];

const FAQ = [
  {
    q: "What counts as an AI credit?",
    a: "Each AI feature costs a small number of credits: generating a narrative (5), cleaning suggestions (3), a chat message (2), and column explainer (1). Credits reset at the start of each billing period.",
  },
  {
    q: "Can I upgrade or downgrade at any time?",
    a: "Yes. Upgrades are immediate; downgrades take effect at the end of your current billing period.",
  },
  {
    q: "What file formats are supported?",
    a: "CSV, TSV, Excel (.xlsx/.xls), Parquet, JSON, and SQLite. Connector-based imports are available on supported Pro and Team setups during the MVP launch period.",
  },
  {
    q: "Is my data secure?",
    a: "Files are encrypted in transit and stored in managed cloud infrastructure. For MVP launch, advanced enterprise controls and data residency reviews are handled directly with the team.",
  },
  {
    q: "Do you offer annual billing?",
    a: "Annual billing with a 20% discount is available on request. Reach out to team@sushi-eda.com.",
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-neutral-100 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="font-bold text-neutral-900 text-lg">Sushi</Link>
        <div className="flex items-center gap-4">
          <Link href="/sign-in" className="text-sm text-neutral-600 hover:text-neutral-900">Sign in</Link>
          <Link
            href="/sign-up"
            className="text-sm px-4 py-1.5 rounded-lg bg-neutral-900 text-white hover:bg-neutral-700 transition-colors"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 px-6 text-center max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-neutral-900 tracking-tight">
          Simple, transparent pricing
        </h1>
        <p className="mt-4 text-lg text-neutral-500">
          Start free. Upgrade when your data needs grow.
          MVP launch pricing reflects the features shipping today, with beta surfaces enabled selectively.
        </p>
      </section>

      {/* Plans */}
      <section className="px-6 pb-20 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            return (
              <div
                key={plan.name}
                className={`rounded-2xl border p-6 flex flex-col ${
                  plan.highlight
                    ? "border-neutral-900 bg-neutral-900 text-white shadow-xl"
                    : "border-neutral-200 bg-white text-neutral-900"
                }`}
              >
                {plan.highlight && (
                  <span className="text-xs font-semibold uppercase tracking-widest text-violet-300 mb-3">
                    Most popular
                  </span>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={`h-5 w-5 ${plan.highlight ? "text-violet-300" : "text-violet-500"}`} />
                  <span className="font-bold text-lg">{plan.name}</span>
                </div>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className={`text-sm mb-1 ${plan.highlight ? "text-neutral-400" : "text-neutral-500"}`}>
                    {plan.period}
                  </span>
                </div>
                <p className={`text-sm mb-6 ${plan.highlight ? "text-neutral-400" : "text-neutral-500"}`}>
                  {plan.description}
                </p>

                <Link
                  href={plan.ctaHref}
                  className={`block text-center py-2.5 rounded-xl text-sm font-semibold mb-6 transition-colors ${
                    plan.highlight
                      ? "bg-white text-neutral-900 hover:bg-neutral-100"
                      : "bg-neutral-900 text-white hover:bg-neutral-700"
                  }`}
                >
                  {plan.cta}
                </Link>

                <ul className="space-y-2 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className={`h-4 w-4 mt-0.5 flex-shrink-0 ${plan.highlight ? "text-violet-300" : "text-violet-500"}`} />
                      {f}
                    </li>
                  ))}
                  {plan.missing.map((f) => (
                    <li key={f} className={`flex items-start gap-2 text-sm line-through ${plan.highlight ? "text-neutral-600" : "text-neutral-300"}`}>
                      <span className="h-4 w-4 mt-0.5 flex-shrink-0">×</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 pb-24 max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-neutral-900 text-center mb-10">
          Frequently asked questions
        </h2>
        <div className="space-y-6">
          {FAQ.map(({ q, a }) => (
            <div key={q}>
              <h3 className="font-semibold text-neutral-900 mb-1">{q}</h3>
              <p className="text-sm text-neutral-600 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="border-t border-neutral-100 py-16 px-6 text-center bg-neutral-50">
        <h2 className="text-2xl font-bold text-neutral-900 mb-3">
          Ready to serve your data perfectly?
        </h2>
        <p className="text-neutral-500 mb-6">Start free — no credit card required.</p>
        <Link
          href="/sign-up"
          className="inline-block px-8 py-3 rounded-xl bg-neutral-900 text-white font-semibold
                     hover:bg-neutral-700 transition-colors"
        >
          Get started free
        </Link>
      </section>
    </main>
  );
}
