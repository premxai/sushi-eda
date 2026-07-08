import { MessageSquareText, Share2, ShieldCheck, Sparkles } from "lucide-react";

const PROMISES = [
  {
    icon: ShieldCheck,
    title: "Quality score before trust",
    body: "Every report opens with a 0 to 100 quality grade and a plain verdict, so you know whether to trust the numbers before you present them.",
  },
  {
    icon: Sparkles,
    title: "Plain-English AI summary",
    body: "Not a wall of charts — a short executive summary of what the data says, what changed, and what to watch out for.",
  },
  {
    icon: MessageSquareText,
    title: "Ask your data",
    body: "Type a question in plain English. See the answer, and the exact query behind it if you want to check the work.",
  },
  {
    icon: Share2,
    title: "One-click share and export",
    body: "Send a link or export a PDF your whole team can read, without anyone touching a spreadsheet.",
  },
];

export function PromiseCards() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {PROMISES.map((p) => (
        <div key={p.title}>
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface">
            <p.icon className="h-4 w-4 text-brand" aria-hidden />
          </div>
          <h3 className="mt-3 text-[14px] font-semibold text-ink">{p.title}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">{p.body}</p>
        </div>
      ))}
    </div>
  );
}
