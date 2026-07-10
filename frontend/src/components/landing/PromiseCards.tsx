import { BarChart3, FileText, Share2, ShieldCheck } from "lucide-react";

const PROMISES = [
  {
    icon: ShieldCheck,
    title: "Privacy by Design",
    body: "Your data stays yours.",
  },
  {
    icon: FileText,
    title: "Plain-English Reports",
    body: "No jargon. Just insights.",
  },
  {
    icon: BarChart3,
    title: "Charts That Tell the Story",
    body: "Automated visuals that make sense.",
  },
  {
    icon: Share2,
    title: "Export & Share",
    body: "PDF, Excel, Markdown, and more.",
  },
];

export function PromiseCards() {
  return (
    <div className="grid grid-cols-1 gap-y-8 border-t border-border pt-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-y-0">
      {PROMISES.map((p, i) => (
        <div key={p.title} className={`flex items-center gap-3.5 lg:px-7 ${i > 0 ? "lg:border-l lg:border-border" : ""}`}>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand/30 bg-brand-weak">
            <p.icon className="h-5 w-5 text-brand" aria-hidden />
          </div>
          <div>
            <h3 className="text-[14.5px] font-semibold text-ink">{p.title}</h3>
            <p className="mt-0.5 text-[13px] leading-snug text-ink-secondary">{p.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
