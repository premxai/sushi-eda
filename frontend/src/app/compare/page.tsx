"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { FileUpload } from "@/components/FileUpload";
import { OverviewSection } from "@/components/dashboard/OverviewSection";
import { Button } from "@/components/ui/button";
import {
  DatasetComparisonResult,
  compareDatasets,
  getApiErrorMessage,
} from "@/lib/api";

function formatFileLabel(file: File) {
  return `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
}

function sortColumns(columns: string[]) {
  return [...columns].sort((a, b) => a.localeCompare(b));
}

export default function ComparePage() {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [result, setResult] = useState<DatasetComparisonResult | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCompare = async () => {
    if (!file1 || !file2) return;
    setIsComparing(true);
    setError(null);

    try {
      const data = await compareDatasets(file1, file2);
      setResult({
        ...data,
        comparison: {
          ...data.comparison,
          schema_diff: {
            file1_only: sortColumns(data.comparison.schema_diff.file1_only),
            file2_only: sortColumns(data.comparison.schema_diff.file2_only),
            common: sortColumns(data.comparison.schema_diff.common),
          },
        },
      });
    } catch (err) {
      setError(getApiErrorMessage(err, "Failed to compare datasets"));
    } finally {
      setIsComparing(false);
    }
  };

  const handleReset = () => {
    setFile1(null);
    setFile2(null);
    setResult(null);
    setError(null);
  };

  if (result) {
    const { file1: left, file2: right, comparison } = result;

    return (
      <div className="min-h-screen bg-paper p-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <Link
                href="/datasets"
                className="mb-2 inline-flex items-center gap-2 text-sm text-muted-ink hover:text-ink"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to datasets
              </Link>
              <h1 className="font-display text-2xl tracking-tight text-ink">
                Dataset Comparison
              </h1>
              <p className="mt-1 text-sm text-muted-ink">
                Compare structure, row counts, and quality at a glance.
              </p>
            </div>
            <Button onClick={handleReset} variant="outline">
              New Comparison
            </Button>
          </div>

          <div className="mb-6 rounded-card border border-line bg-surface p-6 shadow-soft-sm">
            <h2 className="text-lg font-semibold text-ink">
              Comparison Summary
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-card bg-surface-2 p-3">
                <p className="text-xs text-faint-ink">Row Difference</p>
                <p className="mt-1 text-xl font-semibold text-ink">
                  {comparison.row_count_diff > 0 ? "+" : ""}
                  {comparison.row_count_diff.toLocaleString()}
                </p>
              </div>
              <div className="rounded-card bg-surface-2 p-3">
                <p className="text-xs text-faint-ink">Column Difference</p>
                <p className="mt-1 text-xl font-semibold text-ink">
                  {comparison.column_count_diff > 0 ? "+" : ""}
                  {comparison.column_count_diff.toLocaleString()}
                </p>
              </div>
              <div className="rounded-card bg-surface-2 p-3">
                <p className="text-xs text-faint-ink">Common Columns</p>
                <p className="mt-1 text-xl font-semibold text-ink">
                  {comparison.schema_diff.common.length.toLocaleString()}
                </p>
              </div>
            </div>

            {(comparison.schema_diff.file1_only.length > 0 ||
              comparison.schema_diff.file2_only.length > 0) && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-card bg-danger/10 p-3">
                  <p className="text-xs font-medium text-danger">
                    Only in {left.name}
                  </p>
                  <p className="mt-1 text-xs text-danger/80">
                    {comparison.schema_diff.file1_only.length > 0
                      ? comparison.schema_diff.file1_only.join(", ")
                      : "No exclusive columns"}
                  </p>
                </div>
                <div className="rounded-card bg-brand-weak p-3">
                  <p className="text-xs font-medium text-brand">
                    Only in {right.name}
                  </p>
                  <p className="mt-1 text-xs text-brand/80">
                    {comparison.schema_diff.file2_only.length > 0
                      ? comparison.schema_diff.file2_only.join(", ")
                      : "No exclusive columns"}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-muted-ink">
                {left.name}
              </h3>
              <OverviewSection
                info={left.report.basic_info}
                qualityScore={left.report.quality_score}
              />
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold text-muted-ink">
                {right.name}
              </h3>
              <OverviewSection
                info={right.report.basic_info}
                qualityScore={right.report.quality_score}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper p-6">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8 text-center">
          <Link
            href="/datasets"
            className="mb-4 inline-flex items-center gap-2 text-sm text-muted-ink hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to datasets
          </Link>
          <h1 className="font-display text-3xl tracking-tight text-ink">
            Compare Datasets
          </h1>
          <p className="mt-2 text-muted-ink">
            Upload two files to compare schema differences, row counts, and
            quality summaries.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-muted-ink">File 1</h3>
            <FileUpload
              onFileAccepted={(file) => {
                setFile1(file);
                setError(null);
              }}
              isUploading={false}
              uploadProgress={0}
              error={null}
              onClearError={() => setError(null)}
              savesData={false}
            />
            {file1 && (
              <p className="mt-2 text-xs text-muted-ink">
                Selected: {formatFileLabel(file1)}
              </p>
            )}
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-muted-ink">File 2</h3>
            <FileUpload
              onFileAccepted={(file) => {
                setFile2(file);
                setError(null);
              }}
              isUploading={false}
              uploadProgress={0}
              error={null}
              onClearError={() => setError(null)}
              savesData={false}
            />
            {file2 && (
              <p className="mt-2 text-xs text-muted-ink">
                Selected: {formatFileLabel(file2)}
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-card border border-danger/25 bg-danger/10 p-3 text-sm text-danger">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <Button
            onClick={handleCompare}
            disabled={!file1 || !file2 || isComparing}
            size="lg"
            className="gap-2 bg-[linear-gradient(135deg,var(--salmon),var(--tuna))] text-white hover:opacity-90"
          >
            {isComparing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Comparing...
              </>
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
