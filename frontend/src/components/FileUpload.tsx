"use client";

import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { FileUp, FileSpreadsheet, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface FileUploadProps {
  onFileAccepted: (file: File) => void;
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
  onClearError: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function FileUpload({
  onFileAccepted,
  isUploading,
  uploadProgress,
  error,
  onClearError,
}: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        setSelectedFile(file);
        onFileAccepted(file);
      }
    },
    [onFileAccepted]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
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
    onDropRejected: (rejections) => {
      const rejection = rejections[0];
      if (rejection?.errors[0]?.code === "file-too-large") {
        onClearError();
        setTimeout(() => {
          onFileAccepted(rejection.file);
        }, 100);
      }
    },
  });

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    onClearError();
  };

  return (
    <div className="w-full space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-16 transition-all duration-200",
          isDragActive && !isDragReject &&
            "border-indigo-500 bg-indigo-50",
          isDragReject &&
            "border-red-400 bg-red-50",
          !isDragActive && !isDragReject && !error &&
            "border-slate-300 hover:border-slate-400 hover:bg-slate-50",
          error &&
            "border-red-300 bg-red-50/50",
          isUploading &&
            "pointer-events-none"
        )}
      >
        <input {...getInputProps()} />

        {/* Icon */}
        <div
          className={cn(
            "mb-4 flex h-12 w-12 items-center justify-center rounded-lg transition-colors duration-200",
            isDragActive && !isDragReject
              ? "bg-indigo-100 text-indigo-600"
              : error
                ? "bg-red-100 text-red-500"
                : "bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-500"
          )}
        >
          {isDragActive ? (
            <FileSpreadsheet className="h-6 w-6" />
          ) : error ? (
            <AlertCircle className="h-6 w-6" />
          ) : (
            <FileUp className="h-6 w-6" />
          )}
        </div>

        {/* Text content */}
        {isUploading && selectedFile ? (
          <div className="w-full max-w-xs space-y-3 text-center">
            <div className="flex items-center justify-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
              <span className="text-sm font-medium text-slate-900 truncate max-w-[200px]">
                {selectedFile.name}
              </span>
              <span className="text-xs text-slate-500">
                {formatBytes(selectedFile.size)}
              </span>
            </div>
            <Progress value={uploadProgress} className="h-1.5" />
            <p className="text-xs text-slate-500">Analyzing your data...</p>
          </div>
        ) : error ? (
          <div className="text-center">
            <p className="text-sm font-medium text-red-600">Upload failed</p>
            <p className="mt-1 max-w-sm text-xs text-red-500">{error}</p>
          </div>
        ) : isDragActive ? (
          <div className="text-center">
            <p className="text-sm font-medium text-indigo-700">
              Drop to analyze
            </p>
          </div>
        ) : selectedFile && !error ? (
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
            <span className="text-sm font-medium text-slate-900">
              {selectedFile.name}
            </span>
            <span className="text-xs text-slate-500">
              {formatBytes(selectedFile.size)}
            </span>
            <button
              onClick={handleClear}
              className="ml-1 rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700">
              Drop your file here, or{" "}
              <span className="text-indigo-600">browse</span>
            </p>
            <p className="mt-1.5 text-xs text-slate-400">
              CSV, XLSX, or JSON up to 100 MB
            </p>
          </div>
        )}
      </div>

      {/* Error with dismiss */}
      {error && !isUploading && (
        <button
          onClick={handleClear}
          className="flex w-full items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-left text-xs text-red-600 transition-colors hover:bg-red-100"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <X className="h-3.5 w-3.5 shrink-0 text-red-400" />
        </button>
      )}
    </div>
  );
}
