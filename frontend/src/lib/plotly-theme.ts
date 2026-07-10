import type { Layout, Config } from "plotly.js";

export const plotlyConfig: Partial<Config> = {
  displayModeBar: "hover",
  responsive: true,
  displaylogo: false,
  modeBarButtonsToRemove: ["pan2d", "select2d", "lasso2d", "autoScale2d"],
};

export const plotlyLayout: Partial<Layout> = {
  font: { family: "var(--font-sans), sans-serif", size: 12, color: "#11181c" },
  paper_bgcolor: "transparent",
  plot_bgcolor: "transparent",
  margin: { t: 24, r: 20, b: 40, l: 56 },
  hovermode: "closest",
};

/** The one shared categorical color sequence: coral brand first, then a
 * small set of warm, clearly distinct hues (matcha, gold, wasabi). Coral
 * and matcha lead since they are the brand's core pairing; deeper coral
 * sits last so it does not read as a data-quality "bad" signal by default. */
export const plotlyColorway = ["#d86645", "#5f7e4b", "#d6a85e", "#a9bd79", "#8a7ca8", "#b94f36"];

export const plotlyDivergingScale: [number, string][] = [
  [0, "#5f7e4b"],
  [0.5, "#fbf4e8"],
  [1, "#d86645"],
];
