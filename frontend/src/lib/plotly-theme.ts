import type { Layout, Config } from "plotly.js";

export const plotlyConfig: Partial<Config> = {
  displayModeBar: "hover",
  responsive: true,
  displaylogo: false,
  modeBarButtonsToRemove: ["pan2d", "select2d", "lasso2d", "autoScale2d"],
};

export const plotlyLayout: Partial<Layout> = {
  font: { family: "var(--font-sans), sans-serif", size: 12, color: "#17171a" },
  paper_bgcolor: "transparent",
  plot_bgcolor: "transparent",
  margin: { t: 24, r: 20, b: 40, l: 56 },
  hovermode: "closest",
};

/** The one shared categorical color sequence: brand salmon first, then a
 * small set of clearly distinct, muted hues. Wasabi green and tuna red
 * are placed last since they carry "good/bad" meaning elsewhere in the
 * product and should not be the default color for unrelated categories. */
export const plotlyColorway = ["#c15b3f", "#5b7fa6", "#7c6a8a", "#c08a28", "#6b8a3e", "#b33a2c"];

export const plotlyDivergingScale: [number, string][] = [
  [0, "#5b7fa6"],
  [0.5, "#fafafa"],
  [1, "#c15b3f"],
];
