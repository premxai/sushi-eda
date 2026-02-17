"use client";

import * as React from "react";
import { X, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import dynamic from "next/dynamic";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface ColumnComparisonProps {
  column1: string;
  column2: string;
  data: Record<string, unknown>[];
  onClose: () => void;
}

export function ColumnComparison({ column1, column2, data, onClose }: ColumnComparisonProps) {
  const col1Data = data.map((row) => row[column1]).filter((v) => v != null);
  const col2Data = data.map((row) => row[column2]).filter((v) => v != null);

  // Calculate correlation if both are numeric
  const isNumeric1 = col1Data.every((v) => !isNaN(Number(v)));
  const isNumeric2 = col2Data.every((v) => !isNaN(Number(v)));

  let correlation = null;
  if (isNumeric1 && isNumeric2) {
    const n = Math.min(col1Data.length, col2Data.length);
    const mean1 = col1Data.map(Number).reduce((a: number, b: number) => a + b, 0) / n;
    const mean2 = col2Data.map(Number).reduce((a: number, b: number) => a + b, 0) / n;
    
    let num = 0;
    let den1 = 0;
    let den2 = 0;
    
    for (let i = 0; i < n; i++) {
      const diff1 = Number(col1Data[i]) - mean1;
      const diff2 = Number(col2Data[i]) - mean2;
      num += diff1 * diff2;
      den1 += diff1 * diff1;
      den2 += diff2 * diff2;
    }
    
    correlation = num / Math.sqrt(den1 * den2);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto dark:bg-slate-900 dark:border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg dark:text-slate-100">
            <TrendingUp className="h-5 w-5 text-indigo-500" />
            Column Comparison: {column1} vs {column2}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
            aria-label="Close comparison"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {correlation !== null && (
            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Correlation Coefficient
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {correlation.toFixed(3)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {Math.abs(correlation) > 0.7
                  ? "Strong correlation"
                  : Math.abs(correlation) > 0.4
                  ? "Moderate correlation"
                  : "Weak correlation"}
              </p>
            </div>
          )}

          {isNumeric1 && isNumeric2 ? (
            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <Plot
                data={[
                  {
                    x: col1Data.map(Number),
                    y: col2Data.map(Number),
                    mode: "markers",
                    type: "scatter",
                    marker: {
                      color: "#6366f1",
                      size: 8,
                      opacity: 0.6,
                    },
                    name: "Data Points",
                  },
                ]}
                layout={{
                  title: { text: `${column1} vs ${column2}` },
                  xaxis: { title: { text: column1 } },
                  yaxis: { title: { text: column2 } },
                  autosize: true,
                  height: 400,
                  margin: { l: 60, r: 40, t: 60, b: 60 },
                  plot_bgcolor: "rgba(0,0,0,0)",
                  paper_bgcolor: "rgba(0,0,0,0)",
                }}
                config={{ responsive: true, displayModeBar: true }}
                className="w-full"
              />
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 p-8 text-center dark:border-slate-700">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Scatter plot is only available for numeric columns.
              </p>
              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                Selected columns: {column1} ({isNumeric1 ? "numeric" : "non-numeric"}), {column2} (
                {isNumeric2 ? "numeric" : "non-numeric"})
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
