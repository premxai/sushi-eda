"use client";

import * as React from "react";
import { Image, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import html2canvas from "html2canvas";

interface ChartExportProps {
  chartId: string;
  chartName: string;
  className?: string;
}

export function ChartExport({ chartId, chartName, className = "" }: ChartExportProps) {
  const [isExporting, setIsExporting] = React.useState(false);

  const exportAsPNG = async () => {
    setIsExporting(true);
    try {
      const element = document.getElementById(chartId);
      if (!element) {
        console.error(`Element with id ${chartId} not found`);
        return;
      }

      const canvas = await html2canvas(element, {
        backgroundColor: "#ffffff",
        scale: 2,
        logging: false,
      });

      const link = document.createElement("a");
      link.download = `${chartName}-${new Date().getTime()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("Error exporting chart:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const exportAsSVG = async () => {
    setIsExporting(true);
    try {
      const element = document.getElementById(chartId);
      if (!element) {
        console.error(`Element with id ${chartId} not found`);
        return;
      }

      // Get Plotly chart if it exists
      const plotlyDiv = element.querySelector(".plotly");
      if (plotlyDiv && typeof window !== 'undefined' && 'Plotly' in window) {
        const windowWithPlotly = window as unknown as { Plotly?: { downloadImage?: (div: Element, config: { format: string; filename: string }) => Promise<void> } };
        if (windowWithPlotly.Plotly?.downloadImage) {
          await windowWithPlotly.Plotly.downloadImage(plotlyDiv, {
            format: "svg",
            filename: `${chartName}-${new Date().getTime()}`,
          });
        }
      } else {
        // Fallback to PNG if not a Plotly chart
        await exportAsPNG();
      }
    } catch (error) {
      console.error("Error exporting chart as SVG:", error);
      // Fallback to PNG
      await exportAsPNG();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={exportAsPNG}
        disabled={isExporting}
        className="h-8 gap-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label={`Export ${chartName} as PNG`}
      >
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image className="h-3.5 w-3.5" aria-hidden="true" />
        PNG
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={exportAsSVG}
        disabled={isExporting}
        className="h-8 gap-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
        aria-label={`Export ${chartName} as SVG`}
      >
        <FileCode className="h-3.5 w-3.5" />
        SVG
      </Button>
    </div>
  );
}
