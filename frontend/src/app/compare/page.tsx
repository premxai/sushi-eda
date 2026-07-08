"use client";

import React, { useState } from "react";
import { GitCompareArrows, Loader2 } from "lucide-react";
import { compareDatasets, DatasetComparisonResult, getApiErrorMessage } from "@/lib/api";
import { qualityScoreSummary } from "@/lib/report-utils";
import { formatNumber, formatPercent } from "@/lib/formatters";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { PageHeader } from "@/components/common/PageHeader";
import { CompareDropzone } from "@/components/compare/CompareDropzone";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/common/Badge";

export default function ComparePage() {
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DatasetComparisonResult | null>(null);

  const handleCompare = async () => {
    if (!file1 || !file2) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await compareDatasets(file1, file2);
      setResult(res);
    } catch (err) {
      setError(getApiErrorMessage(err, "Couldn't compare these files — check they're both supported formats and try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper">
      <SiteHeader />
      <div className="container py-8">
        <PageHeader title="Compare" description="Upload two files to see what changed — schema, row counts, and column differences." />

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CompareDropzone label="File A" file={file1} onFileSelected={setFile1} disabled={loading} />
          <CompareDropzone label="File B" file={file2} onFileSelected={setFile2} disabled={loading} />
        </div>

        <div className="mt-4 flex justify-center">
          <Button onClick={handleCompare} disabled={!file1 || !file2 || loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GitCompareArrows className="h-3.5 w-3.5" />}
            Compare
          </Button>
        </div>

        {error && (
          <div className="mt-6">
            <Alert tone="danger">{error}</Alert>
          </div>
        )}

        {result && (
          <div className="mt-8 flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>What changed</CardTitle>
              </CardHeader>
              <div className="flex flex-col gap-2 text-[13.5px] text-ink-secondary">
                <p>
                  <span className="font-medium text-ink">{result.file1.name}</span> has{" "}
                  <span className="font-medium text-ink">{formatNumber(result.file1.report.basic_info.rows)}</span> rows and{" "}
                  <span className="font-medium text-ink">{formatNumber(result.file1.report.basic_info.columns)}</span> columns.{" "}
                  <span className="font-medium text-ink">{result.file2.name}</span> has{" "}
                  <span className="font-medium text-ink">{formatNumber(result.file2.report.basic_info.rows)}</span> rows and{" "}
                  <span className="font-medium text-ink">{formatNumber(result.file2.report.basic_info.columns)}</span> columns.
                </p>
                <p>
                  That&apos;s a difference of {formatNumber(Math.abs(result.comparison.row_count_diff))} row
                  {Math.abs(result.comparison.row_count_diff) === 1 ? "" : "s"} and {formatNumber(Math.abs(result.comparison.column_count_diff))} column
                  {Math.abs(result.comparison.column_count_diff) === 1 ? "" : "s"}.
                  {result.comparison.schema_diff.file1_only.length === 0 && result.comparison.schema_diff.file2_only.length === 0
                    ? " Both files share the exact same columns."
                    : " The column names don't fully match between the two files — see below."}
                </p>
              </div>
            </Card>

            {(result.comparison.schema_diff.file1_only.length > 0 || result.comparison.schema_diff.file2_only.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle>Schema differences</CardTitle>
                </CardHeader>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">Only in {result.file1.name}</p>
                    {result.comparison.schema_diff.file1_only.length === 0 ? (
                      <p className="text-[12.5px] text-ink-tertiary">None</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {result.comparison.schema_diff.file1_only.map((c) => (
                          <Badge key={c} tone="warning">
                            {c}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-tertiary">Only in {result.file2.name}</p>
                    {result.comparison.schema_diff.file2_only.length === 0 ? (
                      <p className="text-[12.5px] text-ink-tertiary">None</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {result.comparison.schema_diff.file2_only.map((c) => (
                          <Badge key={c} tone="warning">
                            {c}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SideBySideCard name={result.file1.name} report={result.file1.report} />
              <SideBySideCard name={result.file2.name} report={result.file2.report} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SideBySideCard({ name, report }: { name: string; report: DatasetComparisonResult["file1"]["report"] }) {
  const { score, grade, verdict } = qualityScoreSummary(report.quality_score);
  const missingPct = report.basic_info.rows > 0 && report.basic_info.columns > 0 ? (report.basic_info.total_missing / (report.basic_info.rows * report.basic_info.columns)) * 100 : 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="truncate">{name}</CardTitle>
      </CardHeader>
      <div className="flex flex-col gap-2 text-[13px] text-ink-secondary">
        <p>
          <span className="font-semibold text-ink">
            {formatNumber(score)}/100 (Grade {grade})
          </span>
        </p>
        <p>{verdict}</p>
        <p>Missing values: {formatPercent(missingPct)}</p>
        <p>Duplicate rows: {formatNumber(report.basic_info.duplicate_rows)}</p>
      </div>
    </Card>
  );
}
