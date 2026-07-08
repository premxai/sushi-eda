"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  Clock3,
  Database,
  FileText,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import {
  SharedReport,
  getApiErrorMessage,
  getSharedReport,
} from "@/lib/api";
import { NarrativeMarkdown } from "@/components/dashboard/AISummarySection";
import { HankoStamp } from "@/components/sushi/HankoStamp";
import { cn } from "@/lib/utils";

function formatNumber(value: number | undefined) {
  return typeof value === "number" ? value.toLocaleString() : "—";
}

function formatQuality(value: number | undefined) {
  return typeof value === "number" ? `${value}/100` : "—";
}

function formatStat(value: number | undefined) {
  return typeof value === "number" ? value.toFixed(2) : "—";
}

function stampTone(score: number): "wasabi" | "salmon" | "tuna" {
  if (score >= 80) return "wasabi";
  if (score >= 60) return "salmon";
  return "tuna";
}

export default function SharedReportPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";

  const [data, setData] = useState<SharedReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    setError(null);

    getSharedReport(token)
      .then(setData)
      .catch((err) => {
        setError(
          getApiErrorMessage(err, "This share link is unavailable right now."),
        );
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="rounded-card border border-line bg-surface px-5 py-4 text-sm text-muted-ink shadow-soft-sm">
          Loading shared report...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-6">
        <div className="w-full max-w-md rounded-card-lg border border-line bg-surface p-8 text-center shadow-soft">
          <AlertCircle className="mx-auto h-10 w-10 text-danger" />
          <p className="mt-4 text-base font-semibold text-ink">
            {error || "Report not found"}
          </p>
          <p className="mt-2 text-sm text-muted-ink">
            The link may have expired, been revoked, or point to a report that is
            no longer available.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-pill border border-line px-4 py-2 text-sm font-medium text-muted-ink transition hover:border-line-2 hover:text-ink"
          >
            Back to Sushi
          </Link>
        </div>
      </div>
    );
  }

  const report = data.analysis.report;
  const basic = report.basic_info;
  const quality = report.quality_score;

  return (
    <div className="min-h-screen bg-paper">
      <div className="border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Image src="/sushi-logo.png" alt="Sushi" width={32} height={32} />
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-faint-ink">
                Shared Analysis
              </p>
              <h1 className="font-display text-lg font-semibold text-ink">
                {data.dataset_name}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-ink">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" />
              Expires {new Date(data.expires_at).toLocaleDateString()}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              Read-only
            </span>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-stretch">
          {typeof quality?.overall_score === "number" && (
            <div className="flex shrink-0 items-center justify-center rounded-card-lg border border-line bg-surface px-6 py-5 shadow-soft-sm">
              <HankoStamp
                value={quality.overall_score}
                label={quality.grade ? `Grade ${quality.grade}` : "Quality"}
                tone={stampTone(quality.overall_score)}
                size={96}
                rotation={-8}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: "Rows", value: formatNumber(basic?.rows) },
              { label: "Columns", value: formatNumber(basic?.columns) },
              { label: "Missing Cells", value: formatNumber(basic?.total_missing) },
              {
                label: "Quality Score",
                value: formatQuality(quality?.overall_score),
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-card border border-line bg-surface px-4 py-4 shadow-soft-sm"
              >
                <p className="font-mono text-[11px] uppercase tracking-wide text-faint-ink">
                  {item.label}
                </p>
                <p className="mt-1 font-display text-2xl font-semibold text-ink">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
          <div className="space-y-6">
            <section className="rounded-card-lg border border-line bg-surface p-6 shadow-soft-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-faint-ink" />
                <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[1.5px] text-muted-ink">
                  Executive Summary
                </h2>
              </div>
              {data.analysis.ai_narrative ? (
                <div className="mt-4">
                  <NarrativeMarkdown text={data.analysis.ai_narrative} />
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-ink">
                  No AI summary was saved for this analysis. The summary metrics
                  and column profile below are still available.
                </p>
              )}
            </section>

            <section className="overflow-hidden rounded-card-lg border border-line bg-surface shadow-soft-sm">
              <div className="flex items-center gap-2 border-b border-line px-6 py-4">
                <Database className="h-4 w-4 text-faint-ink" />
                <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[1.5px] text-muted-ink">
                  Column Profile
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-faint-ink">
                    <tr>
                      <th className="px-6 py-3 font-medium">Column</th>
                      <th className="px-6 py-3 font-medium">Type</th>
                      <th className="px-6 py-3 font-medium">Missing %</th>
                      <th className="px-6 py-3 font-medium">Unique</th>
                      <th className="px-6 py-3 font-medium">Sample / Stats</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(report.column_analysis ?? []).map((column) => (
                      <tr
                        key={column.name}
                        className="border-t border-line align-top"
                      >
                        <td className="px-6 py-4 font-medium text-ink">
                          {column.name}
                        </td>
                        <td className="px-6 py-4 text-muted-ink">
                          {column.dtype}
                        </td>
                        <td
                          className={cn(
                            "px-6 py-4",
                            typeof column.missing_percent === "number"
                              ? column.missing_percent > 20
                                ? "text-danger"
                                : column.missing_percent > 5
                                  ? "text-warning"
                                  : "text-muted-ink"
                              : "text-muted-ink",
                          )}
                        >
                          {typeof column.missing_percent === "number"
                            ? `${column.missing_percent.toFixed(1)}%`
                            : "—"}
                        </td>
                        <td className="px-6 py-4 text-muted-ink">
                          {formatNumber(column.unique_count)}
                        </td>
                        <td className="px-6 py-4 text-muted-ink">
                          {column.stats ? (
                            <span>
                              Mean {formatStat(column.stats.mean)} · Std{" "}
                              {formatStat(column.stats.std)}
                            </span>
                          ) : (
                            column.top_values?.[0]?.value ?? "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-card-lg border border-line bg-surface p-6 shadow-soft-sm">
              <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[1.5px] text-muted-ink">
                Analysis Metadata
              </h2>
              <dl className="mt-4 space-y-3 text-sm text-muted-ink">
                <div className="flex items-start justify-between gap-4">
                  <dt>Version</dt>
                  <dd className="font-medium text-ink">
                    v{data.analysis.version}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt>Generated</dt>
                  <dd className="text-right font-medium text-ink">
                    {new Date(data.analysis.created_at).toLocaleString()}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt>Duration</dt>
                  <dd className="font-medium text-ink">
                    {typeof data.analysis.duration_seconds === "number"
                      ? `${data.analysis.duration_seconds.toFixed(1)}s`
                      : "—"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-card-lg border border-line bg-surface p-6 shadow-soft-sm">
              <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[1.5px] text-muted-ink">
                Quality Snapshot
              </h2>
              <ul className="mt-4 space-y-3 text-sm text-muted-ink">
                <li className="flex items-start justify-between gap-4">
                  <span>Duplicate Rows</span>
                  <span className="font-medium text-ink">
                    {formatNumber(basic?.duplicate_rows)}
                  </span>
                </li>
                <li className="flex items-start justify-between gap-4">
                  <span>Memory Usage</span>
                  <span className="font-medium text-ink">
                    {typeof basic?.memory_usage_mb === "number"
                      ? `${basic.memory_usage_mb.toFixed(1)} MB`
                      : "—"}
                  </span>
                </li>
                <li className="flex items-start justify-between gap-4">
                  <span>Profiled Columns</span>
                  <span className="font-medium text-ink">
                    {formatNumber(report.column_analysis?.length)}
                  </span>
                </li>
              </ul>
            </section>

            <p className="px-1 text-center text-[11px] text-faint-ink">
              Generated with{" "}
              <Link href="/" className="font-medium text-brand hover:underline">
                Sushi
              </Link>
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
