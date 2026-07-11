"use client";

import { useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/api";
import { getSupabaseAccessToken } from "@/lib/supabase/client";

export type JobStatus = "idle" | "pending" | "processing" | "done" | "failed";

interface JobStreamState {
  status: JobStatus;
  progress: number;
  stage: string;
  analysisId: string | null;
  error: string | null;
  durationSeconds: number | null;
}

const INITIAL_STATE: JobStreamState = {
  status: "idle",
  progress: 0,
  stage: "",
  analysisId: null,
  error: null,
  durationSeconds: null,
};

/** Tracks an analysis job via SSE, falling back to polling if EventSource
 * is unavailable or the stream errors out. */
export function useJobStream(datasetId: string | null, orgId: string = "default"): JobStreamState {
  const [state, setState] = useState<JobStreamState>(INITIAL_STATE);
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!datasetId) {
      setState(INITIAL_STATE);
      return;
    }

    setState({ ...INITIAL_STATE, status: "pending" });

    const start = async () => {
      const token = await getSupabaseAccessToken();
      if (typeof EventSource !== "undefined") {
      const params = new URLSearchParams({ org_id: orgId });
      if (token) params.set("token", token);
      const es = new EventSource(`${API_BASE}/jobs/${datasetId}/stream?${params.toString()}`);
      esRef.current = es;

      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as Record<string, unknown>;
          const type = payload.event as string;

          if (type === "heartbeat") return;

          if (type === "status") {
            setState((prev) => ({
              ...prev,
              status: (payload.status as JobStatus) ?? prev.status,
              progress: (payload.progress as number) ?? prev.progress,
              stage: (payload.stage as string) ?? prev.stage,
            }));
            return;
          }

          if (type === "job_done") {
            setState({
              status: "done",
              progress: 100,
              stage: "complete",
              analysisId: (payload.analysis_id as string) ?? null,
              error: null,
              durationSeconds: (payload.duration_seconds as number) ?? null,
            });
            es.close();
            return;
          }

          if (type === "job_failed" || type === "error") {
            setState({
              status: "failed",
              progress: 0,
              stage: "",
              analysisId: null,
              error: (payload.error as string) ?? (payload.detail as string) ?? "Analysis failed",
              durationSeconds: null,
            });
            es.close();
            return;
          }

          if (type === "timeout") {
            setState((prev) => ({ ...prev, status: "failed", error: "Analysis timed out. Please try again." }));
            es.close();
          }
        } catch {
          // Ignore malformed SSE payloads.
        }
      };

      es.onerror = () => {
        es.close();
        startPolling(datasetId, orgId, token, setState, pollRef);
      };
      } else {
        startPolling(datasetId, orgId, token, setState, pollRef);
      }
    };
    start();

    return () => {
      esRef.current?.close();
      esRef.current = null;
      clearPolling(pollRef);
    };
  }, [datasetId, orgId]);

  return state;
}

function startPolling(
  datasetId: string,
  orgId: string,
  token: string | null,
  setState: React.Dispatch<React.SetStateAction<JobStreamState>>,
  pollRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>,
) {
  clearPolling(pollRef);
  pollRef.current = setInterval(async () => {
    try {
      const response = await fetch(`${API_BASE}/jobs/${datasetId}?org_id=${orgId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) return;
      const payload = await response.json();
      const status: JobStatus = payload.status ?? "pending";

      setState((prev) => ({
        ...prev,
        status,
        progress: payload.progress ?? prev.progress,
        stage: payload.stage ?? prev.stage,
        analysisId: payload.analysis_id ?? prev.analysisId,
        error: payload.error ?? prev.error,
        durationSeconds: payload.duration_seconds ?? prev.durationSeconds,
      }));

      if (status === "done" || status === "failed") clearPolling(pollRef);
    } catch {
      // Keep polling through transient network failures.
    }
  }, 3000);
}

function clearPolling(pollRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>) {
  if (pollRef.current !== null) {
    clearInterval(pollRef.current);
    pollRef.current = null;
  }
}
