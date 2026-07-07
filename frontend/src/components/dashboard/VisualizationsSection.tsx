"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  AlertCircle,
  BarChart3,
  Loader2,
  TrendingUp,
  ScatterChart,
  BoxSelect,
  Layers,
  Download,
  Link2,
  Wand2,
  Plus,
  ChevronDown,
} from "lucide-react";
import { EDAReport } from "@/lib/types";
import { fetchDatasetRows } from "@/lib/api";

const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
  loading: () => (
    <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 style={{ width: 18, height: 18, color: "#9060f8", animation: "spin 1s linear infinite" }} />
    </div>
  ),
});

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  visualizations: Record<string, any> | null;
  isLoading: boolean;
  report: EDAReport;
  datasetId: string | null;
  orgId?: string;
}

type ChartType =
  | "auto"
  | "bar"
  | "line"
  | "scatter"
  | "histogram"
  | "box"
  | "violin"
  | "treemap"
  | "sunburst"
  | "sankey"
  | "choropleth"
  | "network"
  | "heatmap";
type Tab = "overview" | "numeric" | "categorical" | "builder";

const CHART_TYPES: { type: ChartType; label: string; icon: React.ElementType; desc: string }[] = [
  { type: "auto",      label: "Auto",      icon: Wand2,         desc: "Suggest by selected columns" },
  { type: "bar",       label: "Bar",       icon: BarChart3,     desc: "Categorical comparison" },
  { type: "line",      label: "Line",      icon: TrendingUp,    desc: "Trends over time" },
  { type: "scatter",   label: "Scatter",   icon: ScatterChart,  desc: "Correlation between 2 numeric" },
  { type: "histogram", label: "Histogram", icon: Layers,        desc: "Single column distribution" },
  { type: "box",       label: "Box",       icon: BoxSelect,     desc: "Distribution + outliers" },
  { type: "violin",    label: "Violin",    icon: BoxSelect,     desc: "Distribution shape" },
  { type: "treemap",   label: "Treemap",   icon: Layers,        desc: "Hierarchy by group and value" },
  { type: "sunburst",  label: "Sunburst",  icon: Layers,        desc: "Multi-level categorical split" },
  { type: "sankey",    label: "Sankey",    icon: TrendingUp,    desc: "Flow between categories" },
  { type: "choropleth",label: "Map",       icon: BarChart3,     desc: "Geographic intensity map" },
  { type: "network",   label: "Network",   icon: ScatterChart,  desc: "Entity relationship graph" },
];

// ── Warm-styled plotly chart wrapper ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PlotlyChart({ spec, title, height = 280 }: { spec: any; title?: string; height?: number }) {
  if (!spec || spec.error) {
    return (
      <div style={{
        height: 80, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        borderRadius: 10, background: "rgba(0,0,0,0.03)",
        fontSize: 12, color: "#9a9690",
      }}>
        <AlertCircle style={{ width: 13, height: 13 }} />
        {spec?.error ?? "Chart unavailable"}
      </div>
    );
  }

  const layout = {
    ...(spec.layout ?? {}),
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(248,246,243,0.5)",
    font: { family: "Geist, system-ui, sans-serif", size: 11, color: "#6b6860" },
    autosize: true,
    margin: { l: 44, r: 16, t: title ? 32 : 16, b: 40 },
    colorway: ["#9060f8", "#e840c8", "#00d4e8", "#f8d030", "#ff7040", "#00e8a0"],
    xaxis: { ...(spec.layout?.xaxis ?? {}), gridcolor: "rgba(0,0,0,0.06)", linecolor: "rgba(0,0,0,0.1)", zerolinecolor: "rgba(0,0,0,0.1)" },
    yaxis: { ...(spec.layout?.yaxis ?? {}), gridcolor: "rgba(0,0,0,0.06)", linecolor: "rgba(0,0,0,0.1)", zerolinecolor: "rgba(0,0,0,0.1)" },
  };
  if (title) layout.title = { text: title, font: { size: 12, color: "#111010" } };

  return (
    <Plot
      data={spec.data ?? []}
      layout={layout}
      config={{
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ["select2d", "lasso2d", "autoScale2d"],
        toImageButtonOptions: { format: "png", scale: 2 },
        displaylogo: false,
      }}
      useResizeHandler
      style={{ width: "100%", minHeight: height }}
    />
  );
}

// ── Chart card ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartCard({ title, spec, dtype }: { title: string; spec: any; dtype?: string }) {
  const [expanded, setExpanded] = useState(true);
  if (!spec || spec.error) return null;

  return (
    <div style={{
      background: "rgba(255,255,255,0.72)",
      border: "1px solid rgba(255,255,255,0.8)",
      borderRadius: 16,
      boxShadow: "0 2px 16px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)",
      overflow: "hidden",
    }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          width: "100%", padding: "12px 16px",
          background: "none", border: "none", cursor: "pointer",
          borderBottom: expanded ? "1px solid rgba(0,0,0,0.06)" : "none",
        }}
      >
        <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13, fontWeight: 500, color: "#111010", flex: 1, textAlign: "left" }}>
          {title}
        </span>
        {dtype && (
          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "rgba(144,96,248,0.1)", color: "#9060f8", fontFamily: "ui-monospace, Menlo, monospace" }}>
            {dtype}
          </span>
        )}
        <ChevronDown style={{ width: 13, height: 13, color: "#9a9690", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>
      {expanded && (
        <div style={{ padding: "0 8px 8px" }}>
          <PlotlyChart spec={spec} />
        </div>
      )}
    </div>
  );
}

// ── Custom chart builder ──────────────────────────────────────────────────────

function toNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function aggregatePairs(
  primary: unknown[],
  secondary: unknown[],
  values?: unknown[]
): Array<{ key: string; value: number }> {
  const totals = new Map<string, number>();
  for (let i = 0; i < primary.length; i += 1) {
    const first = String(primary[i] ?? "null");
    const second = String(secondary[i] ?? "null");
    const key = `${first}|||${second}`;
    const increment = values ? toNumber(values[i]) : 1;
    totals.set(key, (totals.get(key) ?? 0) + increment);
  }
  return Array.from(totals.entries()).map(([key, value]) => ({ key, value }));
}

function aggregateSingle(
  labels: unknown[],
  values?: unknown[]
): Array<{ label: string; value: number }> {
  const totals = new Map<string, number>();
  for (let i = 0; i < labels.length; i += 1) {
    const label = String(labels[i] ?? "null");
    const increment = values ? toNumber(values[i]) : 1;
    totals.set(label, (totals.get(label) ?? 0) + increment);
  }
  return Array.from(totals.entries()).map(([label, value]) => ({ label, value }));
}

function ChartBuilder({ report, datasetId, orgId = "default" }: { report: EDAReport; datasetId: string | null; orgId?: string }) {
  const reportPreview = useMemo(() => report.preview ?? [], [report.preview]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [fullRows, setFullRows] = useState<any[] | null>(null);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsMeta, setRowsMeta] = useState<{ total: number; truncated: boolean } | null>(null);

  useEffect(() => {
    if (!datasetId) return;
    let cancelled = false;
    setRowsLoading(true);
    fetchDatasetRows(datasetId, {}, orgId)
      .then((result) => {
        if (cancelled) return;
        setFullRows(result.rows);
        setRowsMeta({ total: result.total_rows, truncated: result.truncated });
      })
      .catch(() => {
        // Fall back silently to report.preview below.
      })
      .finally(() => {
        if (!cancelled) setRowsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [datasetId, orgId]);

  // Real dataset rows (up to 5,000) once loaded; falls back to the 50-row
  // report preview so the builder still works while fetching or if it fails.
  const preview = fullRows ?? reportPreview;
  const columns = report.column_analysis;
  const numericCols = columns.filter((c) => c.is_numeric).map((c) => c.name);
  const categoricalCols = columns.filter((c) => !c.is_numeric).map((c) => c.name);
  const allCols = columns.map((c) => c.name);
  const numericSet = useMemo(() => new Set(numericCols), [numericCols]);

  const [chartType, setChartType] = useState<ChartType>("auto");
  const [xCol, setXCol] = useState(categoricalCols[0] ?? allCols[0] ?? "");
  const [yCol, setYCol] = useState(numericCols[0] ?? "");
  const [colorCol, setColorCol] = useState("");
  const [title, setTitle] = useState("");
  const [embedCopied, setEmbedCopied] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const resolvedChartType = useMemo<ChartType>(() => {
    if (chartType !== "auto") return chartType;
    const xNumeric = numericSet.has(xCol);
    const yNumeric = numericSet.has(yCol);
    if (!xCol) return "bar";
    if (!yCol) return xNumeric ? "histogram" : "bar";
    if (xNumeric && yNumeric) return "scatter";
    if (!xNumeric && yNumeric) return "bar";
    return "line";
  }, [chartType, xCol, yCol, numericSet]);

  // Build plotly trace from preview data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builtSpec = useMemo((): any | null => {
    if (!xCol || preview.length === 0) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const xVals = preview.map((r: any) => r[xCol]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yVals = yCol ? preview.map((r: any) => r[yCol]) : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const colorVals = colorCol ? preview.map((r: any) => r[colorCol]) : undefined;

    const ct = resolvedChartType;
    let data: Record<string, unknown>[] = [];

    if (ct === "bar") {
      if (yCol) {
        const grouped = aggregateSingle(xVals, yVals);
        data = [{
          type: "bar",
          x: grouped.map((g) => g.label),
          y: grouped.map((g) => g.value),
          marker: { color: "#9060f8", opacity: 0.85 },
        }];
      } else {
        const grouped = aggregateSingle(xVals);
        data = [{
          type: "bar",
          x: grouped.map((g) => g.label),
          y: grouped.map((g) => g.value),
          marker: { color: "#9060f8", opacity: 0.85 },
        }];
      }
    } else if (ct === "line") {
      if (!yCol) return { error: "Line chart requires a Y axis column." };
      data = [{
        type: "scatter",
        mode: "lines+markers",
        x: xVals,
        y: yVals,
        line: { color: "#9060f8", width: 2 },
      }];
    } else if (ct === "scatter") {
      if (!yCol) return { error: "Scatter chart requires a Y axis column." };
      data = [{
        type: "scatter",
        mode: "markers",
        x: xVals,
        y: yVals,
        marker: { color: colorVals ?? "#9060f8", opacity: 0.7, size: 6 },
      }];
    } else if (ct === "histogram") {
      data = [{ type: "histogram", x: xVals, marker: { color: "#9060f8", opacity: 0.85 } }];
    } else if (ct === "box") {
      if (!yCol) return { error: "Box plot requires a Y axis column." };
      data = [{ type: "box", y: yVals, x: colorVals ?? xVals, marker: { color: "#9060f8" }, boxmean: true }];
    } else if (ct === "violin") {
      if (!yCol) return { error: "Violin chart requires a Y axis column." };
      data = [{
        type: "violin",
        y: yVals,
        x: colorVals ?? xVals,
        box: { visible: true },
        meanline: { visible: true },
        fillcolor: "rgba(144,96,248,0.3)",
        line: { color: "#9060f8" },
      }];
    } else if (ct === "treemap") {
      if (colorVals) {
        const grouped = aggregatePairs(xVals, colorVals, yCol ? yVals : undefined);
        const parentTotals = new Map<string, number>();
        for (const entry of grouped) {
          const [parent] = entry.key.split("|||");
          parentTotals.set(parent, (parentTotals.get(parent) ?? 0) + entry.value);
        }
        const labels = Array.from(parentTotals.keys());
        const parents = labels.map(() => "");
        const values = labels.map((label) => parentTotals.get(label) ?? 0);
        for (const entry of grouped) {
          const [parent, child] = entry.key.split("|||");
          labels.push(child);
          parents.push(parent);
          values.push(entry.value);
        }
        data = [{ type: "treemap", labels, parents, values, branchvalues: "total" }];
      } else {
        const grouped = aggregateSingle(xVals, yCol ? yVals : undefined);
        data = [{
          type: "treemap",
          labels: grouped.map((g) => g.label),
          parents: grouped.map(() => ""),
          values: grouped.map((g) => g.value),
          branchvalues: "total",
        }];
      }
    } else if (ct === "sunburst") {
      if (!colorVals) return { error: "Sunburst chart works best with a group column." };
      const grouped = aggregatePairs(xVals, colorVals, yCol ? yVals : undefined);
      const parentTotals = new Map<string, number>();
      for (const entry of grouped) {
        const [parent] = entry.key.split("|||");
        parentTotals.set(parent, (parentTotals.get(parent) ?? 0) + entry.value);
      }
      const labels = Array.from(parentTotals.keys());
      const parents = labels.map(() => "");
      const values = labels.map((label) => parentTotals.get(label) ?? 0);
      for (const entry of grouped) {
        const [parent, child] = entry.key.split("|||");
        labels.push(child);
        parents.push(parent);
        values.push(entry.value);
      }
      data = [{ type: "sunburst", labels, parents, values, branchvalues: "total" }];
    } else if (ct === "sankey") {
      if (!colorVals) return { error: "Sankey chart requires a group column." };
      const grouped = aggregatePairs(xVals, colorVals, yCol ? yVals : undefined);
      const nodeIndex = new Map<string, number>();
      const labels: string[] = [];
      for (const entry of grouped) {
        const [source, target] = entry.key.split("|||");
        if (!nodeIndex.has(source)) {
          nodeIndex.set(source, labels.length);
          labels.push(source);
        }
        if (!nodeIndex.has(target)) {
          nodeIndex.set(target, labels.length);
          labels.push(target);
        }
      }
      data = [{
        type: "sankey",
        node: { label: labels, pad: 14, thickness: 16 },
        link: {
          source: grouped.map((g) => nodeIndex.get(g.key.split("|||")[0]) ?? 0),
          target: grouped.map((g) => nodeIndex.get(g.key.split("|||")[1]) ?? 0),
          value: grouped.map((g) => g.value),
        },
      }];
    } else if (ct === "choropleth") {
      if (!yCol) return { error: "Map chart requires a numeric Y axis column." };
      const locationMode = xVals.every((v) => /^[A-Z]{2}$/.test(String(v))) ? "USA-states" : "country names";
      data = [{
        type: "choropleth",
        locations: xVals.map((value: unknown) => String(value ?? "")),
        z: yVals.map((value: unknown) => toNumber(value)),
        locationmode: locationMode,
        colorscale: "Viridis",
      }];
    } else if (ct === "network") {
      const linksTo = colorVals ?? (yCol ? yVals : undefined);
      if (!linksTo) return { error: "Network chart requires a second column for links (Group or Y)." };
      const grouped = aggregatePairs(xVals, linksTo);
      const nodeIndex = new Map<string, number>();
      const labels: string[] = [];
      for (const entry of grouped) {
        const [source, target] = entry.key.split("|||");
        if (!nodeIndex.has(source)) {
          nodeIndex.set(source, labels.length);
          labels.push(source);
        }
        if (!nodeIndex.has(target)) {
          nodeIndex.set(target, labels.length);
          labels.push(target);
        }
      }
      const nodeCount = labels.length;
      const points = labels.map((_, idx) => {
        const angle = (2 * Math.PI * idx) / Math.max(1, nodeCount);
        return { x: Math.cos(angle), y: Math.sin(angle) };
      });
      const edgeX: Array<number | null> = [];
      const edgeY: Array<number | null> = [];
      for (const entry of grouped) {
        const [source, target] = entry.key.split("|||");
        const sIdx = nodeIndex.get(source) ?? 0;
        const tIdx = nodeIndex.get(target) ?? 0;
        edgeX.push(points[sIdx].x, points[tIdx].x, null);
        edgeY.push(points[sIdx].y, points[tIdx].y, null);
      }
      data = [
        {
          type: "scatter",
          mode: "lines",
          x: edgeX,
          y: edgeY,
          line: { width: 0.8, color: "rgba(0,0,0,0.25)" },
          hoverinfo: "none",
        },
        {
          type: "scatter",
          mode: "markers+text",
          x: points.map((p) => p.x),
          y: points.map((p) => p.y),
          text: labels,
          textposition: "top center",
          marker: { size: 10, color: "#9060f8", line: { width: 1, color: "#ffffff" } },
          hovertemplate: "%{text}<extra></extra>",
        },
      ];
    }

    const layout = {
      xaxis: { title: xCol, visible: !["sankey"].includes(ct) },
      yaxis: yCol ? { title: yCol } : { visible: !["sankey"].includes(ct) },
      geo: ct === "choropleth" ? { projection: { type: "mercator" } } : undefined,
      title: title || `${ct.charAt(0).toUpperCase() + ct.slice(1)}: ${xCol}${yCol ? ` vs ${yCol}` : ""}`,
    };

    return { data, layout };
  }, [resolvedChartType, xCol, yCol, colorCol, title, preview]);

  const supportsYAxis = !["histogram", "sankey", "network"].includes(resolvedChartType);
  const supportsGroup = ["scatter", "box", "violin", "treemap", "sunburst", "sankey", "network"].includes(resolvedChartType);

  function downloadChart(format: "png" | "svg") {
    const plotNode = previewRef.current?.querySelector(".js-plotly-plot");
    if (!plotNode) return;
    import("plotly.js").then((Plotly) => {
      Plotly.downloadImage(plotNode as unknown as HTMLElement, {
        format,
        width: 1200,
        height: 600,
        filename: `sushi-chart-${resolvedChartType}`,
      });
    });
  }

  function copyEmbedSnippet() {
    if (!builtSpec) return;
    const html = `<div id='chart' style='width:100%;height:100%'></div><script src='https://cdn.plot.ly/plotly-2.35.2.min.js'><\/script><script>const spec=${JSON.stringify(
      builtSpec
    )};Plotly.newPlot('chart', spec.data, spec.layout, {responsive:true,displaylogo:false});<\/script>`;
    const escapedHtml = html.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    const snippet = `<iframe style="width:100%;height:520px;border:0;" srcdoc="${escapedHtml}"></iframe>`;
    navigator.clipboard.writeText(snippet).then(() => {
      setEmbedCopied(true);
      setTimeout(() => setEmbedCopied(false), 1500);
    });
  }

  const selectStyle: React.CSSProperties = {
    padding: "7px 10px", borderRadius: 8, fontSize: 13,
    border: "1px solid rgba(0,0,0,0.1)",
    background: "rgba(255,255,255,0.8)",
    color: "#111010", cursor: "pointer", width: "100%",
  };

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      {/* Config panel */}
      <div style={{
        width: 220, flexShrink: 0,
        background: "rgba(255,255,255,0.72)",
        border: "1px solid rgba(255,255,255,0.8)",
        borderRadius: 16,
        boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
        padding: 16,
      }}>
        <p style={{ fontSize: 9, fontFamily: "ui-monospace, Menlo, monospace", letterSpacing: "2px", textTransform: "uppercase", color: "#9a9690", marginBottom: 14 }}>
          Chart Builder
        </p>

        {/* Chart type grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
          {CHART_TYPES.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              onClick={() => setChartType(type)}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                padding: "8px 6px", borderRadius: 8,
                border: chartType === type ? "1.5px solid rgba(144,96,248,0.4)" : "1px solid rgba(0,0,0,0.08)",
                background: chartType === type ? "rgba(144,96,248,0.08)" : "rgba(255,255,255,0.5)",
                cursor: "pointer",
                color: chartType === type ? "#9060f8" : "#6b6860",
              }}
            >
              <Icon style={{ width: 14, height: 14 }} />
              <span style={{ fontSize: 10, fontWeight: chartType === type ? 500 : 400 }}>{label}</span>
            </button>
          ))}
        </div>

        {/* Axis selectors */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={{ fontSize: 10, color: "#9a9690", fontFamily: "ui-monospace, Menlo, monospace", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>
              X axis
            </label>
            <select style={selectStyle} value={xCol} onChange={(e) => setXCol(e.target.value)}>
              {allCols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {supportsYAxis && (
            <div>
              <label style={{ fontSize: 10, color: "#9a9690", fontFamily: "ui-monospace, Menlo, monospace", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>
                Y axis
              </label>
              <select style={selectStyle} value={yCol} onChange={(e) => setYCol(e.target.value)}>
                <option value="">— none —</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          {supportsGroup && (
            <div>
              <label style={{ fontSize: 10, color: "#9a9690", fontFamily: "ui-monospace, Menlo, monospace", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>
                Color / Group
              </label>
              <select style={selectStyle} value={colorCol} onChange={(e) => setColorCol(e.target.value)}>
                <option value="">— none —</option>
                {categoricalCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          <div>
            <label style={{ fontSize: 10, color: "#9a9690", fontFamily: "ui-monospace, Menlo, monospace", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>
              Title (optional)
            </label>
            <input
              style={{ ...selectStyle, width: "100%", boxSizing: "border-box" }}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My chart…"
            />
          </div>
        </div>

        <p style={{ fontSize: 10, color: "#c0bdb8", marginTop: 12, lineHeight: 1.5 }}>
          {rowsLoading && !fullRows
            ? "Loading full dataset…"
            : rowsMeta
              ? rowsMeta.truncated
                ? `Aggregating ${preview.length.toLocaleString()} of ${rowsMeta.total.toLocaleString()} rows`
                : `Aggregating all ${rowsMeta.total.toLocaleString()} rows`
              : `Using first ${Math.min(preview.length, 5000)} rows of preview data`}
        </p>
        {chartType === "auto" && (
          <p style={{ fontSize: 10, color: "#9060f8", marginTop: 8 }}>
            Suggested chart type: <strong>{resolvedChartType}</strong>
          </p>
        )}
      </div>

      {/* Chart preview */}
      <div style={{ flex: 1, minWidth: 0 }} ref={previewRef}>
        {builtSpec ? (
          <div style={{
            background: "rgba(255,255,255,0.72)",
            border: "1px solid rgba(255,255,255,0.8)",
            borderRadius: 16,
            boxShadow: "0 2px 16px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)",
            overflow: "hidden",
          }}>
            <div style={{
              display: "flex", alignItems: "center", padding: "10px 16px",
              borderBottom: "1px solid rgba(0,0,0,0.06)",
              background: "rgba(255,255,255,0.4)",
            }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: "#111010", flex: 1 }}>
                {builtSpec.layout?.title || "Chart Preview"}
              </span>
              <button
                onClick={() => downloadChart("png")}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 10px", borderRadius: 7, fontSize: 11,
                  border: "1px solid rgba(0,0,0,0.1)",
                  background: "rgba(255,255,255,0.8)",
                  color: "#6b6860", cursor: "pointer",
                }}
              >
                <Download style={{ width: 11, height: 11 }} />
                PNG
              </button>
              <button
                onClick={() => downloadChart("svg")}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 10px", borderRadius: 7, fontSize: 11,
                  border: "1px solid rgba(0,0,0,0.1)",
                  background: "rgba(255,255,255,0.8)",
                  color: "#6b6860", cursor: "pointer",
                  marginLeft: 6,
                }}
              >
                <Download style={{ width: 11, height: 11 }} />
                SVG
              </button>
              <button
                onClick={copyEmbedSnippet}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "5px 10px", borderRadius: 7, fontSize: 11,
                  border: "1px solid rgba(0,0,0,0.1)",
                  background: "rgba(255,255,255,0.8)",
                  color: embedCopied ? "#10b981" : "#6b6860",
                  cursor: "pointer",
                  marginLeft: 6,
                }}
              >
                <Link2 style={{ width: 11, height: 11 }} />
                {embedCopied ? "Copied" : "Embed"}
              </button>
            </div>
            <div style={{ padding: "0 8px 8px" }}>
              <PlotlyChart spec={builtSpec} height={360} />
            </div>
          </div>
        ) : (
          <div style={{
            height: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            background: "rgba(255,255,255,0.4)",
            border: "1.5px dashed rgba(0,0,0,0.1)",
            borderRadius: 16,
          }}>
            <BarChart3 style={{ width: 28, height: 28, color: "rgba(144,96,248,0.3)", marginBottom: 10 }} />
            <p style={{ fontSize: 13, color: "#9a9690" }}>Select columns to build a chart</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Section ──────────────────────────────────────────────────────────────

export function VisualizationsSection({ visualizations, isLoading, report, datasetId, orgId = "default" }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: "80px 0" }}>
        <Loader2 style={{ width: 24, height: 24, color: "#9060f8", animation: "spin 1s linear infinite" }} />
        <p style={{ fontSize: 13, color: "#9a9690" }}>Generating visualizations…</p>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columnCharts: Record<string, { distribution?: any; box_plot?: any; violin?: any; categorical_bar?: any }> =
    visualizations?.columns ?? {};

  const numericColumns = report.column_analysis.filter((c) => c.is_numeric);
  const categoricalColumns = report.column_analysis.filter((c) => !c.is_numeric);

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: "overview",     label: "Overview" },
    { key: "numeric",      label: "Numeric",     count: numericColumns.length },
    { key: "categorical",  label: "Categorical", count: categoricalColumns.length },
    { key: "builder",      label: "Build Chart" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, background: "rgba(0,0,0,0.05)", borderRadius: 12, padding: 3, alignSelf: "flex-start" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 16px", borderRadius: 9, fontSize: 13,
              fontWeight: activeTab === t.key ? 500 : 400,
              color: activeTab === t.key ? "#111010" : "#6b6860",
              background: activeTab === t.key ? "white" : "transparent",
              boxShadow: activeTab === t.key ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
              border: "none", cursor: "pointer", transition: "all 0.15s",
            }}
          >
            {t.key === "builder" && <Plus style={{ width: 12, height: 12 }} />}
            {t.label}
            {t.count != null && (
              <span style={{
                padding: "1px 6px", borderRadius: 99, fontSize: 10, fontWeight: 600,
                background: activeTab === t.key ? "rgba(144,96,248,0.15)" : "rgba(0,0,0,0.08)",
                color: activeTab === t.key ? "#7c3aed" : "#9a9690",
              }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {!visualizations ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <BarChart3 style={{ width: 32, height: 32, color: "rgba(144,96,248,0.3)", margin: "0 auto 12px" }} />
              <p style={{ fontSize: 13.5, color: "#9a9690", marginBottom: 6 }}>Visualizations are loading…</p>
              <p style={{ fontSize: 12, color: "#c0bdb8" }}>Navigate away and back to this tab to trigger generation.</p>
            </div>
          ) : (
            <>
              {visualizations.quality_radar && !visualizations.quality_radar.error && (
                <ChartCard title="Quality Score Breakdown" spec={visualizations.quality_radar} />
              )}
              {visualizations.trend && !visualizations.trend.error && (
                <ChartCard title="Trend Over Time" spec={visualizations.trend} />
              )}
              {visualizations.pareto && !visualizations.pareto.error && (
                <ChartCard title="Pareto (80/20) Analysis" spec={visualizations.pareto} />
              )}
              {visualizations.top_n && !visualizations.top_n.error && (
                <ChartCard title="Top Contributors" spec={visualizations.top_n} />
              )}
              {visualizations.waterfall && !visualizations.waterfall.error && (
                <ChartCard title="Contribution Breakdown" spec={visualizations.waterfall} />
              )}
              {visualizations.correlation_heatmap && !visualizations.correlation_heatmap.error && (
                <ChartCard title="Correlation Heatmap" spec={visualizations.correlation_heatmap} />
              )}
              {visualizations.scatter_matrix && !visualizations.scatter_matrix.error && (
                <ChartCard title="Pairwise Scatter Matrix" spec={visualizations.scatter_matrix} />
              )}
              {visualizations.missing_data_matrix && !visualizations.missing_data_matrix.error && (
                <ChartCard title="Missing Data Matrix" spec={visualizations.missing_data_matrix} />
              )}
              {[
                "quality_radar", "trend", "pareto", "top_n", "waterfall",
                "correlation_heatmap", "scatter_matrix", "missing_data_matrix",
              ].every((key) => !visualizations[key] || visualizations[key].error) && (
                <div style={{ textAlign: "center", padding: "60px 0" }}>
                  <p style={{ fontSize: 13, color: "#9a9690" }}>No overview charts available for this dataset.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Numeric */}
      {activeTab === "numeric" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 12 }}>
          {numericColumns.length === 0 ? (
            <p style={{ fontSize: 13, color: "#9a9690" }}>No numeric columns in this dataset.</p>
          ) : numericColumns.map((col) => {
            const charts = columnCharts[col.name] ?? {};
            return (
              <div key={col.name} style={{
                background: "rgba(255,255,255,0.72)",
                border: "1px solid rgba(255,255,255,0.8)",
                borderRadius: 16,
                boxShadow: "0 2px 16px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)",
                overflow: "hidden",
              }}>
                <div style={{ padding: "12px 16px 0", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13, fontWeight: 500, color: "#111010", flex: 1 }}>
                    {col.name}
                  </span>
                  <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "rgba(144,96,248,0.1)", color: "#9060f8", fontFamily: "ui-monospace, Menlo, monospace" }}>
                    {col.dtype}
                  </span>
                </div>
                <div style={{ padding: "0 8px 8px" }}>
                  {charts.distribution && <PlotlyChart spec={charts.distribution} />}
                  {charts.box_plot && <PlotlyChart spec={charts.box_plot} height={180} />}
                  {charts.violin && <PlotlyChart spec={charts.violin} height={220} />}
                  {!charts.distribution && !charts.box_plot && !charts.violin && (
                    <p style={{ fontSize: 12, color: "#c0bdb8", padding: "20px 8px", textAlign: "center" }}>No charts generated</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Categorical */}
      {activeTab === "categorical" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 12 }}>
          {categoricalColumns.length === 0 ? (
            <p style={{ fontSize: 13, color: "#9a9690" }}>No categorical columns in this dataset.</p>
          ) : categoricalColumns.map((col) => {
            const charts = columnCharts[col.name] ?? {};
            return (
              <div key={col.name} style={{
                background: "rgba(255,255,255,0.72)",
                border: "1px solid rgba(255,255,255,0.8)",
                borderRadius: 16,
                boxShadow: "0 2px 16px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)",
                overflow: "hidden",
              }}>
                <div style={{ padding: "12px 16px 0", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13, fontWeight: 500, color: "#111010", flex: 1 }}>
                    {col.name}
                  </span>
                  <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 5, background: "rgba(232,64,200,0.1)", color: "#e840c8", fontFamily: "ui-monospace, Menlo, monospace" }}>
                    {col.dtype}
                  </span>
                </div>
                <div style={{ padding: "0 8px 8px" }}>
                  {charts.categorical_bar
                    ? <PlotlyChart spec={charts.categorical_bar} />
                    : <p style={{ fontSize: 12, color: "#c0bdb8", padding: "20px 8px", textAlign: "center" }}>No chart generated</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Builder */}
      {activeTab === "builder" && <ChartBuilder report={report} datasetId={datasetId} orgId={orgId} />}
    </div>
  );
}
