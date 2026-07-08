"use client";

import React from "react";
import { useDropzone } from "react-dropzone";
import { ArrowRight, FileSpreadsheet, Star, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { listDatasets, DatasetSummary } from "@/lib/api";

const FILE_TONE: Record<string, string> = {
  csv: "bg-brand-weak text-brand",
  tsv: "bg-brand-weak text-brand",
  xlsx: "bg-ink/8 text-ink",
  xls: "bg-ink/8 text-ink",
  json: "bg-warning/10 text-warning",
  parquet: "bg-success/10 text-success",
  sqlite: "bg-success/10 text-success",
  db: "bg-success/10 text-success",
};

const FORMAT_PILLS = ["CSV", "XLS", "JSON", "Parquet"];

interface NewFileModalProps {
  onClose: () => void;
  onFileAccepted: (file: File) => void;
  onDatasetPick: (id: string, filename: string) => void;
  isUploading: boolean;
}

export function NewFileModal({ onClose, onFileAccepted, onDatasetPick, isUploading }: NewFileModalProps) {
  const [tab, setTab] = React.useState<"upload" | "datasets">("upload");
  const [datasets, setDatasets] = React.useState<DatasetSummary[]>([]);
  const [dsLoading, setDsLoading] = React.useState(false);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => {
      if (accepted.length > 0) {
        onFileAccepted(accepted[0]);
        onClose();
      }
    },
    accept: {
      "text/csv": [".csv"],
      "text/tab-separated-values": [".tsv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "application/json": [".json"],
      "application/vnd.apache.parquet": [".parquet"],
      "application/x-sqlite3": [".db", ".sqlite", ".sqlite3"],
    },
    maxFiles: 1,
    disabled: isUploading,
    maxSize: 100 * 1024 * 1024,
  });

  React.useEffect(() => {
    if (tab === "datasets") {
      setDsLoading(true);
      listDatasets("default", { archived: false })
        .then(setDatasets)
        .catch(() => {})
        .finally(() => setDsLoading(false));
    }
  }, [tab]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-[480px] max-w-[calc(100vw-48px)] overflow-hidden rounded-card-lg border border-line bg-surface shadow-soft-lg">
        <div className="flex items-start justify-between border-b border-line px-5 py-4">
          <div>
            <h3 className="text-[16px] font-semibold text-ink">New workspace</h3>
            <p className="mt-0.5 text-[12px] text-muted-ink">Upload a dataset or reopen a saved workspace</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink/5 text-muted-ink hover:bg-ink/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-0.5 border-b border-line bg-paper-2 px-5 pt-2.5">
          {(["upload", "datasets"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "relative top-px rounded-t-lg border border-b-0 border-transparent px-4 py-2 text-[13px]",
                tab === t
                  ? "border-line bg-surface font-semibold text-ink"
                  : "font-normal text-muted-ink",
              )}
            >
              {t === "upload" ? "Upload dataset" : "My datasets"}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === "upload" && (
            <div
              {...getRootProps()}
              className={cn(
                "sushi-board flex cursor-pointer flex-col items-center rounded-2xl border-[1.5px] border-dashed px-6 py-10 text-center transition-colors",
                isDragActive ? "border-brand bg-brand-weak" : "border-line-2",
              )}
            >
              <input {...getInputProps()} />
              <div className="mb-3.5 grid h-11 w-11 place-items-center rounded-xl bg-brand-weak">
                <UploadCloud className="h-5 w-5 text-brand" />
              </div>
              <div className="mb-3.5 flex gap-1.5">
                {FORMAT_PILLS.map((f) => (
                  <span key={f} className="rounded-md border border-line bg-surface px-2 py-0.5 text-[10px] font-semibold text-muted-ink">
                    {f}
                  </span>
                ))}
              </div>
              <p className="text-[14px] text-ink">
                Drop a dataset or <span className="font-semibold text-brand">browse</span>
              </p>
              <p className="mt-1 text-[12px] text-muted-ink">
                Saved automatically to My Datasets. CSV, JSON, Excel, Parquet, SQLite up to 25 MB.
              </p>
            </div>
          )}

          {tab === "datasets" && (
            <div className="max-h-80 overflow-y-auto">
              {dsLoading ? (
                <div className="py-12 text-center">
                  <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-brand/20 border-t-brand" />
                </div>
              ) : datasets.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <FileSpreadsheet className="mx-auto mb-2.5 h-7 w-7 text-faint-ink" />
                  <p className="text-[13px] text-muted-ink">No saved datasets yet. Upload your first file to start a workspace.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {datasets.map((ds) => {
                    const ext = ds.original_filename.split(".").pop()?.toLowerCase() || "csv";
                    const tone = FILE_TONE[ext] || FILE_TONE.csv;
                    return (
                      <button
                        key={ds.id}
                        onClick={() => {
                          onDatasetPick(ds.id, ds.original_filename);
                          onClose();
                        }}
                        className="flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:border-brand/20 hover:bg-brand-weak"
                      >
                        <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", tone)}>
                          <span className="text-[10px] font-bold uppercase">{ext}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-ink">{ds.original_filename}</p>
                          <p className="text-[11px] text-muted-ink">
                            {ds.row_count != null ? `${ds.row_count.toLocaleString()} rows · ` : ""}
                            {new Date(ds.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        {ds.is_starred && <Star className="h-3 w-3 shrink-0 fill-warning text-warning" />}
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-faint-ink" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
