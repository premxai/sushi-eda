"use client";

import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { FileSpreadsheet, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface FileUploadProps {
  onFileAccepted: (file: File) => void;
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
  onClearError: () => void;
  onLoadSample?: () => void;
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
  onLoadSample,
}: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setIsDraggingOver(false);
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        setSelectedFile(file);
        onFileAccepted(file);
      }
    },
    [onFileAccepted]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDragEnter: () => setIsDraggingOver(true),
    onDragLeave: () => setIsDraggingOver(false),
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
    maxSize: 100 * 1024 * 1024, // 100 MB
  });

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    onClearError();
  };

  return (
    <div className="upload-section text-center">
      {/* Upload Box */}
      <div
        {...getRootProps()}
        className={cn(
          "upload-box",
          "w-[520px] h-[160px] rounded-[18px] cursor-pointer",
          "flex flex-col justify-center items-center relative",
          "border backdrop-blur-[10px] transition-all duration-300",
          isDragActive || isDraggingOver
            ? "border-[#6ee7ff] shadow-[0_0_25px_rgba(110,231,255,0.3)]"
            : "border-white/15 hover:border-[#6ee7ff] hover:shadow-[0_0_25px_rgba(110,231,255,0.3)]",
          "bg-white/5",
          isUploading && "pointer-events-none"
        )}
      >
        <input {...getInputProps()} />

        {isUploading && selectedFile ? (
          /* Uploading State */
          <div className="w-full max-w-[400px] space-y-4 px-8">
            <div className="flex items-center justify-center gap-3">
              <FileSpreadsheet className="h-5 w-5 text-[#22d3ee]" />
              <span className="text-sm font-medium text-white truncate max-w-[200px]">
                {selectedFile.name}
              </span>
              <span className="text-xs text-[#aaa]">
                {formatBytes(selectedFile.size)}
              </span>
            </div>
            <Progress value={uploadProgress} className="h-2 bg-white/10" />
            <p className="text-xs text-[#aaa]">
              {uploadProgress === 0
                ? "Connecting to server…"
                : uploadProgress < 50
                  ? `Uploading… ${uploadProgress}%`
                  : uploadProgress < 90
                    ? "Analyzing your data…"
                    : "Almost done…"}
            </p>
          </div>
        ) : error ? (
          /* Error State */
          <div className="text-center py-2">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-red-400">Upload failed</p>
            <p className="mt-1 max-w-sm text-xs text-red-300/70 px-4">{error}</p>
            <button
              onClick={handleClear}
              className="mt-3 text-xs text-[#7dd3fc] hover:underline"
            >
              Try again
            </button>
          </div>
        ) : selectedFile && !error ? (
          /* File Selected State */
          <div className="flex items-center justify-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-[#22d3ee]" />
            <span className="text-sm font-medium text-white">
              {selectedFile.name}
            </span>
            <span className="text-xs text-[#aaa]">
              {formatBytes(selectedFile.size)}
            </span>
            <button
              onClick={handleClear}
              className="ml-2 rounded p-1 text-[#aaa] transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          /* Default State */
          <>
            {/* File Icons */}
            <div className="file-icons flex gap-3">
              <div className="file csv px-[14px] py-[10px] rounded-lg text-[13px] font-bold text-white bg-gradient-to-br from-[#22d3ee] to-[#06b6d4] shadow-lg shadow-cyan-500/20">
                CSV
              </div>
              <div className="file xls px-[14px] py-[10px] rounded-lg text-[13px] font-bold text-white bg-gradient-to-br from-[#4ade80] to-[#22c55e] shadow-lg shadow-emerald-500/20">
                XLS
              </div>
              <div className="file sql px-[14px] py-[10px] rounded-lg text-[13px] font-bold text-white bg-gradient-to-br from-[#a78bfa] to-[#8b5cf6] shadow-lg shadow-violet-500/20">
                SQL
              </div>
            </div>

            {/* Upload Text */}
            <p className="upload-text mt-3 text-[14px] tracking-wide text-white">
              DROP FILES OR{" "}
              <span className="browse text-[#7dd3fc] font-bold">BROWSE</span>
              <span className="limit text-[#aaa] ml-1">(up to 100 MB)</span>
            </p>
          </>
        )}
      </div>

      {/* Sample Text */}
      {!isUploading && !selectedFile && onLoadSample && (
        <button
          onClick={onLoadSample}
          className="sample-text mt-4 text-[13px] text-[#aaa] hover:text-white transition-colors bg-transparent border-none cursor-pointer"
        >
          ✎ Try with our sample <span className="text-white">&quot;Sales Data&quot;</span> dataset.
        </button>
      )}

      {/* Error Banner */}
      {error && !isUploading && (
        <button
          onClick={handleClear}
          className="flex w-full max-w-[520px] mx-auto mt-4 items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-left text-xs text-red-400 transition-colors hover:bg-red-500/20"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <X className="h-4 w-4 shrink-0 text-red-500" />
        </button>
      )}
    </div>
  );
}
