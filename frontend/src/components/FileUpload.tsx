"use client";

import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { FileSpreadsheet, X, AlertCircle, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { useRouter } from "next/navigation";

interface FileUploadProps {
  onFileAccepted: (file: File) => void;
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
  onClearError: () => void;
  onLoadSample?: () => void;
  isSignedIn?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const FILE_BADGES = [
  { label: "CSV", bg: "linear-gradient(135deg, #22d3ee, #06b6d4)", shadow: "0 4px 16px rgba(34,211,238,0.4)", delay: "0s" },
  { label: "XLS", bg: "linear-gradient(135deg, #4ade80, #22c55e)", shadow: "0 4px 16px rgba(74,222,128,0.4)", delay: "0.4s" },
  { label: "SQL", bg: "linear-gradient(135deg, #a78bfa, #8b5cf6)", shadow: "0 4px 16px rgba(167,139,250,0.4)", delay: "0.8s" },
  { label: "JSON", bg: "linear-gradient(135deg, #fb923c, #f97316)", shadow: "0 4px 16px rgba(251,146,60,0.4)", delay: "1.2s" },
];

export function FileUpload({
  onFileAccepted,
  isUploading,
  uploadProgress,
  error,
  onClearError,
  onLoadSample,
  isSignedIn = true,
}: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const router = useRouter();

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
    onDragEnter: () => { if (isSignedIn) setIsDraggingOver(true); },
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
    noClick: !isSignedIn,
    noDrag: !isSignedIn,
    maxSize: 100 * 1024 * 1024,
  });

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    onClearError();
  };

  const isGlowing = (isDragActive || isDraggingOver) && isSignedIn;
  const showDefault = !isUploading && !error && !selectedFile;

  return (
    <div className="upload-section text-center">
      {/* Floating format badges — shown only in default state */}
      {showDefault && (
        <div className="flex justify-center gap-3 mb-4">
          {FILE_BADGES.map((b) => (
            <div
              key={b.label}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 700,
                color: "#fff",
                background: b.bg,
                boxShadow: b.shadow,
                fontFamily: "'Geist Mono', monospace",
                animation: `float 3s ease-in-out ${b.delay} infinite`,
                letterSpacing: "0.04em",
              }}
            >
              {b.label}
            </div>
          ))}
        </div>
      )}

      {/* 3D perspective wrapper */}
      <div style={{ perspective: "700px", perspectiveOrigin: "50% 55%" }}>
        {/* Tilted box container */}
        <div style={{ transform: "rotateX(10deg)", transformStyle: "preserve-3d" }}>
          {/* Drop zone box */}
          <div
            {...getRootProps({
              onClick: !isSignedIn ? () => router.push("/sign-up") : undefined,
            })}
            className={cn(
              "w-[520px] h-[190px] rounded-[18px] cursor-pointer",
              "flex flex-col justify-center items-center relative overflow-hidden",
              "transition-all duration-300"
            )}
            style={{
              background: isGlowing
                ? "linear-gradient(160deg, rgba(12,22,45,0.97), rgba(8,16,32,0.99))"
                : "linear-gradient(160deg, rgba(10,18,38,0.93), rgba(6,12,26,0.97))",
              border: isGlowing
                ? "1px solid rgba(110,231,255,0.55)"
                : "1px solid rgba(255,255,255,0.09)",
              borderTop: isGlowing
                ? "1.5px solid rgba(110,231,255,0.75)"
                : "1.5px solid rgba(255,255,255,0.22)",
              boxShadow: isGlowing
                ? "0 0 0 1px rgba(110,231,255,0.15), 0 30px 70px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.1), 0 0 50px rgba(110,231,255,0.12)"
                : "0 24px 60px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            <input {...getInputProps()} />

            {/* Inner top-rim highlight (the "open box" edge) */}
            <div
              style={{
                position: "absolute",
                top: 0, left: 0, right: 0,
                height: 48,
                background: "linear-gradient(180deg, rgba(255,255,255,0.045) 0%, transparent 100%)",
                borderRadius: "18px 18px 0 0",
                pointerEvents: "none",
              }}
            />

            {/* Subtle scanline texture */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.008) 3px, rgba(255,255,255,0.008) 6px)",
                borderRadius: 18,
                pointerEvents: "none",
              }}
            />

            {/* ── States ── */}
            {isUploading && selectedFile ? (
              <div className="w-full max-w-[400px] space-y-4 px-8">
                <div className="flex items-center justify-center gap-3">
                  <FileSpreadsheet className="h-5 w-5" style={{ color: "#22d3ee" }} />
                  <span className="text-sm font-medium text-white truncate max-w-[200px]">
                    {selectedFile.name}
                  </span>
                  <span className="text-xs" style={{ color: "#aaa" }}>
                    {formatBytes(selectedFile.size)}
                  </span>
                </div>
                <Progress value={uploadProgress} className="h-2 bg-white/10" />
                <p className="text-xs" style={{ color: "#888" }}>
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
                <p className="mt-1 max-w-sm text-xs text-red-300/70 px-4">{error}</p>
                <button
                  onClick={handleClear}
                  className="mt-3 text-xs hover:underline"
                  style={{ color: "#7dd3fc" }}
                >
                  Try again
                </button>
              </div>

            ) : selectedFile && !error ? (
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="h-5 w-5" style={{ color: "#22d3ee" }} />
                <span className="text-sm font-medium text-white">{selectedFile.name}</span>
                <span className="text-xs" style={{ color: "#aaa" }}>{formatBytes(selectedFile.size)}</span>
                <button
                  onClick={handleClear}
                  className="ml-2 rounded p-1 transition-colors hover:bg-white/10"
                  style={{ color: "#aaa" }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

            ) : !isSignedIn ? (
              /* Anonymous: show lock + CTA */
              <div className="flex flex-col items-center gap-2">
                <Lock className="h-7 w-7 mb-1" style={{ color: "#9060f8" }} />
                <p className="text-sm font-semibold text-white">Sign in to upload your data</p>
                <p className="text-[11px]" style={{ color: "#777", fontFamily: "'Geist Mono', monospace" }}>
                  Click to create a free account
                </p>
                <div
                  style={{
                    marginTop: 8,
                    padding: "7px 20px",
                    borderRadius: 8,
                    background: "linear-gradient(135deg, #9060f8, #e840c8)",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#fff",
                    boxShadow: "0 2px 16px rgba(144,96,248,0.45)",
                    letterSpacing: "0.01em",
                  }}
                >
                  Get started free →
                </div>
              </div>

            ) : (
              /* Default: drop zone prompt */
              <div className="flex flex-col items-center gap-2">
                <p
                  className="text-[13px] text-white"
                  style={{ letterSpacing: "0.1em", fontFamily: "'Geist Mono', monospace" }}
                >
                  DROP FILES OR{" "}
                  <span style={{ color: "#7dd3fc", fontWeight: 700 }}>BROWSE</span>
                </p>
                <p className="text-[11px]" style={{ color: "#4a4f5c", fontFamily: "'Geist Mono', monospace" }}>
                  up to 100 MB · CSV · TSV · XLS · JSON · Parquet
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Ground shadow for 3D grounding effect */}
        <div
          style={{
            margin: "6px auto 0",
            width: "60%",
            height: 18,
            background: "radial-gradient(ellipse, rgba(0,0,0,0.3) 0%, transparent 70%)",
            filter: "blur(6px)",
          }}
        />
      </div>

      {/* Sample data button */}
      {!isUploading && !selectedFile && onLoadSample && (
        <button
          onClick={onLoadSample}
          className="mt-4 text-[13px] transition-colors bg-transparent border-none cursor-pointer"
          style={{ color: "#7a7570" }}
        >
          ✎ Try with our sample{" "}
          <span style={{ color: "#111010", fontWeight: 500 }}>&quot;Sales Data&quot;</span> dataset.
        </button>
      )}

      {/* Signed-out hint */}
      {!isSignedIn && !isUploading && !selectedFile && (
        <p className="mt-2 text-[11px]" style={{ color: "#a09898", fontFamily: "'Geist Mono', monospace" }}>
          ✦ Sample data available without an account
        </p>
      )}

      {/* Error banner */}
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
