"use client";

import { UploadDropzone } from "@/components/upload/UploadDropzone";
import { UploadProgress } from "@/components/upload/UploadProgress";
import { JobStatus } from "@/hooks/useJobStream";

export interface HeroUploadCardProps {
  isUploading: boolean;
  jobStatus: JobStatus;
  jobProgress: number;
  jobStage: string;
  jobError: string | null;
  onFileAccepted: (file: File) => void;
  uploadRequiresAuthentication: boolean;
  onAuthenticationRequired: () => void;
  onSample: () => void;
  onRetry: () => void;
}

/** The desktop upload surface. The underlying dropzone and progress contracts stay unchanged. */
export function HeroUploadCard({
  isUploading,
  jobStatus,
  jobProgress,
  jobStage,
  jobError,
  onFileAccepted,
  uploadRequiresAuthentication,
  onAuthenticationRequired,
  onSample,
  onRetry,
}: HeroUploadCardProps) {
  return (
    <div id="upload-desktop" className="hero-reference-upload">
      {isUploading ? (
        <UploadProgress status={jobStatus} progress={jobProgress} stage={jobStage} error={jobError} onRetry={onRetry} />
      ) : (
        <UploadDropzone hero onFileAccepted={onFileAccepted} onSample={onSample} uploadRequiresAuthentication={uploadRequiresAuthentication} onAuthenticationRequired={onAuthenticationRequired} />
      )}
    </div>
  );
}
