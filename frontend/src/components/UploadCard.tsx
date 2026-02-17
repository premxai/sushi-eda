"use client";

import { FileUpload } from "@/components/FileUpload";

interface UploadCardProps {
  onFileAccepted: (file: File) => void;
  isUploading: boolean;
  uploadProgress: number;
  error: string | null;
  onClearError: () => void;
}

export default function UploadCard({ 
  onFileAccepted, 
  isUploading, 
  uploadProgress, 
  error, 
  onClearError 
}: UploadCardProps) {
  return (
    <div className="
      mt-16
      w-full
      max-w-[640px]
      rounded-[24px]
      border
      border-neutral-200
      bg-white/80
      backdrop-blur-xl
      shadow-[0_10px_30px_rgba(0,0,0,0.08)]
      hover:scale-[1.01]
      transition-all
      overflow-hidden
    ">
      <FileUpload
        onFileAccepted={onFileAccepted}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        error={error}
        onClearError={onClearError}
      />
    </div>
  );
}
