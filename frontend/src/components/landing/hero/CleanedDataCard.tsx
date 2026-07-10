import { Sparkles } from "lucide-react";
import { HERO_TABLE_COLUMNS, HERO_TABLE_ROWS } from "@/components/landing/hero/heroData";

/** Coded recreation of the "CLEANED DATA" reference card. */
export function CleanedDataCard({ className }: { className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-border bg-surface shadow-lg ${className ?? ""}`}>
      <div className="flex items-center gap-2.5 px-5 pt-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-brand/25 bg-brand-weak">
          <Sparkles className="h-4 w-4 text-brand" aria-hidden />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink">Cleaned Data</p>
      </div>
      <div className="mt-3">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-y border-border bg-surface-2/60 text-ink">
              {HERO_TABLE_COLUMNS.map((c) => (
                <th key={c} className="px-4 py-2 text-left font-semibold first:pl-5">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HERO_TABLE_ROWS.map((r, i) => (
              <tr key={i} className="border-t border-border/70 text-ink-secondary first:border-t-0">
                <td className="px-4 py-2 first:pl-5">{r.date}</td>
                <td className="px-4 py-2">{r.region}</td>
                <td className="px-4 py-2">{r.product}</td>
                <td className="px-4 py-2">{r.sales}</td>
                <td className="px-4 py-2">{r.units}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
