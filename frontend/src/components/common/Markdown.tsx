import React from "react";

/** Minimal markdown renderer for AI-generated narrative text — headings,
 * bold, and bullet/numbered lists. Deliberately not a full markdown
 * dependency; the AI narrative only ever uses this small subset. */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${keyPrefix}-${i}`} className="font-semibold text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>;
  });
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listKey = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={`list-${listKey++}`} className="my-2 flex flex-col gap-1.5 pl-5">
        {listItems.map((item, i) => (
          <li key={i} className="list-disc text-[13.5px] leading-relaxed text-ink marker:text-ink-tertiary">
            {renderInline(item, `li-${listKey}-${i}`)}
          </li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  text.split("\n").forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) {
      flushList();
      return;
    }
    const bullet = line.match(/^[-*•]\s+(.*)/) || line.match(/^\d+\.\s+(.*)/);
    if (bullet) {
      listItems.push(bullet[1]);
      return;
    }
    flushList();
    const heading = line.match(/^#{1,4}\s+(.*)/);
    if (heading) {
      blocks.push(
        <h3 key={`h-${idx}`} className="mb-1 mt-4 text-[12.5px] font-semibold uppercase tracking-wide text-ink-tertiary first:mt-0">
          {renderInline(heading[1].replace(/\*\*/g, ""), `h-${idx}`)}
        </h3>,
      );
      return;
    }
    const boldHeading = line.match(/^\*\*([^*]+)\*\*:?$/);
    if (boldHeading) {
      blocks.push(
        <h3 key={`bh-${idx}`} className="mb-1 mt-4 text-[12.5px] font-semibold uppercase tracking-wide text-ink-tertiary first:mt-0">
          {boldHeading[1]}
        </h3>,
      );
      return;
    }
    blocks.push(
      <p key={`p-${idx}`} className="my-1 text-[13.5px] leading-relaxed text-ink">
        {renderInline(line, `p-${idx}`)}
      </p>,
    );
  });
  flushList();

  return <div className={className}>{blocks}</div>;
}
