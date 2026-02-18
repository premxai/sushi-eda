"use client";

import { FileSpreadsheet, BarChart3, TrendingUp, Download, GitCompare, Sparkles } from "lucide-react";

const features = [
  {
    icon: FileSpreadsheet,
    title: "Multiple Formats",
    description: "CSV, TSV, Excel, JSON, Parquet, and SQLite databases. All your data, one platform.",
  },
  {
    icon: BarChart3,
    title: "Rich Visualizations",
    description: "Interactive charts with hover insights. Distributions, correlations, box plots, and more.",
  },
  {
    icon: TrendingUp,
    title: "Advanced Statistics",
    description: "Hypothesis testing, linear regression, ANOVA, and normality tests built-in.",
  },
  {
    icon: Download,
    title: "Export Everything",
    description: "Download your analysis as PDF reports or export processed data to Excel.",
  },
  {
    icon: GitCompare,
    title: "Dataset Comparison",
    description: "Compare two datasets side-by-side to identify differences and similarities.",
  },
  {
    icon: Sparkles,
    title: "Smart Insights",
    description: "Automatic outlier detection, quality scoring, and type suggestions.",
  },
];

export function FeaturesSection() {
  return (
    <section className="py-24 bg-white">
      <div className="container-apple">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold tracking-tight text-neutral-900 mb-4">
            Everything you need for EDA
          </h2>
          <p className="text-xl text-neutral-500 max-w-2xl mx-auto">
            Professional-grade exploratory data analysis tools, beautifully designed and blazingly fast.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={index}
                className="group relative rounded-2xl border border-neutral-200 bg-white p-8 transition-all hover:shadow-lg hover:border-neutral-300"
              >
                <div className="mb-4 inline-flex rounded-xl bg-indigo-50 p-3 text-indigo-600 transition-colors group-hover:bg-indigo-100">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-neutral-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
