import { SiteHeader } from "@/components/landing/SiteHeader";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

const SECTIONS = [
  {
    title: "Your file is deleted after 7 days",
    body: "Uploaded files and their reports are automatically and permanently deleted 7 days after upload. This isn't something you need to remember to do — it happens on its own.",
  },
  {
    title: "We don't train AI models on your data",
    body: "Your data is sent to our AI provider only to generate the summary, chat answers, and notes you ask for. It is not used to train any AI model, ours or anyone else's.",
  },
  {
    title: "AI features may be unavailable",
    body: "The AI summary, Ask Your Data, and AI Notes depend on a daily usage budget shared across everyone using Sushi. If that budget is exhausted, or AI isn't configured in a given environment, those features show a clear \"not available\" message instead of guessing — the quality score, columns, charts, statistics, and raw data are never affected.",
  },
  {
    title: "Public share links are accessible to anyone with the link",
    body: "Creating a share link makes a read-only version of that report viewable by anyone who has the link — it isn't protected by an account or password. Don't share a link for data you wouldn't want a stranger to see, and revoke it from the dataset when you no longer need it shared.",
  },
  {
    title: "No accounts, no hidden tracking",
    body: "Sushi doesn't currently require an account to use. The \"My Datasets\" library reflects what's been uploaded in your current environment, not a personal, secured account library. We don't sell your data or share it with third parties for advertising.",
  },
  {
    title: "What we store",
    body: "The file you upload, the report generated from it, and (if you use it) the AI conversation history for that dataset — all deleted after 7 days per the policy above. We also keep basic operational logs (timestamps, error rates) to keep the service running reliably.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-paper">
      <SiteHeader />
      <div className="container max-w-2xl py-8">
        <PageHeader title="Privacy" description="How Sushi handles your data, in plain English." />
        <div className="mt-6 flex flex-col gap-4">
          {SECTIONS.map((section) => (
            <Card key={section.title}>
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
              </CardHeader>
              <p className="text-[13.5px] leading-relaxed text-ink-secondary">{section.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
