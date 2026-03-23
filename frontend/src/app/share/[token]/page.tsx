"use client";

import { useEffect, useMemo, useState } from "react";
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

function formatNumber(value: number | undefined) {
  return typeof value === "number" ? value.toLocaleString() : "—";
}

function formatQuality(value: number | undefined) {
  return typeof value === "number" ? `${value}/100` : "—";
}

function formatStat(value: number | undefined) {
  return typeof value === "number" ? value.toFixed(2) : "—";
}

function parseNarrative(text: string) {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
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

  const narrativeBlocks = useMemo(
    () => (data?.analysis.ai_narrative ? parseNarrative(data.analysis.ai_narrative) : []),
    [data?.analysis.ai_narrative],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-sm text-neutral-500 shadow-sm">
          Loading shared report...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-6">
        <div className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto h-10 w-10 text-rose-400" />
          <p className="mt-4 text-base font-semibold text-neutral-900">
            {error || "Report not found"}
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            The link may have expired, been revoked, or point to a report that is
            no longer available.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-300 hover:text-neutral-900"
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#fafaf8_0%,#f4f4ef_100%)]">
      <div className="border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Image src="/sushi-logo.png" alt="Sushi" width={32} height={32} />
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">
                Shared Analysis
              </p>
              <h1 className="text-base font-semibold text-neutral-900">
                {data.dataset_name}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-neutral-500">
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
        <div className="grid gap-4 md:grid-cols-4">
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
              className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 shadow-sm"
            >
              <p className="text-xs text-neutral-500">{item.label}</p>
              <p className="mt-1 text-2xl font-semibold text-neutral-900">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-neutral-400" />
                <h2 className="text-sm font-semibold text-neutral-900">
                  Executive Summary
                </h2>
              </div>
              {narrativeBlocks.length > 0 ? (
                <div className="mt-4 space-y-4 text-sm leading-6 text-neutral-700">
                  {narrativeBlocks.map((block, index) => (
                    <p key={`${data.token}-narrative-${index}`}>
                      {block.split(/\*\*(.*?)\*\*/).map((part, partIndex) =>
                        partIndex % 2 === 1 ? (
                          <strong key={partIndex}>{part}</strong>
                        ) : (
                          part
                        ),
                      )}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-neutral-600">
                  No AI narrative was saved for this analysis. The summary metrics
                  and column profile below are still available.
                </p>
              )}
            </section>

            <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-neutral-100 px-6 py-4">
                <Database className="h-4 w-4 text-neutral-400" />
                <h2 className="text-sm font-semibold text-neutral-900">
                  Column Profile
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
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
                        className="border-t border-neutral-100 align-top"
                      >
                        <td className="px-6 py-4 font-medium text-neutral-900">
                          {column.name}
                        </td>
                        <td className="px-6 py-4 text-neutral-600">
                          {column.dtype}
                        </td>
                        <td className="px-6 py-4 text-neutral-600">
                          {typeof column.missing_percent === "number"
                            ? `${column.missing_percent.toFixed(1)}%`
                            : "—"}
                        </td>
                        <td className="px-6 py-4 text-neutral-600">
                          {formatNumber(column.unique_count)}
                        </td>
                        <td className="px-6 py-4 text-neutral-600">
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
            <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-neutral-900">
                Analysis Metadata
              </h2>
              <dl className="mt-4 space-y-3 text-sm text-neutral-600">
                <div className="flex items-start justify-between gap-4">
                  <dt>Version</dt>
                  <dd className="font-medium text-neutral-900">
                    v{data.analysis.version}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt>Generated</dt>
                  <dd className="text-right font-medium text-neutral-900">
                    {new Date(data.analysis.created_at).toLocaleString()}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt>Duration</dt>
                  <dd className="font-medium text-neutral-900">
                    {typeof data.analysis.duration_seconds === "number"
                      ? `${data.analysis.duration_seconds.toFixed(1)}s`
                      : "—"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-neutral-900">
                Quality Snapshot
              </h2>
              <ul className="mt-4 space-y-3 text-sm text-neutral-600">
                <li className="flex items-start justify-between gap-4">
                  <span>Duplicate Rows</span>
                  <span className="font-medium text-neutral-900">
                    {formatNumber(basic?.duplicate_rows)}
                  </span>
                </li>
                <li className="flex items-start justify-between gap-4">
                  <span>Memory Usage</span>
                  <span className="font-medium text-neutral-900">
                    {typeof basic?.memory_usage_mb === "number"
                      ? `${basic.memory_usage_mb.toFixed(1)} MB`
                      : "—"}
                  </span>
                </li>
                <li className="flex items-start justify-between gap-4">
                  <span>Profiled Columns</span>
                  <span className="font-medium text-neutral-900">
                    {formatNumber(report.column_analysis?.length)}
                  </span>
                </li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
