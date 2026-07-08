import type { Layout, Config } from "plotly.js";

export const plotlyConfig: Partial<Config> = {
  displayModeBar: 'hover',
  responsive: true,
  displaylogo: false,
  modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'autoScale2d'],
};

export const plotlyLayout: Partial<Layout> = {
  font: { family: "Inter, sans-serif", size: 12, color: "var(--ink)" },
  paper_bgcolor: "transparent",
  plot_bgcolor: "transparent",
  margin: { t: 30, r: 20, b: 40, l: 60 },
  hovermode: "closest",
};

/** The one shared categorical color sequence for charts across the app —
 * salmon/tuna/wasabi/amber/violet/teal, in that priority order. */
export const plotlyColorway = ["#F2704A", "#C23B2E", "#6E8F2E", "#B48A3C", "#6D5AE6", "#3C8FA0"];
