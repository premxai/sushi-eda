"use client";

import { FileUpload } from "@/components/FileUpload";

interface UploadCardProps {
  onFileAccepted: (file: File) => void;
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
  onClearError: () => void;
  onLoadSample?: () => void;
}

export default function UploadCard({ 
  onFileAccepted, 
  isUploading, 
  uploadProgress, 
  error, 
  onClearError,
  onLoadSample 
}: UploadCardProps) {
  return (
    <div className="mt-8 w-full max-w-[520px]">
      <FileUpload
        onFileAccepted={onFileAccepted}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        error={error}
        onClearError={onClearError}
        onLoadSample={onLoadSample}
      />
    </div>
  );
}
