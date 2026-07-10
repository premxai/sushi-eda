import { BarChart3, Share2, ShieldCheck, Sparkles } from "lucide-react";

const ITEMS = [
  { icon: ShieldCheck, title: "Privacy by Design", body: "Your data stays yours." },
  { icon: Sparkles, title: "Plain-English Reports", body: "No jargon. Just insights." },
  { icon: BarChart3, title: "Charts That Tell the Story", body: "Automated visuals that make sense." },
  { icon: Share2, title: "Export & Share", body: "PDF, Excel, Markdown, and more." },
];

/** Quiet supporting benefits row shared by desktop and responsive hero layouts. */
export function FeatureRow() {
  return (
    <div className="hero-feature-row">
      {ITEMS.map(({ icon: Icon, title, body }, index) => (
        <div key={title} className="hero-feature-item">
          <span className={index === 2 ? "matcha" : "coral"}><Icon /></span>
          <div><strong>{title}</strong><small>{body}</small></div>
        </div>
      ))}
    </div>
  );
}
