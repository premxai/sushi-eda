"use client";

import React, { useCallback, useState } from "react";
import { useDropzone, FileRejection } from "react-dropzone";
import { AlertCircle, File as FileIcon, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/formatters";
import { MAX_UPLOAD_BYTES } from "@/lib/api";

const ACCEPT: Record<string, string[]> = {
  "text/csv": [".csv"],
  "text/tab-separated-values": [".tsv"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-excel": [".xls"],
  "application/json": [".json"],
  "application/vnd.apache.parquet": [".parquet"],
  "application/x-sqlite3": [".db", ".sqlite", ".sqlite3"],
};

interface CompareDropzoneProps {
  label: string;
  file: File | null;
  onFileSelected: (file: File | null) => void;
  disabled?: boolean;
}

export function CompareDropzone({ label, file, onFileSelected, disabled }: CompareDropzoneProps) {
  const [rejection, setRejection] = useState<string | null>(null);

  const onDrop = useCallback(
    (accepted: File[], rejections: FileRejection[]) => {
      setRejection(null);
      if (rejections.length > 0) {
        const [{ file: rejectedFile, errors }] = rejections;
        const isTooLarge = errors.some((e) => e.code === "file-too-large");
        setRejection(
          isTooLarge
            ? `"${rejectedFile.name}" is ${formatBytes(rejectedFile.size)} — that's over the 25 MB limit. Try a smaller export, or split it into parts.`
            : `"${rejectedFile.name}" isn't a format Sushi can read yet. Use CSV, TSV, XLSX, JSON, Parquet, or SQLite.`,
        );
        return;
      }
      if (accepted[0]) onFileSelected(accepted[0]);
    },
    [onFileSelected],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxSize: MAX_UPLOAD_BYTES,
    multiple: false,
    noClick: !!file,
    noKeyboard: true,
    disabled,
  });

  return (
    <div>
      <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-tertiary">{label}</p>
      <div
        {...getRootProps()}
        className={cn(
          "rounded-lg border-2 border-dashed p-6 text-center transition-colors",
          isDragActive ? "border-brand bg-brand-weak" : "border-border-strong bg-surface",
          file && "border-solid",
        )}
      >
        <input {...getInputProps()} aria-label={`Upload ${label}`} />
        {file ? (
          <>
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-weak">
              <FileIcon className="h-[18px] w-[18px] text-brand" />
            </div>
            <p className="mt-2.5 truncate text-[13.5px] font-medium text-ink">{file.name}</p>
            <p className="mt-0.5 text-[12px] text-ink-secondary">{formatBytes(file.size)}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFileSelected(null);
                setRejection(null);
              }}
              className="mt-2 text-[12px] font-medium text-brand hover:text-brand-hover"
            >
              Change file
            </button>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-weak">
              <UploadCloud className="h-[18px] w-[18px] text-brand" />
            </div>
            <p className="mt-2.5 text-[13.5px] font-medium text-ink">{isDragActive ? "Drop it here" : "Drag a file here"}</p>
            <button onClick={open} disabled={disabled} className="mt-1 text-[12.5px] font-medium text-brand hover:text-brand-hover">
              or choose a file
            </button>
          </>
        )}
      </div>
      {rejection && (
        <div className="mt-2 flex items-start gap-2 rounded-md border border-danger/25 bg-danger-weak px-3 py-2 text-[12.5px]">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
          <p className="flex-1 text-ink-secondary">{rejection}</p>
          <button onClick={() => setRejection(null)} aria-label="Dismiss" className="shrink-0 text-ink-tertiary hover:text-ink">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
