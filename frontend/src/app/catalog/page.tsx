"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Database,
  FileSpreadsheet,
  Loader2,
  Search,
  Star,
  X,
} from "lucide-react";
import {
  DatasetSummary,
  fetchDatasetAnalysis,
  listDatasets,
  listPipelines,
  PipelineSummary,
} from "@/lib/api";

const FORMAT_COLOR: Record<string, string> = {
  csv: "#059669", xlsx: "#2563eb", xls: "#2563eb", parquet: "#7c3aed",
  json: "#d97706", tsv: "#0f766e", sqlite: "#ea580c", db: "#ea580c",
};

function fmtBytes(b: number) {
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  if (b >= 1e3) return `${(b / 1e3).toFixed(0)} KB`;
  return `${b} B`;
}

function fmtRows(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}

// ── Dataset profile panel (expanded) ─────────────────────────────────────────

type AnalysisSummary = {
  quality_score: number;
  grade: string;
  rows: number;
  columns: number;
  missing_pct: number;
  col_types: Record<string, number>;
  top_columns: string[];
};

function ProfilePanel({ dataset, orgId, onClose }: {
  dataset: DatasetSummary;
  orgId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<AnalysisSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataset.id) return;
    setLoading(true); setError(null);
    fetchDatasetAnalysis(dataset.id, orgId)
      .then((res) => {
        const r = res.report;
        const qs = r.quality_score;
        const info = r.basic_info;
        const typesSummary: Record<string, number> = {};
        for (const col of r.column_analysis) {
          const t = col.is_numeric ? "numeric" : col.dtype.includes("datetime") ? "datetime" : "categorical";
          typesSummary[t] = (typesSummary[t] ?? 0) + 1;
        }
        const totalCells = info.rows * info.columns;
        setAnalysis({
          quality_score: qs.overall_score,
          grade: qs.grade,
          rows: info.rows,
          columns: info.columns,
          missing_pct: totalCells > 0 ? (info.total_missing / totalCells) * 100 : 0,
          col_types: typesSummary,
          top_columns: r.column_analysis.slice(0, 8).map((col) => col.name),
        });
      })
      .catch(() => setError("Analysis not available"))
      .finally(() => setLoading(false));
  }, [dataset.id, orgId]);

  const scoreColor = analysis
    ? analysis.quality_score >= 80 ? "#22c55e"
    : analysis.quality_score >= 60 ? "#f59e0b"
    : "#ef4444"
    : "#9a9690";

  function openInDashboard() {
    sessionStorage.setItem("catalog_open_id", dataset.id);
    router.push("/dashboard");
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      display: "flex", alignItems: "flex-end", justifyContent: "flex-end",
    }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div style={{
        position: "relative", zIndex: 10,
        width: 420, height: "100vh",
        background: "rgba(248,246,243,0.97)",
        borderLeft: "1px solid rgba(0,0,0,0.08)",
        backdropFilter: "blur(20px)",
        display: "flex", flexDirection: "column",
        overflowY: "auto",
        boxShadow: "-8px 0 40px rgba(0,0,0,0.12)",
      }}>
        {/* Iridescent stripe */}
        <div style={{
          height: 4, flexShrink: 0,
          background: "linear-gradient(90deg, #9060f8, #e840c8, #00d4e8, #9060f8)",
          backgroundSize: "200% 100%",
          animation: "shimmer 4s linear infinite",
        }} />

        <div style={{ padding: "16px 20px", flex: 1 }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <FileSpreadsheet size={16} style={{ color: "#9060f8", flexShrink: 0 }} />
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111010", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {dataset.name}
                </h2>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
                background: `rgba(${FORMAT_COLOR[dataset.file_format] ? "144,96,248" : "0,0,0"},0.08)`,
                color: FORMAT_COLOR[dataset.file_format] ?? "#9a9690",
                fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
              }}>{dataset.file_format?.toUpperCase()}</span>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9a9690", padding: 4, flexShrink: 0 }}>
              <X size={16} />
            </button>
          </div>

          {/* Key stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
            {[
              { label: "Rows", value: dataset.row_count ? fmtRows(dataset.row_count) : "–" },
              { label: "Columns", value: dataset.column_count ?? "–" },
              { label: "Size", value: dataset.file_size_bytes ? fmtBytes(dataset.file_size_bytes) : "–" },
            ].map(({ label, value }) => (
              <div key={label} style={{
                background: "rgba(255,255,255,0.72)", border: "1px solid rgba(0,0,0,0.07)",
                borderRadius: 10, padding: "10px 12px",
              }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#111010" }}>{value}</div>
                <div style={{ fontSize: 9, letterSpacing: "1px", textTransform: "uppercase", color: "#9a9690", fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace" }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Analysis */}
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9a9690", fontSize: 13, padding: "16px 0" }}>
              <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Loading analysis…
            </div>
          )}

          {error && <p style={{ fontSize: 13, color: "#9a9690", marginBottom: 12 }}>{error}</p>}

          {analysis && (
            <>
              {/* Quality score */}
              <div style={{
                background: "rgba(255,255,255,0.72)", border: "1px solid rgba(0,0,0,0.07)",
                borderRadius: 12, padding: "14px 16px", marginBottom: 12,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div>
                  <p style={{ fontSize: 9, letterSpacing: "1px", textTransform: "uppercase", color: "#9a9690", fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace", margin: 0 }}>Quality Score</p>
                  <p style={{ fontSize: 24, fontWeight: 800, color: scoreColor, margin: "4px 0 0" }}>{analysis.quality_score}<span style={{ fontSize: 13, color: "#9a9690" }}>/100</span></p>
                </div>
                <div style={{
                  width: 48, height: 48, borderRadius: "50%",
                  background: `conic-gradient(${scoreColor} ${analysis.quality_score * 3.6}deg, rgba(0,0,0,0.06) 0deg)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#f8f6f3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: scoreColor }}>
                    {analysis.grade}
                  </div>
                </div>
              </div>

              {/* Missing % + column types */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                <div style={{ background: "rgba(255,255,255,0.72)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: analysis.missing_pct > 20 ? "#ef4444" : "#22c55e" }}>{analysis.missing_pct.toFixed(1)}%</div>
                  <div style={{ fontSize: 9, letterSpacing: "1px", textTransform: "uppercase", color: "#9a9690", fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace" }}>Missing</div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.72)", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#111010" }}>
                    {Object.entries(analysis.col_types).map(([t, n]) => `${n} ${t}`).join(" · ")}
                  </div>
                  <div style={{ fontSize: 9, letterSpacing: "1px", textTransform: "uppercase", color: "#9a9690", fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace", marginTop: 2 }}>Column types</div>
                </div>
              </div>

              {/* Columns preview */}
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 9, letterSpacing: "1.5px", textTransform: "uppercase", color: "#9a9690", fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace", marginBottom: 6 }}>Columns</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {analysis.top_columns.map((c) => (
                    <span key={c} style={{
                      padding: "2px 8px", borderRadius: 5, fontSize: 11,
                      background: "rgba(144,96,248,0.08)", color: "#9060f8",
                      fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
                      border: "1px solid rgba(144,96,248,0.15)",
                    }}>{c}</span>
                  ))}
                  {analysis.columns > 8 && (
                    <span style={{ fontSize: 11, color: "#9a9690", padding: "2px 4px" }}>+{analysis.columns - 8} more</span>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Open button */}
          <button
            onClick={openInDashboard}
            style={{
              width: "100%", padding: "11px 0", borderRadius: 12,
              background: "linear-gradient(135deg, #9060f8, #e840c8)",
              color: "#fff", fontSize: 14, fontWeight: 600,
              border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <ArrowRight size={15} /> Open in Analyzer
          </button>

          <p style={{ fontSize: 11, color: "#9a9690", textAlign: "center", marginTop: 8 }}>
            Created {new Date(dataset.created_at).toLocaleDateString()}
          </p>
        </div>

        <style>{`
          @keyframes shimmer { 0%{background-position:0% 0} 100%{background-position:200% 0} }
          @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        `}</style>
      </div>
    </div>
  );
}

// ── Dataset card ──────────────────────────────────────────────────────────────

function DatasetCard({ dataset, onSelect }: { dataset: DatasetSummary; onSelect: () => void }) {
  const fmt = dataset.file_format ?? "csv";
  const fmtColor = FORMAT_COLOR[fmt] ?? "#9a9690";
  const ready = dataset.status === "ready";

  return (
    <div
      onClick={ready ? onSelect : undefined}
      style={{
        background: "rgba(255,255,255,0.72)",
        border: "1px solid rgba(0,0,0,0.07)",
        borderRadius: 14, overflow: "hidden",
        cursor: ready ? "pointer" : "default",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={(e) => { if (ready) { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(144,96,248,0.35)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(144,96,248,0.1)"; }}}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(0,0,0,0.07)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
    >
      {/* Stripe */}
      <div style={{ height: 3, background: ready ? `linear-gradient(90deg, ${fmtColor}, #9060f8)` : "rgba(0,0,0,0.06)" }} />

      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9, flexShrink: 0,
            background: `linear-gradient(135deg, rgba(144,96,248,0.15), rgba(232,64,200,0.1))`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <FileSpreadsheet size={16} style={{ color: "#9060f8" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 600, fontSize: 14, color: "#111010", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {dataset.name}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
              <span style={{
                fontSize: 9, fontWeight: 600, padding: "1px 5px", borderRadius: 4,
                background: `rgba(144,96,248,0.08)`, color: fmtColor,
                fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
              }}>{fmt.toUpperCase()}</span>
              {dataset.is_starred && <Star size={10} style={{ color: "#f59e0b", fill: "#f59e0b" }} />}
            </div>
          </div>
          <span style={{
            fontSize: 10, padding: "2px 7px", borderRadius: 20, flexShrink: 0,
            background: ready ? "rgba(34,197,94,0.1)" : dataset.status === "processing" ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)",
            color: ready ? "#22c55e" : dataset.status === "processing" ? "#f59e0b" : "#ef4444",
            fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
          }}>{dataset.status}</span>
        </div>

        <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#9a9690", fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace" }}>
          {dataset.row_count != null && <span>{fmtRows(dataset.row_count)} rows</span>}
          {dataset.column_count != null && <span>{dataset.column_count} cols</span>}
          {dataset.file_size_bytes != null && <span>{fmtBytes(dataset.file_size_bytes)}</span>}
        </div>

        <p style={{ fontSize: 10, color: "#c8c4be", margin: "8px 0 0", fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace" }}>
          {new Date(dataset.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

// ── Lineage section ───────────────────────────────────────────────────────────

function LineageSection({ datasets, pipelines }: { datasets: DatasetSummary[]; pipelines: PipelineSummary[] }) {
  const dsMap = useMemo(() => Object.fromEntries(datasets.map((d) => [d.id, d])), [datasets]);
  const chains = pipelines.filter((p) => p.source_dataset_id);

  if (chains.length === 0) {
    return (
      <div style={{
        background: "rgba(255,255,255,0.72)", border: "1px dashed rgba(0,0,0,0.1)",
        borderRadius: 14, padding: 32, textAlign: "center", color: "#9a9690", fontSize: 13,
      }}>
        No pipeline lineage yet. Create pipelines to track data transformations.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {chains.map((p) => {
        const src = p.source_dataset_id ? dsMap[p.source_dataset_id] : null;
        return (
          <div key={p.pipeline_id} style={{
            background: "rgba(255,255,255,0.72)", border: "1px solid rgba(0,0,0,0.07)",
            borderRadius: 12, padding: "12px 16px",
            display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
          }}>
            {/* Source */}
            <div style={{
              padding: "4px 10px", borderRadius: 8,
              background: "rgba(144,96,248,0.08)", border: "1px solid rgba(144,96,248,0.15)",
              fontSize: 12, fontWeight: 600, color: "#9060f8",
              fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
            }}>
              {src ? src.name : "Unknown source"}
            </div>

            <ArrowRight size={14} style={{ color: "#9a9690", flexShrink: 0 }} />

            {/* Pipeline */}
            <div style={{
              padding: "4px 10px", borderRadius: 8,
              background: "rgba(232,64,200,0.06)", border: "1px solid rgba(232,64,200,0.12)",
              fontSize: 12, fontWeight: 500, color: "#e840c8",
            }}>
              Pipeline: {p.name}
            </div>

            <ArrowRight size={14} style={{ color: "#9a9690", flexShrink: 0 }} />

            {/* Destination */}
            <div style={{
              padding: "4px 10px", borderRadius: 8,
              background: "rgba(0,212,232,0.06)", border: "1px solid rgba(0,212,232,0.15)",
              fontSize: 12, fontWeight: 500, color: "#0891b2",
            }}>
              {p.destination_type} output
            </div>

            <span style={{
              marginLeft: "auto", fontSize: 10,
              fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
              padding: "2px 7px", borderRadius: 20,
              background: p.last_run_status === "success" ? "rgba(34,197,94,0.1)" : p.last_run_status === "failed" ? "rgba(239,68,68,0.1)" : "rgba(0,0,0,0.05)",
              color: p.last_run_status === "success" ? "#22c55e" : p.last_run_status === "failed" ? "#ef4444" : "#9a9690",
            }}>
              {p.last_run_status ?? "never run"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CatalogPage() {
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [pipelines, setPipelines] = useState<PipelineSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fmtFilter, setFmtFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"catalog" | "lineage">("catalog");
  const [selected, setSelected] = useState<DatasetSummary | null>(null);
  const orgId = "default";

  useEffect(() => {
    Promise.all([listDatasets(orgId), listPipelines(orgId)])
      .then(([ds, ps]) => { setDatasets(ds); setPipelines(ps); })
      .finally(() => setLoading(false));
  }, [orgId]);

  const formats = useMemo(() => {
    const fmts = new Set(datasets.map((d) => d.file_format ?? "csv").filter(Boolean));
    return ["all", ...Array.from(fmts)];
  }, [datasets]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return datasets.filter((d) => {
      const matchName = d.name.toLowerCase().includes(q) || d.original_filename?.toLowerCase().includes(q);
      const matchFmt = fmtFilter === "all" || d.file_format === fmtFilter;
      return matchName && matchFmt;
    });
  }, [datasets, search, fmtFilter]);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const tabStyle = useCallback((tab: "catalog" | "lineage"): React.CSSProperties => ({
    padding: "7px 18px", borderRadius: 20, fontSize: 13, fontWeight: 500,
    border: "none", cursor: "pointer",
    background: activeTab === tab ? "rgba(144,96,248,0.12)" : "transparent",
    color: activeTab === tab ? "#9060f8" : "#9a9690",
  }), [activeTab]);

  return (
    <div style={{ minHeight: "100vh", background: "#f0eee9" }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:0% 0} 100%{background-position:200% 0} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>

      {/* Nav */}
      <header style={{
        position: "sticky", top: 0, zIndex: 40,
        background: "rgba(240,238,233,0.9)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        padding: "0 32px",
        display: "flex", alignItems: "center", gap: 16, height: 56,
      }}>
        <Link href="/datasets" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,#1a1a1a,#333)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🍣</div>
          <span style={{ fontWeight: 600, fontSize: 15, color: "#111010" }}>Sushi</span>
        </Link>
        <span style={{ color: "#c8c4be", fontSize: 14 }}>/</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#111010", fontWeight: 500, fontSize: 14 }}>
          <BookOpen size={15} style={{ color: "#9060f8" }} />
          Data Catalog
        </div>
        <div style={{ flex: 1 }} />
        <Link href="/datasets" style={{ fontSize: 13, color: "#9a9690", textDecoration: "none" }}>My Datasets</Link>
        <Link href="/connectors" style={{ fontSize: 13, color: "#9a9690", textDecoration: "none" }}>Connections</Link>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        {/* Page header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#111010", margin: "0 0 6px" }}>Data Catalog</h1>
          <p style={{ fontSize: 14, color: "#9a9690", margin: 0 }}>
            {datasets.length} datasets · search, filter, and explore your data inventory
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "rgba(255,255,255,0.5)", borderRadius: 24, padding: 4, width: "fit-content" }}>
          <button style={tabStyle("catalog")} onClick={() => setActiveTab("catalog")}>Catalog</button>
          <button style={tabStyle("lineage")} onClick={() => setActiveTab("lineage")}>Lineage</button>
        </div>

        {activeTab === "catalog" && (
          <>
            {/* Search + filter bar */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              <div style={{
                flex: 1, minWidth: 220,
                display: "flex", alignItems: "center", gap: 8,
                background: "rgba(255,255,255,0.72)", border: "1px solid rgba(0,0,0,0.07)",
                borderRadius: 10, padding: "0 12px",
              }}>
                <Search size={14} style={{ color: "#9a9690", flexShrink: 0 }} />
                <input
                  ref={inputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name…"
                  style={{ flex: 1, border: "none", background: "transparent", fontSize: 13, color: "#111010", outline: "none", padding: "9px 0" }}
                />
                {search && (
                  <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#9a9690", padding: 0 }}>
                    <X size={13} />
                  </button>
                )}
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                {formats.map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => setFmtFilter(fmt)}
                    style={{
                      padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500,
                      border: `1px solid ${fmtFilter === fmt ? "rgba(144,96,248,0.4)" : "rgba(0,0,0,0.1)"}`,
                      background: fmtFilter === fmt ? "rgba(144,96,248,0.1)" : "rgba(255,255,255,0.72)",
                      color: fmtFilter === fmt ? "#9060f8" : "#6b6860",
                      cursor: "pointer",
                      fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
                    }}
                  >{fmt === "all" ? "All" : fmt.toUpperCase()}</button>
                ))}
              </div>
            </div>

            {/* Dataset grid */}
            {loading ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#9a9690", padding: "32px 0" }}>
                <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Loading catalog…
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#9a9690" }}>
                <Database size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                <p style={{ fontSize: 15 }}>No datasets found{search ? ` for "${search}"` : ""}</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                {filtered.map((d) => (
                  <DatasetCard key={d.id} dataset={d} onSelect={() => setSelected(d)} />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "lineage" && (
          <>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111010", marginBottom: 16 }}>Pipeline Lineage</h2>
            {loading ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#9a9690" }}>
                <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Loading…
              </div>
            ) : (
              <LineageSection datasets={datasets} pipelines={pipelines} />
            )}
          </>
        )}
      </div>

      {/* Profile panel */}
      {selected && (
        <ProfilePanel dataset={selected} orgId={orgId} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
