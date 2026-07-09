import { FileText } from "lucide-react";

const TABLE_ROWS = [
  { user_id: "1001", signup_date: "2024-04-01", plan: "Pro", revenue: "45.00", country: "US" },
  { user_id: "1002", signup_date: "2024-04-02", plan: "Free", revenue: "0.00", country: "CA" },
  { user_id: "1003", signup_date: "2024-04-02", plan: "Pro", revenue: "68.00", country: "GB" },
  { user_id: "1004", signup_date: "2024-04-03", plan: "Team", revenue: "120.00", country: "US" },
];

const PLAN_MIX = [
  { label: "Pro", pct: 48, color: "#6b8a3e" },
  { label: "Team", pct: 32, color: "#5b7fa6" },
  { label: "Free", pct: 20, color: "#c15b3f" },
];

const TREND_POINTS = [18, 34, 30, 46, 52, 44, 60, 68, 62, 78, 88, 96];

/** Purely decorative hero illustration: a mocked data-table preview and a
 * mocked revenue dashboard, floating beside the upload card. Static,
 * hardcoded numbers, never presented as real analysis output. Hidden
 * below the 2xl breakpoint since there's no room for them. */
export function HeroPreviewCards() {
  const conicStops = (() => {
    let acc = 0;
    return PLAN_MIX.map((slice) => {
      const start = acc;
      acc += slice.pct;
      return `${slice.color} ${start * 3.6}deg ${acc * 3.6}deg`;
    }).join(", ");
  })();

  const trendPath = (() => {
    const max = Math.max(...TREND_POINTS);
    const w = 220;
    const h = 90;
    const step = w / (TREND_POINTS.length - 1);
    const pts = TREND_POINTS.map((v, i) => [i * step, h - (v / max) * h]);
    return pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  })();

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden select-none 2xl:block">
      <div className="absolute left-[2%] top-1/2 w-[260px] -translate-y-1/2 rounded-2xl border border-border bg-surface p-4 shadow-lg">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
            <FileText className="h-3.5 w-3.5 text-success" />
            raw_data.csv
          </div>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] text-ink-tertiary">23,984 rows</span>
        </div>
        <div className="mt-3 overflow-hidden rounded-lg border border-border text-[10px]">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-2 text-ink-tertiary">
                {["user_id", "signup_date", "plan", "revenue", "country"].map((h) => (
                  <th key={h} className="px-1.5 py-1 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TABLE_ROWS.map((row) => (
                <tr key={row.user_id} className="border-t border-border text-ink-secondary">
                  <td className="px-1.5 py-1">{row.user_id}</td>
                  <td className="px-1.5 py-1">{row.signup_date}</td>
                  <td className="px-1.5 py-1">{row.plan}</td>
                  <td className="px-1.5 py-1">{row.revenue}</td>
                  <td className="px-1.5 py-1">{row.country}</td>
                </tr>
              ))}
              <tr className="border-t border-border text-ink-tertiary">
                <td className="px-1.5 py-1" colSpan={5}>
                  ···
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="absolute right-[2%] top-[20%] w-[260px] rounded-2xl border border-border bg-surface p-4 shadow-lg">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12.5px] font-medium text-ink">Revenue overview</span>
          <span className="rounded-full bg-success-weak px-2 py-0.5 text-[10.5px] font-medium text-success">↑ 24% vs last month</span>
        </div>
        <div className="mt-3 flex items-center gap-4">
          <div>
            <p className="text-[10.5px] text-ink-tertiary">Total revenue</p>
            <p className="text-[18px] font-semibold text-ink">$124,540</p>
            <p className="mt-0.5 text-[10.5px] font-medium text-success">↑ 24% vs last month</p>
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            <div className="h-14 w-14 shrink-0 rounded-full" style={{ background: `conic-gradient(${conicStops})` }}>
              <div className="m-[7px] h-9 w-9 rounded-full bg-surface" />
            </div>
            <div className="flex flex-col gap-1 text-[10px] text-ink-secondary">
              {PLAN_MIX.map((s) => (
                <div key={s.label} className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                  {s.label} <span className="text-ink-tertiary">{s.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute right-[2%] top-[52%] w-[260px] rounded-2xl border border-border bg-surface p-4 shadow-lg">
        <span className="text-[12.5px] font-medium text-ink">Revenue over time</span>
        <svg viewBox="0 0 220 100" className="mt-2 w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="hero-trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6b8a3e" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#6b8a3e" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${trendPath} L220,100 L0,100 Z`} fill="url(#hero-trend-fill)" stroke="none" />
          <path d={trendPath} fill="none" stroke="#6b8a3e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="mt-1 flex justify-between text-[9.5px] text-ink-tertiary">
          <span>Apr 1</span>
          <span>Apr 8</span>
          <span>Apr 15</span>
          <span>Apr 22</span>
          <span>Apr 29</span>
        </div>
      </div>
    </div>
  );
}
