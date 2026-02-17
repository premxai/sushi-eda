"use client";

import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploaderProps {
  onFileSelected: (file: File) => void;
  isLoading: boolean;
}

export function FileUploader({ onFileSelected, isLoading }: FileUploaderProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileSelected(acceptedFiles[0]);
      }
    },
    [onFileSelected]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "application/json": [".json"],
    },
    maxFiles: 1,
    disabled: isLoading,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 transition-all cursor-pointer",
        isDragActive
          ? "border-primary/60 bg-primary/5"
          : "border-border hover:border-primary/40 hover:bg-muted/50",
        isLoading && "pointer-events-none opacity-60"
      )}
    >
      <input {...getInputProps()} />
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        {isDragActive ? (
          <FileSpreadsheet className="h-8 w-8 text-primary" />
        ) : (
          <Upload className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      <div className="text-center">
        <p className="text-base font-medium">
          {isDragActive ? "Drop your file here" : "Drag & drop your dataset"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          CSV, Excel, or JSON — up to 100 MB
        </p>
      </div>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm font-medium">Analyzing...</span>
          </div>
        </div>
      )}
    </div>
  );
}
