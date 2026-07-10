"use client";

import React, { useCallback, useState } from "react";
import { useDropzone, FileRejection } from "react-dropzone";
import { AlertCircle, File as FileIcon, Lock, UploadCloud, X } from "lucide-react";
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

interface UploadDropzoneProps {
  onFileAccepted: (file: File) => void;
  onSample: () => void;
  disabled?: boolean;
}

type LocalState = "idle" | "selected";

export function UploadDropzone({ onFileAccepted, onSample, disabled }: UploadDropzoneProps) {
  const [state, setState] = useState<LocalState>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rejection, setRejection] = useState<{ kind: "size" | "format"; message: string } | null>(null);

  const onDrop = useCallback(
    (accepted: File[], rejections: FileRejection[]) => {
      setRejection(null);
      if (rejections.length > 0) {
        const [{ file, errors }] = rejections;
        const isTooLarge = errors.some((e) => e.code === "file-too-large");
        setRejection({
          kind: isTooLarge ? "size" : "format",
          message: isTooLarge
            ? `"${file.name}" is ${formatBytes(file.size)}, that's over the 25 MB limit. Try a smaller export, or split it into parts.`
            : `"${file.name}" isn't a format Sushi can read yet. Use CSV, TSV, XLSX, JSON, Parquet, or SQLite.`,
        });
        return;
      }
      const file = accepted[0];
      if (!file) return;
      setSelectedFile(file);
      setState("selected");
      window.setTimeout(() => onFileAccepted(file), 450);
    },
    [onFileAccepted],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxSize: MAX_UPLOAD_BYTES,
    multiple: false,
    disabled,
  });

  if (state === "selected" && selectedFile) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-10 text-center shadow-lg">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-brand/30 bg-brand-weak">
          <FileIcon className="h-6 w-6 text-brand" />
        </div>
        <p className="mt-4 text-[15px] font-medium text-ink">{selectedFile.name}</p>
        <p className="mt-0.5 text-[12.5px] text-ink-secondary">{formatBytes(selectedFile.size)} · starting analysis…</p>
      </div>
    );
  }

  return (
    <div>
      <div
        {...getRootProps()}
        className={cn(
          "cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center shadow-lg backdrop-blur transition-colors",
          isDragActive ? "border-brand bg-brand-weak" : "border-brand/30 bg-surface/80 hover:border-brand/50",
        )}
      >
        <input {...getInputProps()} aria-label="Upload a data file" />
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-brand/30 bg-brand-weak">
          <UploadCloud className="h-6 w-6 text-brand" />
        </div>
        <p className="mt-4 text-[20px] font-semibold text-ink">{isDragActive ? "Drop it here" : "Drop your CSV here"}</p>
        <p className="mt-1 text-[14px] font-medium text-brand">or click to browse</p>
        <p className="mt-2 text-[12.5px] text-ink-tertiary">Supports CSV up to 25MB</p>

        <div className="mx-auto my-5 h-px max-w-[16rem] bg-border" />

        <p className="flex items-center justify-center gap-1.5 text-[12px] text-ink-tertiary">
          <Lock className="h-3.5 w-3.5" />
          Your data is private and never shared.
        </p>
      </div>

      <div className="mt-3 text-center">
        <button
          onClick={onSample}
          disabled={disabled}
          className="text-[13px] font-medium text-ink-secondary underline underline-offset-2 hover:text-ink disabled:opacity-50"
        >
          or try a sample dataset
        </button>
      </div>

      {rejection && (
        <div className="mt-3 flex items-start gap-2.5 rounded-md border border-danger/25 bg-danger-weak px-3.5 py-3 text-[13px]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <p className="flex-1 text-ink-secondary">{rejection.message}</p>
          <button onClick={() => setRejection(null)} aria-label="Dismiss" className="shrink-0 text-ink-tertiary hover:text-ink">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
