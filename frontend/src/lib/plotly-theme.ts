import type { Layout, Config } from "plotly.js";

export const plotlyConfig: Partial<Config> = {
  displayModeBar: "hover",
  responsive: true,
  displaylogo: false,
  modeBarButtonsToRemove: ["pan2d", "select2d", "lasso2d", "autoScale2d"],
};

export const plotlyLayout: Partial<Layout> = {
  font: { family: "var(--font-sans), sans-serif", size: 12, color: "#1b1a17" },
  paper_bgcolor: "transparent",
  plot_bgcolor: "transparent",
  margin: { t: 24, r: 20, b: 40, l: 56 },
  hovermode: "closest",
};

/** The one shared categorical color sequence — brand terracotta first,
 * then a small set of clearly distinct, muted hues. Red/green are placed
 * last since they carry "good/bad" meaning elsewhere in the product and
 * should not be the default color for unrelated categories. */
export const plotlyColorway = ["#a8552e", "#5b7fa6", "#8a7ca8", "#c99a4a", "#4b7a52", "#b23a2e"];

export const plotlyDivergingScale: [number, string][] = [
  [0, "#5b7fa6"],
  [0.5, "#faf8f4"],
  [1, "#a8552e"],
];
