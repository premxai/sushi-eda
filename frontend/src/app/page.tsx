"use client";

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useJobStream } from "@/hooks/useJobStream";
import { LandingHero } from "@/components/landing/LandingHero";
import { ReportShell } from "@/components/report/ReportShell";
import {
  fetchAnalysis,
  fetchDatasetAnalysis,
  fetchExampleDataset,
  getApiErrorMessage,
  loadSampleData,
  prewarmBackend,
  uploadFileAsync,
} from "@/lib/api";
import { EDAReport } from "@/lib/types";

const REPORT_KEY = "sushi_report";
const FILE_KEY = "sushi_filename";
const DATASET_KEY = "sushi_dataset_id";
const NARRATIVE_KEY = "sushi_narrative";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [report, setReport] = useState<EDAReport | null>(null);
  const [fileName, setFileName] = useState("");
  const [openDatasetId, setOpenDatasetId] = useState<string | null>(null);
  const [aiNarrative, setAiNarrative] = useState<string | null>(null);
  const [pendingDatasetId, setPendingDatasetId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    prewarmBackend();
  }, []);

  // Restore the last session's report so a refresh doesn't lose the user's work.
  useEffect(() => {
    const stored = sessionStorage.getItem(REPORT_KEY);
    if (!stored) return;
    try {
      setReport(JSON.parse(stored));
      setFileName(sessionStorage.getItem(FILE_KEY) || "dataset");
      setOpenDatasetId(sessionStorage.getItem(DATASET_KEY));
      setAiNarrative(sessionStorage.getItem(NARRATIVE_KEY) || null);
    } catch {
      sessionStorage.removeItem(REPORT_KEY);
    }
  }, []);

  const jobStream = useJobStream(pendingDatasetId);

  useEffect(() => {
    if (jobStream.status === "done" && jobStream.analysisId && pendingDatasetId) {
      fetchAnalysis(jobStream.analysisId)
        .then((data) => {
          setReport(data.report);
          setOpenDatasetId(pendingDatasetId);
          setAiNarrative(data.ai_narrative ?? null);
          sessionStorage.setItem(REPORT_KEY, JSON.stringify(data.report));
          sessionStorage.setItem(FILE_KEY, fileName || "dataset");
          sessionStorage.setItem(DATASET_KEY, pendingDatasetId);
          if (data.ai_narrative) sessionStorage.setItem(NARRATIVE_KEY, data.ai_narrative);
          setIsUploading(false);
          setPendingDatasetId(null);
        })
        .catch(() => {
          setError("Analysis finished but the report failed to load. Please try again.");
          setIsUploading(false);
          setPendingDatasetId(null);
        });
    }
    if (jobStream.status === "failed") {
      setIsUploading(false);
    }
  }, [jobStream.status, jobStream.analysisId, pendingDatasetId, fileName]);

  const handleFileAccepted = useCallback(async (file: File) => {
    setReport(null);
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);
    setFileName(file.name);
    setPendingDatasetId(null);
    sessionStorage.removeItem(REPORT_KEY);

    try {
      const result = await uploadFileAsync(file, "default", setUploadProgress);
      setPendingDatasetId(result.dataset_id);
    } catch (err) {
      setError(getApiErrorMessage(err, "Upload failed. Please try again."));
      setIsUploading(false);
    }
  }, []);

  const handleSample = useCallback(async () => {
    try {
      const example = await fetchExampleDataset();
      if (example) {
        setIsUploading(true);
        try {
          const data = await fetchDatasetAnalysis(example.dataset_id);
          setReport(data.report);
          setFileName(example.filename);
          setOpenDatasetId(example.dataset_id);
          setAiNarrative(data.ai_narrative ?? null);
          sessionStorage.setItem(REPORT_KEY, JSON.stringify(data.report));
          sessionStorage.setItem(FILE_KEY, example.filename);
          sessionStorage.setItem(DATASET_KEY, example.dataset_id);
          setIsUploading(false);
          return;
        } catch {
          setIsUploading(false);
        }
      }
    } catch {
      // fall through to uploading the sample file fresh
    }
    const file = await loadSampleData();
    handleFileAccepted(file);
  }, [handleFileAccepted]);

  const handleOpenDataset = useCallback(async (datasetId: string, filename?: string) => {
    setError(null);
    setIsUploading(true);
    try {
      const data = await fetchDatasetAnalysis(datasetId);
      setReport(data.report);
      setFileName(filename || "dataset");
      setOpenDatasetId(datasetId);
      setAiNarrative(data.ai_narrative ?? null);
      sessionStorage.setItem(REPORT_KEY, JSON.stringify(data.report));
      sessionStorage.setItem(FILE_KEY, filename || "dataset");
      sessionStorage.setItem(DATASET_KEY, datasetId);
    } catch (err) {
      setError(getApiErrorMessage(err, "Couldn't open that dataset."));
    } finally {
      setIsUploading(false);
    }
  }, []);

  // Support /?open=<datasetId>&name=<filename> links from the datasets library.
  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId) return;
    router.replace("/");
    handleOpenDataset(openId, searchParams.get("name") || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleNewFile = useCallback(() => {
    setReport(null);
    setFileName("");
    setOpenDatasetId(null);
    setAiNarrative(null);
    setPendingDatasetId(null);
    setIsUploading(false);
    setError(null);
    sessionStorage.removeItem(REPORT_KEY);
    sessionStorage.removeItem(FILE_KEY);
    sessionStorage.removeItem(DATASET_KEY);
    sessionStorage.removeItem(NARRATIVE_KEY);
  }, []);

  if (report) {
    return (
      <ReportShell
        report={report}
        fileName={fileName}
        datasetId={openDatasetId}
        aiNarrative={aiNarrative}
        onNewFile={handleNewFile}
        onOpenDataset={handleOpenDataset}
      />
    );
  }

  return (
    <LandingHero
      isUploading={isUploading}
      jobStatus={jobStream.status}
      jobProgress={isUploading ? Math.max(uploadProgress, jobStream.progress) : 0}
      jobStage={jobStream.stage}
      jobError={jobStream.error}
      topError={error}
      onClearTopError={() => setError(null)}
      onFileAccepted={handleFileAccepted}
      onSample={handleSample}
      onRetry={handleNewFile}
    />
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
