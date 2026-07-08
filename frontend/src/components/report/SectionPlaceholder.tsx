export function SectionPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border-strong bg-surface-2/40">
      <p className="text-[13px] text-ink-tertiary">{label} — coming up next.</p>
    </div>
  );
}
