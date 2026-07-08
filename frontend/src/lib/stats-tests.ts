/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  runABTestSignificance,
  runANOVA,
  runArimaForecast,
  runChiSquare,
  runCohortAnalysis,
  runCorrelation,
  runLogisticRegression,
  runMannWhitney,
  runPolynomialRegression,
  runRegression,
  runTTest,
  runTimeSeriesDecomposition,
} from "@/lib/api";
import { formatNumber, formatPercent } from "@/lib/formatters";

export type FieldKind = "column" | "number" | "select";
export type ColumnFilter = "numeric" | "categorical" | "any";

export interface TestField {
  key: string;
  label: string;
  kind: FieldKind;
  filter?: ColumnFilter;
  options?: { label: string; value: string }[];
  defaultValue?: number | string;
  min?: number;
  max?: number;
  step?: number;
  advanced?: boolean;
}

export interface TestSpec {
  key: string;
  label: string;
  description: string;
  fields: TestField[];
  run: (datasetId: string, values: Record<string, string>) => Promise<any>;
  interpret: (result: any) => string;
}

function verdict(significant: boolean, yes: string, no: string): string {
  return significant ? yes : no;
}

export const TEST_REGISTRY: TestSpec[] = [
  {
    key: "ttest",
    label: "T-test",
    description: "Compares the averages of two numeric columns.",
    fields: [
      { key: "col1", label: "Column A", kind: "column", filter: "numeric" },
      { key: "col2", label: "Column B", kind: "column", filter: "numeric" },
    ],
    run: (id, v) => runTTest(id, v.col1, v.col2),
    interpret: (r) =>
      verdict(
        r.significant,
        `These two groups look meaningfully different (averages of ${formatNumber(r.mean1, 2)} vs ${formatNumber(r.mean2, 2)}). The gap is unlikely to be random, but check the sample sizes before presenting it.`,
        `These two groups don't look meaningfully different. The gap between their averages (${formatNumber(r.mean1, 2)} vs ${formatNumber(r.mean2, 2)}) could just be random variation.`,
      ),
  },
  {
    key: "mann_whitney",
    label: "Mann-Whitney U",
    description: "A non-parametric alternative to the t-test that compares two numeric columns without assuming a normal distribution.",
    fields: [
      { key: "col1", label: "Column A", kind: "column", filter: "numeric" },
      { key: "col2", label: "Column B", kind: "column", filter: "numeric" },
      {
        key: "alternative",
        label: "Direction",
        kind: "select",
        options: [
          { label: "Two-sided", value: "two-sided" },
          { label: "A is less than B", value: "less" },
          { label: "A is greater than B", value: "greater" },
        ],
        defaultValue: "two-sided",
        advanced: true,
      },
    ],
    run: (id, v) => runMannWhitney(id, v.col1, v.col2, (v.alternative as any) || "two-sided"),
    interpret: (r) =>
      verdict(
        r.significant,
        `The typical values (medians ${formatNumber(r.median1, 2)} vs ${formatNumber(r.median2, 2)}) are meaningfully different between these two groups.`,
        `These two groups look similar. No meaningful difference in typical values detected.`,
      ),
  },
  {
    key: "chi_square",
    label: "Chi-square",
    description: "Tests whether two categorical columns are related, or independent of each other.",
    fields: [
      { key: "col1", label: "Column A", kind: "column", filter: "categorical" },
      { key: "col2", label: "Column B", kind: "column", filter: "categorical" },
    ],
    run: (id, v) => runChiSquare(id, v.col1, v.col2),
    interpret: (r) =>
      verdict(
        r.significant,
        `There's a real relationship between these two columns. They don't look independent.`,
        `These two columns look independent. No meaningful relationship detected between them.`,
      ),
  },
  {
    key: "anova",
    label: "ANOVA",
    description: "Checks whether a numeric column differs meaningfully across groups defined by a categorical column.",
    fields: [
      { key: "numeric_col", label: "Numeric column", kind: "column", filter: "numeric" },
      { key: "group_col", label: "Group by", kind: "column", filter: "categorical" },
    ],
    run: (id, v) => runANOVA(id, v.numeric_col, v.group_col),
    interpret: (r) =>
      verdict(
        r.significant,
        `At least one of the ${r.n_groups} groups is meaningfully different from the others.`,
        `The ${r.n_groups} groups look similar. No meaningful difference detected between them.`,
      ),
  },
  {
    key: "correlation",
    label: "Correlation",
    description: "Measures how strongly two numeric columns move together.",
    fields: [
      { key: "col1", label: "Column A", kind: "column", filter: "numeric" },
      { key: "col2", label: "Column B", kind: "column", filter: "numeric" },
      {
        key: "method",
        label: "Method",
        kind: "select",
        options: [
          { label: "Pearson (linear)", value: "pearson" },
          { label: "Spearman (rank)", value: "spearman" },
          { label: "Kendall (ordinal)", value: "kendall" },
        ],
        defaultValue: "pearson",
        advanced: true,
      },
    ],
    run: (id, v) => runCorrelation(id, v.col1, v.col2, v.method || "pearson"),
    interpret: (r) => {
      const abs = Math.abs(r.coefficient);
      const strength = abs >= 0.8 ? "very strongly" : abs >= 0.6 ? "strongly" : abs >= 0.4 ? "moderately" : abs >= 0.2 ? "weakly" : "barely";
      const direction = r.coefficient >= 0 ? "move together" : "move in opposite directions";
      return `These columns ${direction} ${strength} (r = ${formatNumber(r.coefficient, 3)}).${r.significant ? "" : " This relationship isn't statistically significant, though, so treat it as a hint, not a conclusion."}`;
    },
  },
  {
    key: "regression",
    label: "Linear regression",
    description: "Fits a straight line predicting one numeric column from another.",
    fields: [
      { key: "x_col", label: "Predictor (X)", kind: "column", filter: "numeric" },
      { key: "y_col", label: "Outcome (Y)", kind: "column", filter: "numeric" },
    ],
    run: (id, v) => runRegression(id, v.x_col, v.y_col),
    interpret: (r) =>
      `For every 1-unit increase in the predictor, the outcome changes by about ${formatNumber(r.slope, 3)}. This relationship explains ${formatPercent((r.r_squared ?? 0) * 100, 0)} of the variation, ${
        r.r_squared > 0.6 ? "a fairly strong fit." : r.r_squared > 0.3 ? "a moderate fit." : "a weak fit, so predictions from it should be treated with caution."
      }`,
  },
  {
    key: "logistic",
    label: "Logistic regression",
    description: "Predicts a yes/no (binary) outcome from a numeric column.",
    fields: [
      { key: "x_col", label: "Predictor (X)", kind: "column", filter: "numeric" },
      { key: "y_col", label: "Outcome (binary)", kind: "column", filter: "categorical" },
    ],
    run: (id, v) => runLogisticRegression(id, v.x_col, v.y_col),
    interpret: (r) => `This model correctly classifies ${formatPercent((r.accuracy ?? 0) * 100, 0)} of cases (precision ${formatPercent((r.precision ?? 0) * 100, 0)}, recall ${formatPercent((r.recall ?? 0) * 100, 0)}).`,
  },
  {
    key: "polynomial",
    label: "Polynomial regression",
    description: "Fits a curve (instead of a straight line) between two numeric columns.",
    fields: [
      { key: "x_col", label: "Predictor (X)", kind: "column", filter: "numeric" },
      { key: "y_col", label: "Outcome (Y)", kind: "column", filter: "numeric" },
      { key: "degree", label: "Curve degree", kind: "number", defaultValue: 2, min: 2, max: 6, step: 1, advanced: true },
    ],
    run: (id, v) => runPolynomialRegression(id, v.x_col, v.y_col, Number(v.degree) || 2),
    interpret: (r) => `This curve explains ${formatPercent((r.r_squared ?? 0) * 100, 0)} of the variation in the outcome.`,
  },
  {
    key: "decompose",
    label: "Time-series decomposition",
    description: "Splits a trend over time into its trend, seasonal, and leftover (residual) parts.",
    fields: [
      { key: "date_col", label: "Date column", kind: "column", filter: "any" },
      { key: "value_col", label: "Value column", kind: "column", filter: "numeric" },
    ],
    run: (id, v) => runTimeSeriesDecomposition(id, v.date_col, v.value_col),
    interpret: (r) => `Split into trend, seasonal, and residual components across ${formatNumber(r.n_observations)} observations (period: ${r.period}).`,
  },
  {
    key: "arima",
    label: "ARIMA forecast",
    description: "Forecasts future values based on the historical pattern.",
    fields: [
      { key: "date_col", label: "Date column", kind: "column", filter: "any" },
      { key: "value_col", label: "Value column", kind: "column", filter: "numeric" },
      { key: "periods", label: "Periods to forecast", kind: "number", defaultValue: 12, min: 1, max: 120, step: 1 },
    ],
    run: (id, v) => runArimaForecast(id, v.date_col, v.value_col, { periods: Number(v.periods) || 12 }),
    interpret: (r) => `Forecasted ${r.periods} periods ahead from ${formatNumber(r.n_observations)} historical points.`,
  },
  {
    key: "cohort",
    label: "Cohort analysis",
    description: "Tracks how a group (e.g. customers) sticks around over time, by when they first appeared.",
    fields: [
      { key: "entity_col", label: "Entity column", kind: "column", filter: "categorical" },
      { key: "date_col", label: "Date column", kind: "column", filter: "any" },
      {
        key: "freq",
        label: "Period",
        kind: "select",
        options: [
          { label: "Day", value: "D" },
          { label: "Week", value: "W" },
          { label: "Month", value: "M" },
          { label: "Quarter", value: "Q" },
        ],
        defaultValue: "M",
      },
    ],
    run: (id, v) => runCohortAnalysis(id, v.entity_col, v.date_col, (v.freq as any) || "M"),
    interpret: (r) => `Built a retention grid across ${r.n_cohorts} cohorts.`,
  },
  {
    key: "ab_test",
    label: "A/B test significance",
    description: "Tells you whether a difference in conversion rate between two variants is real or just noise.",
    fields: [
      { key: "control_conversions", label: "Control conversions", kind: "number", defaultValue: 0, min: 0 },
      { key: "control_total", label: "Control total", kind: "number", defaultValue: 1, min: 1 },
      { key: "variant_conversions", label: "Variant conversions", kind: "number", defaultValue: 0, min: 0 },
      { key: "variant_total", label: "Variant total", kind: "number", defaultValue: 1, min: 1 },
    ],
    run: (id, v) => runABTestSignificance(id, Number(v.control_conversions), Number(v.control_total), Number(v.variant_conversions), Number(v.variant_total)),
    interpret: (r) => {
      if (r.winner === "tie" || r.winner === "inconclusive") {
        return "This difference is not statistically significant yet. It could just be noise. Consider running the test longer or with more traffic.";
      }
      return `The ${r.winner} variant performed better, a ${formatPercent(Math.abs(r.lift_relative_percent ?? 0), 1)} relative lift. This result looks statistically real, not just noise.`;
    },
  },
];

export function getColumnOptions(columns: { name: string; is_numeric: boolean }[], filter: ColumnFilter | undefined) {
  if (filter === "numeric") return columns.filter((c) => c.is_numeric).map((c) => ({ label: c.name, value: c.name }));
  if (filter === "categorical") return columns.filter((c) => !c.is_numeric).map((c) => ({ label: c.name, value: c.name }));
  return columns.map((c) => ({ label: c.name, value: c.name }));
}
