"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { fetchDatasetAnalysis, fetchExampleDataset } from "@/lib/api";
import { EDAReport } from "@/lib/types";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ExampleCard } from "@/components/examples/ExampleCard";

interface Example {
  datasetId: string;
  filename: string;
  report: EDAReport;
}

export default function ExamplesPage() {
  const router = useRouter();
  const [example, setExample] = useState<Example | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchExampleDataset()
      .then(async (res) => {
        if (!res) {
          if (!cancelled) setUnavailable(true);
          return;
        }
        const data = await fetchDatasetAnalysis(res.dataset_id);
        if (!cancelled) setExample({ datasetId: res.dataset_id, filename: res.filename, report: data.report });
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-paper">
      <SiteHeader />
      <div className="container py-8">
        <PageHeader title="Examples" description="Pre-analyzed sample datasets — open one instantly, no upload needed." />

        <div className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-ink-tertiary">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : unavailable || !example ? (
            <EmptyState icon={Sparkles} title="No examples available right now" description="Check back shortly, or upload your own file from the home page." />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <ExampleCard
                filename={example.filename}
                report={example.report}
                onOpen={() => router.push(`/?open=${example.datasetId}&name=${encodeURIComponent(example.filename)}`)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
