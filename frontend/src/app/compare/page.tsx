"use client";

import React, { useState } from "react";
import { FileUpload } from "@/components/FileUpload";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { EDAReport } from "@/lib/types";
import { OverviewSection } from "@/components/dashboard/OverviewSection";
import Link from "next/link";

export default function ComparePage() {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [report1, setReport1] = useState<EDAReport | null>(null);
  const [report2, setReport2] = useState<EDAReport | null>(null);
  const [comparison, setComparison] = useState<{
    schema_diff: { file1_only: string[]; file2_only: string[]; common: string[] };
    row_count_diff: number;
    column_count_diff: number;
  } | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile1 = async (file: File) => {
    setFile1(file);
    setError(null);
  };

  const handleFile2 = async (file: File) => {
    setFile2(file);
    setError(null);
  };

  const handleCompare = async () => {
    if (!file1 || !file2) return;

    setIsComparing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file1", file1);
      formData.append("file2", file2);

      const response = await fetch("http://localhost:8000/compare", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setReport1(data.file1.report);
      setReport2(data.file2.report);
      setComparison(data.comparison);
    } catch (err) {
      setError((err as Error).message || "Failed to compare datasets");
    } finally {
      setIsComparing(false);
    }
  };

  const handleReset = () => {
    setFile1(null);
    setFile2(null);
    setReport1(null);
    setReport2(null);
    setComparison(null);
    setError(null);
  };

  if (report1 && report2 && comparison) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <Link href="/dashboard" className="mb-2 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-slate-900">Dataset Comparison</h1>
            </div>
            <Button onClick={handleReset} variant="outline">
              New Comparison
            </Button>
          </div>

          {/* Comparison Summary */}
          <div className="mb-6 rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-900">Comparison Summary</h2>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Row Difference</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {comparison.row_count_diff > 0 ? "+" : ""}
                  {comparison.row_count_diff.toLocaleString()}
                </p>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Column Difference</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {comparison.column_count_diff > 0 ? "+" : ""}
                  {comparison.column_count_diff.toLocaleString()}
                </p>
              </div>
              <div className="rounded-md bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Common Columns</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {comparison.schema_diff.common.length}
                </p>
              </div>
            </div>

            {/* Schema Differences */}
            {(comparison.schema_diff.file1_only.length > 0 || comparison.schema_diff.file2_only.length > 0) && (
              <div className="mt-4 space-y-2">
                {comparison.schema_diff.file1_only.length > 0 && (
                  <div className="rounded-md bg-rose-50 p-3">
                    <p className="text-xs font-medium text-rose-700">Only in File 1:</p>
                    <p className="mt-1 text-xs text-rose-600">
                      {comparison.schema_diff.file1_only.join(", ")}
                    </p>
                  </div>
                )}
                {comparison.schema_diff.file2_only.length > 0 && (
                  <div className="rounded-md bg-indigo-50 p-3">
                    <p className="text-xs font-medium text-indigo-700">Only in File 2:</p>
                    <p className="mt-1 text-xs text-indigo-600">
                      {comparison.schema_diff.file2_only.join(", ")}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Side-by-Side Reports */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">File 1</h3>
              <OverviewSection info={report1.basic_info} qualityScore={report1.quality_score} />
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">File 2</h3>
              <OverviewSection info={report2.basic_info} qualityScore={report2.quality_score} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-4xl">
        <div className="mb-8 text-center">
          <Link href="/dashboard" className="mb-4 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">Compare Datasets</h1>
          <p className="mt-2 text-slate-600">Upload two datasets to see a side-by-side comparison</p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-700">File 1</h3>
            <FileUpload
              onFileAccepted={handleFile1}
              isUploading={false}
              uploadProgress={0}
              error={null}
              onClearError={() => setError(null)}
            />
            {file1 && (
              <p className="mt-2 text-xs text-slate-600">
                Selected: {file1.name} ({(file1.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-slate-700">File 2</h3>
            <FileUpload
              onFileAccepted={handleFile2}
              isUploading={false}
              uploadProgress={0}
              error={null}
              onClearError={() => setError(null)}
            />
            {file2 && (
              <p className="mt-2 text-xs text-slate-600">
                Selected: {file2.name} ({(file2.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <Button
            onClick={handleCompare}
            disabled={!file1 || !file2 || isComparing}
            size="lg"
            className="gap-2"
          >
            {isComparing ? (
              "Comparing..."
            ) : (
              <>
                Compare Datasets
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
