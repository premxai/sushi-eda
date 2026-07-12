"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Database, Loader2, RefreshCw, Rows3, Table2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from "@/components/ui/table";
import { fetchDatasetRows, getApiErrorMessage } from "@/lib/api";
import { formatNumber } from "@/lib/formatters";
import { ReportSectionHeading } from "@/components/report/ReportSectionHeading";

const PREVIEW_LIMIT = 1_000;

interface RawDataSectionProps {
  datasetId: string | null;
  preview: Record<string, unknown>[];
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** A bounded, owner-authorized view of the uploaded source rows. */
export function RawDataSection({ datasetId, preview }: RawDataSectionProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>(preview);
  const [totalRows, setTotalRows] = useState(preview.length);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(Boolean(datasetId));
  const [error, setError] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    if (!datasetId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDatasetRows(datasetId, { limit: PREVIEW_LIMIT });
      setRows(data.rows);
      setTotalRows(data.total_rows);
      setTruncated(data.truncated);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Couldn't load the raw data preview."));
    } finally {
      setLoading(false);
    }
  }, [datasetId]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const columns = useMemo(() => {
    const seen = new Set<string>();
    rows.forEach((row) => Object.keys(row).forEach((column) => seen.add(column)));
    return Array.from(seen);
  }, [rows]);

  return (
    <div className="flex flex-col gap-4">
      <ReportSectionHeading
        icon={Table2}
        eyebrow="Original rows"
        title="View the raw data."
        description="Inspect the parsed source rows behind this report. This preview is read-only and stays private to your account."
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <Card padded={false} className="overflow-hidden">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-brand/25 bg-brand-weak text-brand"><Database className="h-4 w-4" /></span>
            <div>
              <CardTitle>Raw file preview</CardTitle>
              <p className="mt-0.5 text-[11.5px] text-ink-tertiary">
                {loading ? "Loading rows…" : `${formatNumber(rows.length)} shown${truncated ? ` of ${formatNumber(totalRows)}` : ""}`}
              </p>
            </div>
          </div>
          {datasetId && (
            <Button variant="secondary" size="sm" onClick={() => void loadRows()} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </Button>
          )}
        </CardHeader>

        {!datasetId ? (
          <div className="px-5 py-10 text-center text-[13px] text-ink-secondary">
            <Rows3 className="mx-auto mb-3 h-5 w-5 text-ink-tertiary" />
            This temporary report has no stored source file. Upload or open a saved dataset to view its raw rows.
          </div>
        ) : loading ? (
          <div className="grid min-h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-ink-secondary">This file has no readable data rows.</div>
        ) : (
          <Table className="min-w-[44rem]">
            <TableHead className="bg-surface-2/70">
              <TableRow>
                <TableHeadCell className="w-14 text-right">#</TableHeadCell>
                {columns.map((column) => <TableHeadCell key={column}>{column}</TableHeadCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index}>
                  <TableCell className="text-right font-mono text-[11px] text-ink-tertiary">{index + 1}</TableCell>
                  {columns.map((column) => (
                    <TableCell key={column} className="max-w-[22rem] truncate text-[12.5px]" title={displayValue(row[column])}>
                      {displayValue(row[column])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {truncated && <p className="text-center text-[11.5px] text-ink-tertiary">For performance, Sushi shows the first {formatNumber(PREVIEW_LIMIT)} of {formatNumber(totalRows)} rows.</p>}
    </div>
  );
}
