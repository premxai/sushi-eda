/** Static, illustrative data for the decorative hero cards. These are
 * marketing mock values, never real analysis output. */
export const HERO_TABLE_ROWS = [
  { date: "2024-04-01", region: "North", product: "Widget A", sales: "$8,340.22", units: "230" },
  { date: "2024-04-01", region: "East", product: "Widget B", sales: "$5,532.83", units: "210" },
  { date: "2024-04-01", region: "South", product: "Widget C", sales: "$13,298.00", units: "310" },
  { date: "2024-04-02", region: "West", product: "Widget D", sales: "$7,214.45", units: "180" },
];

export const HERO_TABLE_COLUMNS = ["Date", "Region", "Product", "Sales", "Units"] as const;

export const HERO_STATS = [
  { label: "Total Revenue", value: "$2.48M", delta: "+18.6%" },
  { label: "Units Sold", value: "24,540", delta: "+12.1%" },
  { label: "Top Region", value: "East", delta: "+24.1%" },
];
