import { HERO_TABLE_COLUMNS, HERO_TABLE_ROWS } from "@/components/landing/hero/heroData";

/** Coded recreation of the "RAW CSV" reference card. */
export function RawCsvCard({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-border bg-surface shadow-lg ${className ?? ""}`}>
      <div className="px-5 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink">Raw CSV</p>
        <div className="mt-2.5 flex items-center gap-3">
          <FileGlyph />
          <div>
            <p className="text-[17px] font-bold leading-none text-ink">sales_data.csv</p>
            <p className="mt-1.5 text-[12.5px] text-ink-secondary">
              24.8 MB <span className="text-brand">•</span> 15,640 rows
            </p>
          </div>
        </div>
      </div>
      {!compact && <div className="mt-3.5">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-brand-weak text-ink">
              {HERO_TABLE_COLUMNS.map((c) => (
                <th key={c} className="px-4 py-2 text-left font-semibold first:pl-5">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HERO_TABLE_ROWS.map((r, i) => (
              <tr key={i} className="border-t border-border/70 text-ink-secondary">
                <td className="px-4 py-2 first:pl-5">{r.date}</td>
                <td className="px-4 py-2">{r.region}</td>
                <td className="px-4 py-2">{r.product}</td>
                <td className="px-4 py-2">{r.sales}</td>
                <td className="px-4 py-2">{r.units}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
    </div>
  );
}

function FileGlyph() {
  return (
    <svg width="40" height="46" viewBox="0 0 40 46" fill="none" aria-hidden className="shrink-0">
      <path d="M4 3a3 3 0 0 1 3-3h20l9 9v27a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V3Z" fill="#dfe7dc" />
      <path d="M27 0l9 9h-9V0Z" fill="#c4d2be" />
      <rect x="0" y="24" width="30" height="17" rx="3" fill="#5f7e4b" />
      <text x="15" y="36" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff" fontFamily="var(--font-sans), sans-serif">
        CSV
      </text>
    </svg>
  );
}
