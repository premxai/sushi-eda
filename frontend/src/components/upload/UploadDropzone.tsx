"use client";

import React, { useCallback, useState } from "react";
import { useDropzone, FileRejection } from "react-dropzone";
import { AlertCircle, File as FileIcon, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/formatters";
import { MAX_UPLOAD_BYTES } from "@/lib/api";
import { Button } from "@/components/ui/button";

const ACCEPT: Record<string, string[]> = {
  "text/csv": [".csv"],
  "text/tab-separated-values": [".tsv"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-excel": [".xls"],
  "application/json": [".json"],
  "application/vnd.apache.parquet": [".parquet"],
  "application/x-sqlite3": [".db", ".sqlite", ".sqlite3"],
};

const FORMAT_BADGES = ["CSV", "TSV", "XLSX", "JSON", "Parquet", "SQLite"];

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
            ? `"${file.name}" is ${formatBytes(file.size)} — that's over the 25 MB limit. Try a smaller export, or split it into parts.`
            : `"${file.name}" isn't a format Sushi can read yet. Use CSV, TSV, XLSX, JSON, Parquet, or SQLite.`,
        });
        return;
      }
      const file = accepted[0];
      if (!file) return;
      setSelectedFile(file);
      setState("selected");
      // Brief, real confirmation frame — not a fake delay, just enough for
      // the user to see the file was received before analysis begins.
      window.setTimeout(() => onFileAccepted(file), 450);
    },
    [onFileAccepted],
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxSize: MAX_UPLOAD_BYTES,
    multiple: false,
    noClick: true,
    noKeyboard: true,
    disabled,
  });

  if (state === "selected" && selectedFile) {
    return (
      <div className="rounded-lg border border-border-strong bg-surface p-8 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-weak">
          <FileIcon className="h-5 w-5 text-brand" />
        </div>
        <p className="mt-3 text-[14px] font-medium text-ink">{selectedFile.name}</p>
        <p className="mt-0.5 text-[12.5px] text-ink-secondary">{formatBytes(selectedFile.size)} · starting analysis…</p>
      </div>
    );
  }

  return (
    <div>
      <div
        {...getRootProps()}
        className={cn(
          "rounded-lg border-2 border-dashed p-8 text-center transition-colors",
          isDragActive ? "border-brand bg-brand-weak" : "border-border-strong bg-surface hover:border-border-strong",
        )}
      >
        <input {...getInputProps()} aria-label="Upload a data file" />
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-weak">
          <UploadCloud className="h-5 w-5 text-brand" />
        </div>
        <p className="mt-3 text-[15px] font-medium text-ink">{isDragActive ? "Drop it here" : "Drag a data file here"}</p>
        <p className="mt-1 text-[13px] text-ink-secondary">or choose a file from your computer</p>

        <div className="mt-5 flex items-center justify-center gap-3">
          <Button onClick={open} disabled={disabled}>
            Choose file
          </Button>
          <button onClick={onSample} disabled={disabled} className="text-[13.5px] font-medium text-brand hover:text-brand-hover disabled:opacity-50">
            or try a sample dataset
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
          {FORMAT_BADGES.map((f) => (
            <span key={f} className="rounded-sm border border-border bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-secondary">
              {f}
            </span>
          ))}
        </div>
        <p className="mt-3 text-[12px] text-ink-tertiary">Up to 25 MB per file.</p>
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
