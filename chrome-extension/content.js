/**
 * Sushi EDA — content script.
 *
 * Runs on every page at document_idle.
 * Scans for:
 *   - HTML <table> elements (collects row/column counts + caption)
 *   - Anchor links that point to CSV / TSV / Parquet / JSON / Excel files
 *
 * Stores findings in window.__sushiPageData__ so the popup can read them
 * without needing a message-passing round-trip.
 */

(function scanPage() {
  const DATA_EXTENSIONS = /\.(csv|tsv|parquet|json|jsonl|xlsx?|xls)(\?.*)?$/i;

  // ── Tables ────────────────────────────────────────────────────────────────
  const tables = [];
  document.querySelectorAll("table").forEach((table) => {
    const rows = table.querySelectorAll("tr").length;
    const firstRow = table.querySelector("tr");
    const cols = firstRow ? firstRow.querySelectorAll("th, td").length : 0;
    const caption = table.querySelector("caption")?.innerText?.trim() || "";
    if (rows > 1 && cols > 0) {
      tables.push({ rows, cols, caption });
    }
  });

  // ── CSV / data file links ─────────────────────────────────────────────────
  const csvLinks = [];
  const seen = new Set();
  document.querySelectorAll("a[href]").forEach((a) => {
    const href = a.href;
    if (!href || seen.has(href)) return;
    try {
      const url = new URL(href);
      if (DATA_EXTENSIONS.test(url.pathname)) {
        seen.add(href);
        const parts = url.pathname.split("/");
        const filename = parts[parts.length - 1] || "data.csv";
        const text = a.innerText?.trim().slice(0, 60) || filename;
        csvLinks.push({ href, filename, text });
      }
    } catch {
      // ignore invalid URLs
    }
  });

  window.__sushiPageData__ = { tables, csvLinks };
})();
