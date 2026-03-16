"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlertCircle, Clock, Database } from "lucide-react";
import Image from "next/image";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

interface ColumnStats {
  mean?: number;
  std?: number;
}

interface TopValue {
  value: string;
}

interface ColumnAnalysis {
  name: string;
  dtype: string;
  missing_percent?: number;
  unique_count?: number;
  stats?: ColumnStats;
  top_values?: TopValue[];
}

interface AnalysisReport {
  basic_info?: {
    rows?: number;
    columns?: number;
    total_missing?: number;
  };
  quality_score?: {
    overall_score?: number;
  };
  column_analysis?: ColumnAnalysis[];
}

interface SharedReport {
  token: string;
  dataset_name: string;
  expires_at: string;
  analysis: {
    analysis_id: string;
    version: number;
    ai_narrative: string | null;
    duration_seconds: number;
    created_at: string;
    report: AnalysisReport;
  };
}

export default function SharedReportPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";

  const [data, setData] = useState<SharedReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/share/${token}`)
      .then((r) => {
        if (!r.ok)
          throw new Error(
            r.status === 404
              ? "Link not found or expired"
              : "Failed to load report",
          );
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-neutral-400 text-sm">
          Loading shared report…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto" />
          <p className="text-neutral-700 font-medium">
            {error || "Report not found"}
          </p>
          <p className="text-neutral-400 text-sm">
            This link may have expired or been revoked.
          </p>
        </div>
      </div>
    );
  }

  const report = data.analysis.report;
  const basic = report?.basic_info ?? {};
  const quality = report?.quality_score ?? {};

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/sushi-logo.png" alt="Sushi" width={32} height={32} />
            <div>
              <p className="text-xs text-neutral-400">Shared Analysis</p>
              <h1 className="text-base font-semibold text-neutral-900">
                {data.dataset_name}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <Clock className="h-3.5 w-3.5" />
            Expires {new Date(data.expires_at).toLocaleDateString()}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Rows", value: basic.rows?.toLocaleString() ?? "—" },
            { label: "Columns", value: basic.columns ?? "—" },
            {
              label: "Missing",
              value: basic.total_missing?.toLocaleString() ?? "—",
            },
            {
              label: "Quality",
              value: quality.overall_score
                ? `${quality.overall_score}/100`
                : "—",
            },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="bg-white rounded-xl border border-neutral-200 px-4 py-3"
            >
              <p className="text-xs text-neutral-400">{label}</p>
              <p className="text-xl font-semibold text-neutral-900 mt-0.5">
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* AI Narrative */}
        {data.analysis.ai_narrative && (
          <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-xl border border-violet-100 px-6 py-5">
            <p className="text-xs font-medium text-violet-500 uppercase tracking-wide mb-3">
              AI Analysis
            </p>
            <div className="prose prose-sm prose-neutral max-w-none text-neutral-700">
              {data.analysis.ai_narrative
                .split("\n")
                .map((line: string, i: number) => (
                  <p key={i} style={{ marginBottom: 8 }}>
                    {line
                      .split(/\*\*(.*?)\*\*/)
                      .map((part: string, j: number) =>
                        j % 2 === 1 ? <strong key={j}>{part}</strong> : part,
                      )}
                  </p>
                ))}
            </div>
          </div>
        )}

        {/* Column list */}
        {(report?.column_analysis?.length ?? 0) > 0 && (
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-100">
              <h2 className="text-sm font-semibold text-neutral-800 flex items-center gap-2">
                <Database className="h-4 w-4 text-neutral-400" />
                Columns
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-neutral-50">
                  <tr>
                    {["Column", "Type", "Missing %", "Unique", "Stats"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-4 py-2 text-left font-medium text-neutral-500"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {report.column_analysis?.map((col: ColumnAnalysis) => (
                    <tr
                      key={col.name}
                      className="border-t border-neutral-100 hover:bg-neutral-50"
                    >
                      <td className="px-4 py-2 font-medium text-neutral-800">
                        {col.name}
                      </td>
                      <td className="px-4 py-2 text-neutral-500">
                        {col.dtype}
                      </td>
                      <td className="px-4 py-2 text-neutral-600">
                        {col.missing_percent?.toFixed(1)}%
                      </td>
                      <td className="px-4 py-2 text-neutral-600">
                        {col.unique_count?.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-neutral-500">
                        {col.stats ? (
                          <span>
                            μ={col.stats.mean} · σ={col.stats.std}
                          </span>
                        ) : (
                          (col.top_values?.[0]?.value ?? "—")
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-neutral-400">
          Shared via Sushi · Analysis v{data.analysis.version} · Generated in{" "}
          {data.analysis.duration_seconds?.toFixed(1)}s
        </p>
      </div>
    </div>
  );
}
