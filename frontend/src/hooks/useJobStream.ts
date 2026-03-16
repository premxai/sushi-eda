/**
 * useJobStream — React hook that opens an SSE stream for a dataset analysis job.
 *
 * Usage:
 *   const { status, progress, error, analysisId } = useJobStream(datasetId, orgId);
 *
 * The hook automatically:
 *   - Opens the SSE connection as soon as datasetId is non-null
 *   - Updates status in real time as events arrive
 *   - Closes the connection on job_done, job_failed, or component unmount
 *   - Falls back to polling every 3s if SSE isn't supported
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/api";

export type JobStatus = "pending" | "processing" | "done" | "failed" | "idle";

interface JobStreamState {
  status: JobStatus;
  progress: number; // 0–100
  stage: string; // e.g. "analyzing", "saving"
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

export function useJobStream(
  datasetId: string | null,
  orgId: string = "default",
): JobStreamState {
  const [state, setState] = useState<JobStreamState>(INITIAL_STATE);
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!datasetId) {
      setState(INITIAL_STATE);
      return;
    }

    setState({ ...INITIAL_STATE, status: "pending" });

    // ── SSE path ──────────────────────────────────────────────────────────────
    if (typeof EventSource !== "undefined") {
      const url = `${API_BASE}/jobs/${datasetId}/stream?org_id=${orgId}`;
      const es = new EventSource(url);
      esRef.current = es;

      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data) as Record<string, unknown>;
          const event = payload.event as string;

          if (event === "heartbeat") return;

          if (event === "status") {
            setState((prev) => ({
              ...prev,
              status: (payload.status as JobStatus) ?? prev.status,
              progress: (payload.progress as number) ?? prev.progress,
              stage: (payload.stage as string) ?? prev.stage,
            }));
            return;
          }

          if (event === "job_done") {
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

          if (event === "job_failed") {
            setState({
              status: "failed",
              progress: 0,
              stage: "",
              analysisId: null,
              error: (payload.error as string) ?? "Analysis failed",
              durationSeconds: null,
            });
            es.close();
            return;
          }

          if (event === "timeout") {
            setState((prev) => ({
              ...prev,
              status: "failed",
              error: "Analysis timed out. Please try again.",
            }));
            es.close();
          }
        } catch {
          // ignore malformed messages
        }
      };

      es.onerror = () => {
        // SSE connection dropped — fall back to polling
        es.close();
        _startPolling(datasetId, orgId, setState, pollRef);
      };

      return () => {
        es.close();
        esRef.current = null;
        _clearPolling(pollRef);
      };
    }

    // ── Polling fallback (no EventSource) ─────────────────────────────────────
    _startPolling(datasetId, orgId, setState, pollRef);
    return () => _clearPolling(pollRef);
  }, [datasetId, orgId]);

  return state;
}

// ── Polling helper ────────────────────────────────────────────────────────────

function _startPolling(
  datasetId: string,
  orgId: string,
  setState: React.Dispatch<React.SetStateAction<JobStreamState>>,
  pollRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>,
) {
  _clearPolling(pollRef);

  pollRef.current = setInterval(async () => {
    try {
      const res = await fetch(`${API_BASE}/jobs/${datasetId}?org_id=${orgId}`);
      if (!res.ok) return;
      const payload = await res.json();
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

      if (status === "done" || status === "failed") {
        _clearPolling(pollRef);
      }
    } catch {
      // network error — keep polling
    }
  }, 3000);
}

function _clearPolling(
  pollRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>,
) {
  if (pollRef.current !== null) {
    clearInterval(pollRef.current);
    pollRef.current = null;
  }
}
