"use client";

import React, { useCallback, useState } from "react";
import Link from "next/link";
import { useDropzone, FileRejection } from "react-dropzone";
import { AlertCircle, File as FileIcon, Lock, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/formatters";
import { MAX_UPLOAD_BYTES, SUPPORTED_FILE_ACCEPT, SUPPORTED_FORMATS_COPY, SUPPORTED_FORMATS_LIST } from "@/lib/api";
import type { AuthIntent } from "@/lib/auth-gate";

interface UploadDropzoneProps {
  onFileAccepted: (file: File) => void;
  onSample: () => void;
  disabled?: boolean;
  hero?: boolean;
  requiresSignIn?: boolean;
  onSignInRequired?: (intent: AuthIntent) => void;
}

type LocalState = "idle" | "selected";

export function UploadDropzone({ onFileAccepted, onSample, disabled, hero = false, requiresSignIn = false, onSignInRequired }: UploadDropzoneProps) {
  const [state, setState] = useState<LocalState>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rejection, setRejection] = useState<{ kind: "size" | "format"; message: string } | null>(null);

  const onDrop = useCallback(
    (accepted: File[], rejections: FileRejection[]) => {
      if (requiresSignIn) {
        onSignInRequired?.("upload");
        return;
      }
      setRejection(null);
      if (rejections.length > 0) {
        const [{ file, errors }] = rejections;
        const isTooLarge = errors.some((e) => e.code === "file-too-large");
        setRejection({
          kind: isTooLarge ? "size" : "format",
          message: isTooLarge
            ? `"${file.name}" is ${formatBytes(file.size)}, that's over the 25 MB limit. Try a smaller export, or split it into parts.`
            : `"${file.name}" isn't a format Sushi can read yet. Use ${SUPPORTED_FORMATS_COPY}.`,
        });
        return;
      }
      const file = accepted[0];
      if (!file) return;
      setSelectedFile(file);
      setState("selected");
      window.setTimeout(() => onFileAccepted(file), 450);
    },
    [onFileAccepted, onSignInRequired, requiresSignIn],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: SUPPORTED_FILE_ACCEPT,
    maxSize: MAX_UPLOAD_BYTES,
    multiple: false,
    noClick: requiresSignIn,
    noKeyboard: requiresSignIn,
    disabled,
  });
  const rootProps = getRootProps();

  if (requiresSignIn) {
    return (
      <div className={hero ? "hero-upload-card" : undefined}>
        <Link
          href="/sign-in?intent=upload"
          aria-label="Sign in to upload a file"
          className={cn(
            "block w-full cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center shadow-lg backdrop-blur transition-colors hover:border-brand/50",
            hero && "hero-dropzone",
            "border-brand/30 bg-surface/80",
          )}
        >
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-brand/30 bg-brand-weak">
            <UploadCloud className="h-6 w-6 text-brand" />
          </span>
          <span className="mt-4 block text-[20px] font-semibold text-ink">Drop your file here</span>
          <span className="mt-1 block text-[14px] font-medium text-brand">or click to browse</span>
          <span className="mt-2 block text-[12.5px] text-ink-tertiary">{hero ? `6 formats: ${SUPPORTED_FORMATS_LIST}` : `${SUPPORTED_FORMATS_COPY} · up to 25 MB`}</span>
          {!hero && <span className="mx-auto my-5 block h-px max-w-[16rem] bg-border" />}
          {!hero && <span className="flex items-center justify-center gap-1.5 text-[12px] text-ink-tertiary"><Lock className="h-3.5 w-3.5" />Private by default. You choose whether to create a share link.</span>}
        </Link>
        {hero && <div className="hero-privacy-pill"><Lock className="h-3.5 w-3.5" /> Your data is private and never shared.</div>}
        <div className={cn("mt-3 text-center", hero && "hero-sample-link")}>
          <Link href="/sign-in?intent=sample" className="text-[13px] font-medium text-ink-secondary underline underline-offset-2 hover:text-ink">Try sample data</Link>
        </div>
      </div>
    );
  }

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
    <div className={hero ? "hero-upload-card" : undefined}>
      <div
        {...rootProps}
        data-sign-in-required={requiresSignIn ? "true" : "false"}
        onClick={(event) => {
          if (requiresSignIn) {
            event.preventDefault();
            event.stopPropagation();
            onSignInRequired?.("upload");
            return;
          }
          rootProps.onClick?.(event);
        }}
        className={cn(
          "cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center shadow-lg backdrop-blur transition-colors",
          hero && "hero-dropzone",
          isDragActive ? "border-brand bg-brand-weak" : "border-brand/30 bg-surface/80 hover:border-brand/50",
        )}
      >
        <input {...getInputProps()} aria-label="Upload a data file" />
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-brand/30 bg-brand-weak">
          <UploadCloud className="h-6 w-6 text-brand" />
        </div>
        <p className="mt-4 text-[20px] font-semibold text-ink">Drop your file here</p>
        <p className="mt-1 text-[14px] font-medium text-brand">or click to browse</p>
        <p className="mt-2 text-[12.5px] text-ink-tertiary">{hero ? `6 formats: ${SUPPORTED_FORMATS_LIST}` : `${SUPPORTED_FORMATS_COPY} · up to 25 MB`}</p>

        {!hero && <div className="mx-auto my-5 h-px max-w-[16rem] bg-border" />}

        {!hero && <p className="flex items-center justify-center gap-1.5 text-[12px] text-ink-tertiary">
          <Lock className="h-3.5 w-3.5" />
          Private by default. You choose whether to create a share link.
        </p>}
      </div>

      {hero && <div className="hero-privacy-pill"><Lock className="h-3.5 w-3.5" /> Your data is private and never shared.</div>}

      <div className={cn("mt-3 text-center", hero && "hero-sample-link")}>
        <button
          onClick={() => requiresSignIn ? onSignInRequired?.("sample") : onSample()}
          disabled={disabled}
          className="text-[13px] font-medium text-ink-secondary underline underline-offset-2 hover:text-ink disabled:opacity-50"
        >
          Try sample data
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
