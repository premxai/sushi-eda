import {
  fetchBusinessChart,
  fetchColumnVisualization,
  fetchDatasetVisualizations,
  fetchQualityRadar,
  fetchScatterMatrix,
  fetchTrendChart,
} from "@/lib/api";
import { PlotlySpec } from "@/components/common/PlotlyChart";

export type ChartFieldKind = "column" | "select" | "number";
export type ChartColumnFilter = "numeric" | "categorical" | "any";

export interface ChartField {
  key: string;
  label: string;
  kind: ChartFieldKind;
  filter?: ChartColumnFilter;
  /** Adds a "(count of rows)" option that resolves to an empty value. */
  optional?: boolean;
  options?: { label: string; value: string }[];
  defaultValue?: number | string;
  min?: number;
  max?: number;
  step?: number;
  advanced?: boolean;
}

export interface ChartSpec {
  key: string;
  label: string;
  description: string;
  fields: ChartField[];
  run: (datasetId: string, values: Record<string, string>) => Promise<PlotlySpec>;
}

const AGG_OPTIONS = [
  { label: "Sum", value: "sum" },
  { label: "Average", value: "mean" },
  { label: "Count", value: "count" },
  { label: "Max", value: "max" },
  { label: "Min", value: "min" },
  { label: "Median", value: "median" },
];

export const CHART_REGISTRY: ChartSpec[] = [
  {
    key: "distribution",
    label: "Distribution",
    description: "Shows how the values in a numeric column are spread out.",
    fields: [{ key: "column", label: "Column", kind: "column", filter: "numeric" }],
    run: (id, v) => fetchColumnVisualization(id, v.column, "distribution"),
  },
  {
    key: "box_plot",
    label: "Box plot",
    description: "Shows the typical range for a numeric column and flags unusual values.",
    fields: [{ key: "column", label: "Column", kind: "column", filter: "numeric" }],
    run: (id, v) => fetchColumnVisualization(id, v.column, "box_plot"),
  },
  {
    key: "violin",
    label: "Violin plot",
    description: "A more detailed view of a numeric column's distribution shape.",
    fields: [{ key: "column", label: "Column", kind: "column", filter: "numeric" }],
    run: (id, v) => fetchColumnVisualization(id, v.column, "violin"),
  },
  {
    key: "categorical_bar",
    label: "Category breakdown",
    description: "The most common values in a text or category column.",
    fields: [{ key: "column", label: "Column", kind: "column", filter: "categorical" }],
    run: (id, v) => fetchColumnVisualization(id, v.column, "categorical_bar"),
  },
  {
    key: "pareto",
    label: "Pareto (80/20)",
    description: "Which categories drive most of the total — sorted bars plus a cumulative-percent line.",
    fields: [
      { key: "category", label: "Group by", kind: "column", filter: "categorical" },
      { key: "value", label: "Measure", kind: "column", filter: "numeric", optional: true },
      { key: "top_n", label: "Show top", kind: "number", defaultValue: 15, min: 3, max: 50, step: 1, advanced: true },
    ],
    run: (id, v) => fetchBusinessChart(id, "pareto", v.category, v.value || undefined, undefined, Number(v.top_n) || 15),
  },
  {
    key: "top_n",
    label: "Top N ranking",
    description: "Ranks categories by an aggregated measure, highest (or lowest) first.",
    fields: [
      { key: "category", label: "Group by", kind: "column", filter: "categorical" },
      { key: "value", label: "Measure", kind: "column", filter: "numeric", optional: true },
      { key: "agg", label: "Aggregate", kind: "select", options: AGG_OPTIONS, defaultValue: "sum", advanced: true },
      { key: "top_n", label: "Show top", kind: "number", defaultValue: 10, min: 3, max: 50, step: 1, advanced: true },
      {
        key: "ascending",
        label: "Direction",
        kind: "select",
        options: [
          { label: "Highest first", value: "false" },
          { label: "Lowest first", value: "true" },
        ],
        defaultValue: "false",
        advanced: true,
      },
    ],
    run: (id, v) =>
      fetchBusinessChart(id, "top_n", v.category, v.value || undefined, v.agg || "sum", Number(v.top_n) || 10, v.ascending === "true"),
  },
  {
    key: "waterfall",
    label: "Contribution (waterfall)",
    description: "How each category adds to or subtracts from the grand total.",
    fields: [
      { key: "category", label: "Group by", kind: "column", filter: "categorical" },
      { key: "value", label: "Measure", kind: "column", filter: "numeric" },
      { key: "top_n", label: "Show top", kind: "number", defaultValue: 12, min: 3, max: 30, step: 1, advanced: true },
    ],
    run: (id, v) => fetchBusinessChart(id, "waterfall", v.category, v.value, undefined, Number(v.top_n) || 12),
  },
  {
    key: "trend",
    label: "Trend over time",
    description: "How a value has changed over time, aggregated automatically by day, week, month, or year.",
    fields: [
      { key: "date", label: "Date column", kind: "column", filter: "any" },
      { key: "value", label: "Measure", kind: "column", filter: "numeric", optional: true },
      { key: "agg", label: "Aggregate", kind: "select", options: AGG_OPTIONS, defaultValue: "sum", advanced: true },
    ],
    run: (id, v) => fetchTrendChart(id, v.date, v.value || undefined, (v.agg as "sum" | "mean" | "count" | "max" | "min" | "median") || "sum"),
  },
  {
    key: "correlation_heatmap",
    label: "Correlation heatmap",
    description: "How strongly every pair of numeric columns moves together.",
    fields: [],
    run: async (id) => (await fetchDatasetVisualizations(id)).correlation_heatmap ?? { error: "Chart unavailable" },
  },
  {
    key: "missing_data_matrix",
    label: "Missing data map",
    description: "Where missing values cluster across rows and columns.",
    fields: [],
    run: async (id) => (await fetchDatasetVisualizations(id)).missing_data_matrix ?? { error: "Chart unavailable" },
  },
  {
    key: "scatter_matrix",
    label: "Pairwise scatter matrix",
    description: "Scatter plots for every pair among the most variable numeric columns.",
    fields: [],
    run: (id) => fetchScatterMatrix(id),
  },
  {
    key: "quality_radar",
    label: "Quality radar",
    description: "The 5 quality-score dimensions plotted together.",
    fields: [],
    run: (id) => fetchQualityRadar(id),
  },
];

export function getChartColumnOptions(columns: { name: string; is_numeric: boolean }[], filter: ChartColumnFilter | undefined) {
  if (filter === "numeric") return columns.filter((c) => c.is_numeric).map((c) => ({ label: c.name, value: c.name }));
  if (filter === "categorical") return columns.filter((c) => !c.is_numeric).map((c) => ({ label: c.name, value: c.name }));
  return columns.map((c) => ({ label: c.name, value: c.name }));
}
