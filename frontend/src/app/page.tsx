"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useJobStream } from "@/hooks/useJobStream";
import { LandingHero } from "@/components/landing/LandingHero";
import { ReportShell } from "@/components/report/ReportShell";
import {
  fetchAnalysis,
  fetchDatasetAnalysis,
  fetchExampleDataset,
  getApiErrorMessage,
  prewarmBackend,
  uploadFileAsync,
} from "@/lib/api";
import { EDAReport } from "@/lib/types";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

const REPORT_KEY = "sushi_report";
const FILE_KEY = "sushi_filename";
const DATASET_KEY = "sushi_dataset_id";
const NARRATIVE_KEY = "sushi_narrative";
const SAMPLE_MODE_KEY = "sushi_sample_mode";

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const [isSampleMode, setIsSampleMode] = useState(false);
  const sampleRequestedRef = useRef(false);

  useEffect(() => {
    prewarmBackend();
    if (!isSupabaseConfigured) {
      setAuthResolved(true);
      return;
    }
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession()
      .then(({ data }) => setIsAuthenticated(Boolean(data.session)))
      // Never leave an upload workspace blank if the browser has a temporary
      // auth-network failure. Protected requests still require a valid token.
      .catch(() => setIsAuthenticated(false))
      .finally(() => setAuthResolved(true));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session));
      setAuthResolved(true);
    });
    return () => subscription.subscription.unsubscribe();
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
      setIsSampleMode(sessionStorage.getItem(SAMPLE_MODE_KEY) === "1");
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
          // Keep the upload identifier in the address bar until the finished
          // report is mounted. Removing it earlier made a refresh or route
          // update fall back to the landing flow while analysis was running.
          router.replace("/");
        })
        .catch(() => {
          setError("Analysis finished but the report failed to load. Please try again.");
          setIsUploading(false);
          // Preserve the pending identifier so this authenticated workspace
          // can be resumed after a refresh instead of returning to landing.
        });
    }
    if (jobStream.status === "failed") {
      setIsUploading(false);
    }
  }, [jobStream.status, jobStream.analysisId, pendingDatasetId, fileName, router]);

  const handleFileAccepted = useCallback(async (file: File, allowGuestUpload = false) => {
    if (!allowGuestUpload && !isAuthenticated) {
      router.push("/sign-in?next=/");
      return;
    }
    setReport(null);
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);
    setFileName(file.name);
    setPendingDatasetId(null);
    setIsSampleMode(false);
    sessionStorage.removeItem(REPORT_KEY);
    sessionStorage.removeItem(SAMPLE_MODE_KEY);

    try {
      const result = await uploadFileAsync(file, "default", setUploadProgress);
      setPendingDatasetId(result.dataset_id);
    } catch (err) {
      setError(getApiErrorMessage(err, "Upload failed. Please try again."));
      setIsUploading(false);
    }
  }, [router, isAuthenticated]);

  const handleAuthenticationRequired = useCallback(() => {
    router.push("/sign-in?next=/");
  }, [router]);

  const handleSample = useCallback(async () => {
    setError(null);
    setIsUploading(true);
    setIsSampleMode(true);
    const example = await fetchExampleDataset();
    if (!example) {
      setIsUploading(false);
      setError("The sample report is preparing. Please try again in a few seconds.");
      return;
    }
    try {
      const data = await fetchDatasetAnalysis(example.dataset_id);
      setReport(data.report);
      setFileName(example.filename);
      setOpenDatasetId(example.dataset_id);
      setAiNarrative(data.ai_narrative ?? null);
      sessionStorage.setItem(REPORT_KEY, JSON.stringify(data.report));
      sessionStorage.setItem(FILE_KEY, example.filename);
      sessionStorage.setItem(DATASET_KEY, example.dataset_id);
      sessionStorage.setItem(SAMPLE_MODE_KEY, "1");
    } catch (err) {
      setError(getApiErrorMessage(err, "Couldn't load the sample data. Please try again."));
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleOpenDataset = useCallback(async (datasetId: string, filename?: string) => {
    setError(null);
    setIsUploading(true);
    setIsSampleMode(false);
    try {
      const data = await fetchDatasetAnalysis(datasetId);
      setReport(data.report);
      setFileName(filename || "dataset");
      setOpenDatasetId(datasetId);
      setAiNarrative(data.ai_narrative ?? null);
      sessionStorage.setItem(REPORT_KEY, JSON.stringify(data.report));
      sessionStorage.setItem(FILE_KEY, filename || "dataset");
      sessionStorage.setItem(DATASET_KEY, datasetId);
      sessionStorage.removeItem(SAMPLE_MODE_KEY);
    } catch (err) {
      setError(getApiErrorMessage(err, "Couldn't open that dataset."));
    } finally {
      setIsUploading(false);
    }
  }, []);

  useEffect(() => {
    if (searchParams.get("sample") !== "1" || sampleRequestedRef.current) return;
    sampleRequestedRef.current = true;
    router.replace("/");
    handleSample();
  }, [handleSample, router, searchParams]);

  // The dedicated new-file page starts work, then hands the live job back to
  // this workspace so report rendering and SSE handling stay in one place.
  useEffect(() => {
    const pendingId = searchParams.get("pending");
    if (!pendingId) return;
    setReport(null);
    setFileName(searchParams.get("name") || "dataset");
    setOpenDatasetId(null);
    setAiNarrative(null);
    setPendingDatasetId(pendingId);
    setIsSampleMode(false);
    setIsUploading(true);
    setError(null);
    sessionStorage.removeItem(SAMPLE_MODE_KEY);
  }, [searchParams]);

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
    sessionStorage.removeItem(SAMPLE_MODE_KEY);
    router.replace(isAuthenticated ? "/new-file" : "/");
  }, [isAuthenticated, router]);

  const isPublicWorkflow = searchParams.get("sample") === "1" || Boolean(searchParams.get("pending")) || Boolean(searchParams.get("open")) || Boolean(pendingDatasetId) || sampleRequestedRef.current || isSampleMode;

  useEffect(() => {
    if (authResolved && isAuthenticated && !isPublicWorkflow && !report && !isUploading) {
      router.replace("/dashboard");
    }
  }, [authResolved, isAuthenticated, isPublicWorkflow, isUploading, report, router]);

  if (!authResolved) {
    return (
      <main className="app-paper-page grid min-h-screen place-items-center p-6 text-center">
        <div>
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand" />
          <p className="mt-4 text-[15px] font-semibold text-ink">Opening your workspace…</p>
          <p className="mt-1.5 text-[13px] text-ink-secondary">Your analysis will stay here while it finishes.</p>
        </div>
      </main>
    );
  }

  if (isAuthenticated && !isPublicWorkflow && !report && !isUploading) {
    return null;
  }

  if (report) {
    return (
      <ReportShell
        report={report}
        fileName={fileName}
        datasetId={openDatasetId}
        aiNarrative={aiNarrative}
        isSampleMode={isSampleMode}
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
      uploadRequiresAuthentication={!isAuthenticated}
      onAuthenticationRequired={handleAuthenticationRequired}
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
