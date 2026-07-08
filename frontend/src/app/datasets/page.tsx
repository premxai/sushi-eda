"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Database, Loader2 } from "lucide-react";
import { archiveDataset, DatasetSummary, getApiErrorMessage, listDatasets, renameDataset, restoreDataset, starDataset } from "@/lib/api";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { DatasetCard } from "@/components/datasets/DatasetCard";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type Tab = "active" | "archived";

export default function DatasetsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("active");
  const [datasets, setDatasets] = useState<DatasetSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback((nextTab: Tab) => {
    setDatasets(null);
    setError(null);
    listDatasets("default", { archived: nextTab === "archived" })
      .then(setDatasets)
      .catch((err) => setError(getApiErrorMessage(err, "Couldn't load your datasets right now.")));
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  const withBusy = async (dataset: DatasetSummary, action: () => Promise<void>) => {
    setBusyId(dataset.id);
    try {
      await action();
      load(tab);
    } catch (err) {
      setError(getApiErrorMessage(err, "That action didn't go through — try again."));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-paper">
      <SiteHeader />
      <div className="container py-8">
        <PageHeader title="Datasets" description="Everything you've uploaded in this session. Files and their reports are deleted automatically after 7 days." />

        <div className="mt-5 flex gap-1 border-b border-border">
          {(["active", "archived"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-[13px] font-medium capitalize",
                tab === t ? "border-brand text-brand" : "border-transparent text-ink-secondary hover:text-ink",
              )}
            >
              {t === "active" ? "Active" : "Archived"}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {error && (
            <div className="mb-4">
              <Alert tone="danger">{error}</Alert>
            </div>
          )}

          {datasets == null ? (
            <div className="flex items-center justify-center py-16 text-ink-tertiary">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : datasets.length === 0 ? (
            <EmptyState
              icon={Database}
              title={tab === "active" ? "No datasets yet" : "Nothing archived"}
              description={tab === "active" ? "Upload a file from the home page to see it here." : "Archived datasets show up here until they expire."}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {datasets.map((d) => (
                <DatasetCard
                  key={d.id}
                  dataset={d}
                  busy={busyId === d.id}
                  onOpen={(ds) => router.push(`/?open=${ds.id}&name=${encodeURIComponent(ds.name || ds.original_filename)}`)}
                  onToggleStar={(ds) => withBusy(ds, () => starDataset(ds.id))}
                  onArchive={(ds) => withBusy(ds, () => archiveDataset(ds.id))}
                  onRestore={(ds) => withBusy(ds, () => restoreDataset(ds.id))}
                  onRename={(ds, name) => withBusy(ds, () => renameDataset(ds.id, name).then(() => undefined))}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
