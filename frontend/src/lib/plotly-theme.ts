import type { Layout, Config } from "plotly.js";

export const plotlyConfig: Partial<Config> = {
  displayModeBar: 'hover',
  responsive: true,
  displaylogo: false,
  modeBarButtonsToRemove: ['pan2d', 'select2d', 'lasso2d', 'autoScale2d'],
};

export const plotlyLayout: Partial<Layout> = {
  font: { family: "Inter, sans-serif", size: 12, color: "#334155" },
  paper_bgcolor: "transparent",
  plot_bgcolor: "transparent",
  margin: { t: 30, r: 20, b: 40, l: 60 },
  hovermode: "closest",
};
