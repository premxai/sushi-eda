"use client";

import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { FileSpreadsheet, X, AlertCircle, Sparkles } from "lucide-react";
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

// File type icon components
function CsvIcon({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <div className="w-14 h-16 rounded-lg bg-gradient-to-br from-cyan-400 to-cyan-600 shadow-lg shadow-cyan-500/30 flex items-center justify-center transform -rotate-6 hover:rotate-0 transition-transform duration-300">
        <span className="text-white font-bold text-sm tracking-tight">CSV</span>
      </div>
    </div>
  );
}

function XlsIcon({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <div className="w-14 h-16 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30 flex items-center justify-center transform hover:scale-105 transition-transform duration-300">
        <span className="text-white font-bold text-sm tracking-tight">XLS</span>
      </div>
    </div>
  );
}

function SqlIcon({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <div className="w-14 h-16 rounded-lg bg-gradient-to-br from-violet-400 to-violet-600 shadow-lg shadow-violet-500/30 flex items-center justify-center transform rotate-6 hover:rotate-0 transition-transform duration-300">
        <span className="text-white font-bold text-sm tracking-tight">SQL</span>
      </div>
    </div>
  );
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
    maxSize: 2 * 1024 * 1024 * 1024, // 2GB
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
    <div className="w-full space-y-4">
      {/* Main upload area */}
      <div
        {...getRootProps()}
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center transition-all duration-300",
          isUploading && "pointer-events-none"
        )}
      >
        <input {...getInputProps()} />

        {/* Floating file icons */}
        {!isUploading && !selectedFile && !error && (
          <div className="flex items-end justify-center gap-3 mb-4 animate-float">
            <CsvIcon className="transform translate-y-2" />
            <XlsIcon className="transform -translate-y-1" />
            <SqlIcon className="transform translate-y-2" />
          </div>
        )}

        {/* Glass platform */}
        <div
          className={cn(
            "relative w-full max-w-md rounded-2xl p-1 transition-all duration-300",
            isDragActive && !isDragReject
              ? "bg-gradient-to-r from-cyan-500 via-emerald-500 to-violet-500"
              : "bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700"
          )}
        >
          {/* Inner glass container */}
          <div
            className={cn(
              "relative rounded-xl backdrop-blur-xl px-8 py-8 transition-all duration-300",
              isDragActive && !isDragReject
                ? "bg-slate-900/80"
                : isDragReject
                  ? "bg-red-900/80"
                  : error
                    ? "bg-red-900/60"
                    : "bg-slate-900/90"
            )}
          >
            {/* Mesh pattern overlay */}
            <div 
              className="absolute inset-0 rounded-xl opacity-30"
              style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
                backgroundSize: '16px 16px'
              }}
            />

            {/* Glow effect */}
            <div
              className={cn(
                "absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300",
                isDragActive && "opacity-100"
              )}
              style={{
                background: 'radial-gradient(ellipse at center, rgba(99, 102, 241, 0.15) 0%, transparent 70%)'
              }}
            />

            {/* Content */}
            <div className="relative z-10">
              {isUploading && selectedFile ? (
                <div className="w-full space-y-4 text-center">
                  <div className="flex items-center justify-center gap-3">
                    <FileSpreadsheet className="h-5 w-5 text-cyan-400" />
                    <span className="text-sm font-medium text-white truncate max-w-[200px]">
                      {selectedFile.name}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatBytes(selectedFile.size)}
                    </span>
                  </div>
                  <Progress value={uploadProgress} className="h-2 bg-slate-700" />
                  <p className="text-xs text-slate-400">
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
                <div className="text-center py-2">
                  <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-red-400">Upload failed</p>
                  <p className="mt-1 max-w-sm text-xs text-red-300/70">{error}</p>
                </div>
              ) : isDragActive ? (
                <div className="text-center py-4">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center animate-pulse">
                    <FileSpreadsheet className="h-8 w-8 text-white" />
                  </div>
                  <p className="text-lg font-semibold text-white">
                    Drop to analyze
                  </p>
                </div>
              ) : selectedFile && !error ? (
                <div className="flex items-center justify-center gap-3 py-2">
                  <FileSpreadsheet className="h-5 w-5 text-cyan-400" />
                  <span className="text-sm font-medium text-white">
                    {selectedFile.name}
                  </span>
                  <span className="text-xs text-slate-400">
                    {formatBytes(selectedFile.size)}
                  </span>
                  <button
                    onClick={handleClear}
                    className="ml-1 rounded p-1 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-base font-semibold text-white tracking-wide uppercase">
                    Drop files or{" "}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">
                      Browse
                    </span>
                    <span className="text-slate-400 font-normal normal-case text-sm ml-2">
                      (up to 2GB)
                    </span>
                  </p>
                </div>
              )}
            </div>

            {/* Bottom reflection */}
            <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </div>
        </div>
      </div>

      {/* Sample data prompt */}
      {!isUploading && !selectedFile && onLoadSample && (
        <button
          onClick={onLoadSample}
          className="flex items-center justify-center gap-2 mx-auto text-sm text-slate-500 hover:text-slate-700 transition-colors group"
        >
          <Sparkles className="h-4 w-4 group-hover:text-violet-500 transition-colors" />
          <span>Try with our sample <span className="font-medium text-slate-600 group-hover:text-violet-600">&quot;Customer Behavior&quot;</span> dataset.</span>
        </button>
      )}

      {/* Error with dismiss */}
      {error && !isUploading && (
        <button
          onClick={handleClear}
          className="flex w-full items-center gap-2 rounded-xl border border-red-800/50 bg-red-900/20 px-4 py-3 text-left text-xs text-red-400 transition-colors hover:bg-red-900/30"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <X className="h-4 w-4 shrink-0 text-red-500" />
        </button>
      )}

      {/* CSS for floating animation */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
