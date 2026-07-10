import { BotOff, Clock3, Eye, LockKeyhole, Server, Share2, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { PageHeader } from "@/components/common/PageHeader";

const PRINCIPLES = [
  { title: "Deleted after 7 days", body: "Files and generated reports expire automatically. You do not need to remember to clean them up.", icon: Clock3 },
  { title: "Never used for training", body: "Uploaded data is not used to train Sushi or third-party AI models.", icon: BotOff },
  { title: "Private unless you share", body: "A report becomes public only when you deliberately create a share link.", icon: LockKeyhole },
];

const DETAILS = [
  { title: "What Sushi stores", icon: Server, body: "The file you upload, the report generated from it, and—if used—the conversation history attached to that report. Basic operational logs such as timestamps and error rates are kept to operate the service reliably." },
  { title: "How AI features work", icon: ShieldCheck, body: "Data is sent to the configured AI provider only for summaries, questions, and notes you request. If AI is unavailable, Sushi shows a clear unavailable state; deterministic quality, chart, field, and statistics features continue to work." },
  { title: "Public links", icon: Share2, body: "Anyone with a public report URL can view its read-only contents. Public links are not password protected. Share them only with people you trust and avoid creating them for sensitive material." },
  { title: "Accounts and tracking", icon: Eye, body: "This build does not require an account and does not sell data for advertising. The dataset library reflects the current environment; it is not a personal secured cloud account." },
];

export default function PrivacyPage() {
  return (
    <div className="app-paper-page">
      <SiteHeader />
      <main className="container max-w-5xl py-10 sm:py-14">
        <PageHeader title="Privacy" description="Clear boundaries for what happens to your files, reports, and shared links." />

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {PRINCIPLES.map(({ title, body, icon: Icon }) => (
            <article key={title} className="paper-panel p-6">
              <span className="grid h-11 w-11 place-items-center rounded-full border border-success/30 bg-success-weak text-success"><Icon className="h-5 w-5" /></span>
              <h2 className="mt-4 font-display text-[27px] leading-tight tracking-[-0.02em] text-ink">{title}</h2>
              <p className="mt-3 text-[13px] leading-6 text-ink-secondary">{body}</p>
            </article>
          ))}
        </section>

        <section className="mt-10 paper-panel overflow-hidden">
          <div className="border-b border-border px-6 py-5 sm:px-8"><p className="section-kicker">Plain-English policy</p><h2 className="mt-3 font-display text-[34px] tracking-[-0.03em] text-ink">The details, without the legal fog.</h2></div>
          <div className="divide-y divide-border">
            {DETAILS.map(({ title, body, icon: Icon }) => (
              <article key={title} className="grid gap-4 px-6 py-6 sm:grid-cols-[48px_220px_1fr] sm:items-start sm:px-8">
                <span className="grid h-10 w-10 place-items-center rounded-full border border-border bg-surface-2 text-brand"><Icon className="h-[18px] w-[18px]" /></span>
                <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
                <p className="text-[13.5px] leading-7 text-ink-secondary">{body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
