/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import { EDAReport } from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" ? "/api" : "http://localhost:8000");

const client = axios.create({
  baseURL: API_BASE,
  timeout: 60_000, // async endpoints should return quickly; surface API wiring issues fast
});

type ClerkSessionLike = {
  getToken?: () => Promise<string | null>;
};

type ClerkLike = {
  session?: ClerkSessionLike | null;
};

type WindowWithClerk = Window & {
  Clerk?: ClerkLike;
};

async function getClerkToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const clerk = (window as WindowWithClerk).Clerk;
  const getToken = clerk?.session?.getToken;
  if (!getToken) return null;
  try {
    return await getToken();
  } catch {
    return null;
  }
}

export async function getBrowserClerkToken(): Promise<string | null> {
  return getClerkToken();
}

client.interceptors.request.use(async (config) => {
  const token = await getClerkToken();
  if (!token) return config;
  config.headers = config.headers ?? {};
  (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  return config;
});

export function getApiErrorMessage(
  error: unknown,
  fallback: string,
): string {
  const sanitizeDetail = (detail: string): string => {
    const normalized = detail.toLowerCase();

    if (
      normalized.includes("database_url missing") ||
      normalized.includes("database not configured")
    ) {
      return "Saved datasets are unavailable in this environment right now.";
    }

    return detail;
  };

  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) {
      return sanitizeDetail(detail);
    }
    if (Array.isArray(detail) && detail.length > 0) {
      return detail
        .map((item) =>
          typeof item === "string"
            ? sanitizeDetail(item)
            : typeof item?.msg === "string"
              ? sanitizeDetail(item.msg)
              : JSON.stringify(item),
        )
        .join(", ");
    }
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

/** Fire-and-forget ping to wake Render backend before user uploads. */
export function prewarmBackend(): void {
  client.get("/health", { timeout: 15_000 }).catch(() => {
    /* silent */
  });
}

/** Async upload — returns a dataset_id immediately; use useJobStream to track progress. */
export async function uploadFileAsync(
  file: File,
  orgId: string = "default",
  onProgress?: (percent: number) => void,
): Promise<{ dataset_id: string; status: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await client.post<{ dataset_id: string; status: string }>(
    `/datasets/upload?org_id=${orgId}`,
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => {
        if (e.total) {
          // Upload transfer = 0–50%; analysis phase = 50–99% (driven by SSE)
          onProgress?.(Math.round((e.loaded / e.total) * 50));
        }
      },
    },
  );
  return data;
}

/** Fetch a completed analysis by analysis_id. */
export async function fetchAnalysis(
  analysisId: string,
): Promise<{ report: EDAReport }> {
  const { data } = await client.get(`/analyses/${analysisId}`);
  return data;
}

export async function loadSampleData(): Promise<File> {
  const response = await fetch("/sample_sales.csv");
  const blob = await response.blob();
  return new File([blob], "sample_sales.csv", { type: "text/csv" });
}

/** Pre-analyzed example dataset seeded by the backend — null while it's still preparing. */
export async function fetchExampleDataset(): Promise<{ dataset_id: string; filename: string } | null> {
  try {
    const { data } = await client.get<{ dataset_id: string; filename: string }>("/example");
    return data;
  } catch {
    return null;
  }
}

export async function fetchDatasetVisualizations(
  datasetId: string,
  orgId: string = "default",
): Promise<Record<string, any>> {
  const { data } = await client.get(
    `/datasets/${datasetId}/visualize?org_id=${orgId}`,
  );
  return data;
}

export async function fetchColumnVisualization(
  datasetId: string,
  columnName: string,
  chartType: "auto" | "distribution" | "box_plot" | "categorical_bar" = "auto",
  orgId: string = "default",
): Promise<Record<string, any>> {
  const { data } = await client.get(
    `/datasets/${datasetId}/visualize/${encodeURIComponent(columnName)}`,
    { params: { chart_type: chartType, org_id: orgId } },
  );
  return data;
}

/** Anonymous product feedback from the floating widget. */
export async function submitFeedback(
  message: string,
  email?: string,
  page?: string,
): Promise<void> {
  await client.post("/feedback", { message, email, page });
}

export async function healthCheck(): Promise<boolean> {
  try {
    await client.get("/health");
    return true;
  } catch {
    return false;
  }
}

// ── AI Chat ───────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResult {
  sql: string | null;
  results: {
    columns: string[];
    rows: (string | number | null)[][];
    row_count: number;
    truncated: boolean;
  } | null;
  answer: string;
  error: string | null;
}

export async function askDataset(
  datasetId: string,
  question: string,
  chatHistory: ChatMessage[] = [],
  orgId: string = "default",
): Promise<ChatResult> {
  const { data } = await client.post<ChatResult>(
    `/datasets/${datasetId}/ai/chat?org_id=${orgId}`,
    { question, chat_history: chatHistory, limit: 500 },
  );
  return data;
}

/** Generate (or regenerate) the plain-English AI summary for the latest analysis. */
export async function regenerateNarrative(
  datasetId: string,
  orgId: string = "default",
): Promise<{ analysis_id: string; ai_narrative: string }> {
  const { data } = await client.post(
    `/datasets/${datasetId}/analysis/narrative?org_id=${orgId}`,
    {},
    { timeout: 90_000 }, // Claude call can take a while on large reports
  );
  return data;
}

export async function getAICleaningSuggestions(
  datasetId: string,
  orgId: string = "default",
): Promise<{ suggestions: any[] }> {
  const { data } = await client.get(
    `/datasets/${datasetId}/ai/cleaning-suggestions?org_id=${orgId}`,
  );
  return data;
}

// ── Datasets management ───────────────────────────────────────────────────────

export interface DatasetSummary {
  id: string;
  name: string;
  original_filename: string;
  file_format: string;
  file_size_bytes: number;
  row_count: number | null;
  column_count: number | null;
  status: string;
  is_starred: boolean;
  archived_at: string | null;
  created_at: string;
}

export async function listDatasets(
  orgId: string = "default",
  opts: { archived?: boolean; starred?: boolean } = {},
): Promise<DatasetSummary[]> {
  const params = new URLSearchParams({ org_id: orgId });
  if (opts.archived) params.set("archived", "true");
  if (opts.starred) params.set("starred", "true");
  const { data } = await client.get<DatasetSummary[]>(`/datasets?${params}`);
  return data;
}

export async function starDataset(
  datasetId: string,
  orgId: string = "default",
): Promise<void> {
  await client.patch(`/datasets/${datasetId}/star?org_id=${orgId}`);
}

export async function archiveDataset(
  datasetId: string,
  orgId: string = "default",
): Promise<void> {
  await client.patch(`/datasets/${datasetId}/archive?org_id=${orgId}`);
}

export async function restoreDataset(
  datasetId: string,
  orgId: string = "default",
): Promise<void> {
  await client.patch(`/datasets/${datasetId}/restore?org_id=${orgId}`);
}

export async function renameDataset(
  datasetId: string,
  name: string,
  orgId: string = "default",
): Promise<DatasetSummary> {
  const { data } = await client.patch<DatasetSummary>(
    `/datasets/${datasetId}/rename?org_id=${orgId}`,
    { name },
  );
  return data;
}

export interface AnalysisVersion {
  analysis_id: string;
  version: number;
  duration_seconds: number | null;
  created_at: string;
}

export async function listDatasetAnalyses(
  datasetId: string,
  orgId: string = "default",
): Promise<AnalysisVersion[]> {
  const { data } = await client.get<AnalysisVersion[]>(
    `/datasets/${datasetId}/analyses?org_id=${orgId}`,
  );
  return data;
}

export async function fetchDatasetAnalysis(
  datasetId: string,
  orgId: string = "default",
): Promise<{
  analysis_id: string;
  report: EDAReport;
  ai_narrative: string | null;
  version: number;
}> {
  const { data } = await client.get(
    `/datasets/${datasetId}/analysis?org_id=${orgId}`,
  );
  return data;
}

export interface CompareDatasetSummary {
  name: string;
  report: EDAReport;
}

export interface DatasetComparisonResult {
  file1: CompareDatasetSummary;
  file2: CompareDatasetSummary;
  comparison: {
    schema_diff: {
      file1_only: string[];
      file2_only: string[];
      common: string[];
    };
    row_count_diff: number;
    column_count_diff: number;
  };
}

export async function compareDatasets(
  file1: File,
  file2: File,
): Promise<DatasetComparisonResult> {
  const formData = new FormData();
  formData.append("file1", file1);
  formData.append("file2", file2);
  const { data } = await client.post<DatasetComparisonResult>(
    "/compare",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
  return data;
}

// ── Statistical Analysis ───────────────────────────────────────────────────────

export async function fetchAdvancedStats(
  datasetId: string,
  orgId: string = "default",
): Promise<Record<string, any>> {
  const { data } = await client.get(
    `/datasets/${datasetId}/stats/advanced?org_id=${orgId}`,
  );
  return data;
}

export async function runTTest(
  datasetId: string,
  col1: string,
  col2: string,
  orgId: string = "default",
): Promise<Record<string, any>> {
  const { data } = await client.post(
    `/datasets/${datasetId}/stats/ttest?col1=${encodeURIComponent(col1)}&col2=${encodeURIComponent(col2)}&org_id=${orgId}`,
  );
  return data;
}

export async function runChiSquare(
  datasetId: string,
  col1: string,
  col2: string,
  orgId: string = "default",
): Promise<Record<string, any>> {
  const { data } = await client.post(
    `/datasets/${datasetId}/stats/chi_square?col1=${encodeURIComponent(col1)}&col2=${encodeURIComponent(col2)}&org_id=${orgId}`,
  );
  return data;
}

export async function runANOVA(
  datasetId: string,
  numericCol: string,
  groupCol: string,
  orgId: string = "default",
): Promise<Record<string, any>> {
  const { data } = await client.post(
    `/datasets/${datasetId}/stats/anova?numeric_col=${encodeURIComponent(numericCol)}&group_col=${encodeURIComponent(groupCol)}&org_id=${orgId}`,
  );
  return data;
}

export async function runCorrelation(
  datasetId: string,
  col1: string,
  col2: string,
  method: string = "pearson",
  orgId: string = "default",
): Promise<Record<string, any>> {
  const { data } = await client.post(
    `/datasets/${datasetId}/stats/correlation?col1=${encodeURIComponent(col1)}&col2=${encodeURIComponent(col2)}&method=${method}&org_id=${orgId}`,
  );
  return data;
}

export async function runRegression(
  datasetId: string,
  xCol: string,
  yCol: string,
  orgId: string = "default",
): Promise<Record<string, any>> {
  const { data } = await client.post(
    `/datasets/${datasetId}/stats/regression?x_col=${encodeURIComponent(xCol)}&y_col=${encodeURIComponent(yCol)}&org_id=${orgId}`,
  );
  return data;
}

export async function runLogisticRegression(
  datasetId: string,
  xCol: string,
  yCol: string,
  positiveClass?: string,
  orgId: string = "default",
): Promise<Record<string, any>> {
  const positiveParam = positiveClass
    ? `&positive_class=${encodeURIComponent(positiveClass)}`
    : "";
  const { data } = await client.post(
    `/datasets/${datasetId}/stats/regression/logistic?x_col=${encodeURIComponent(xCol)}&y_col=${encodeURIComponent(yCol)}${positiveParam}&org_id=${orgId}`,
  );
  return data;
}

export async function runPolynomialRegression(
  datasetId: string,
  xCol: string,
  yCol: string,
  degree: number = 2,
  orgId: string = "default",
): Promise<Record<string, any>> {
  const { data } = await client.post(
    `/datasets/${datasetId}/stats/regression/polynomial?x_col=${encodeURIComponent(xCol)}&y_col=${encodeURIComponent(yCol)}&degree=${degree}&org_id=${orgId}`,
  );
  return data;
}

export async function runMannWhitney(
  datasetId: string,
  col1: string,
  col2: string,
  alternative: "two-sided" | "less" | "greater" = "two-sided",
  orgId: string = "default",
): Promise<Record<string, any>> {
  const { data } = await client.post(
    `/datasets/${datasetId}/stats/mann_whitney?col1=${encodeURIComponent(col1)}&col2=${encodeURIComponent(col2)}&alternative=${alternative}&org_id=${orgId}`,
  );
  return data;
}

export async function runTimeSeriesDecomposition(
  datasetId: string,
  dateCol: string,
  valueCol: string,
  period?: number,
  model: "additive" | "multiplicative" = "additive",
  orgId: string = "default",
): Promise<Record<string, any>> {
  const periodPart = period ? `&period=${period}` : "";
  const { data } = await client.post(
    `/datasets/${datasetId}/stats/time_series/decompose?date_col=${encodeURIComponent(dateCol)}&value_col=${encodeURIComponent(valueCol)}${periodPart}&model=${model}&org_id=${orgId}`,
  );
  return data;
}

export async function runArimaForecast(
  datasetId: string,
  dateCol: string,
  valueCol: string,
  options: {
    periods?: number;
    p?: number;
    d?: number;
    q?: number;
    alpha?: number;
  } = {},
  orgId: string = "default",
): Promise<Record<string, any>> {
  const periods = options.periods ?? 12;
  const p = options.p ?? 1;
  const d = options.d ?? 1;
  const q = options.q ?? 1;
  const alpha = options.alpha ?? 0.05;
  const { data } = await client.post(
    `/datasets/${datasetId}/stats/time_series/arima?date_col=${encodeURIComponent(dateCol)}&value_col=${encodeURIComponent(valueCol)}&periods=${periods}&p=${p}&d=${d}&q=${q}&alpha=${alpha}&org_id=${orgId}`,
  );
  return data;
}

export async function runCohortAnalysis(
  datasetId: string,
  entityCol: string,
  dateCol: string,
  freq: "D" | "W" | "M" | "Q" = "M",
  orgId: string = "default",
): Promise<Record<string, any>> {
  const { data } = await client.post(
    `/datasets/${datasetId}/stats/cohort?entity_col=${encodeURIComponent(entityCol)}&date_col=${encodeURIComponent(dateCol)}&freq=${freq}&org_id=${orgId}`,
  );
  return data;
}

export async function runABTestSignificance(
  datasetId: string,
  controlConversions: number,
  controlTotal: number,
  variantConversions: number,
  variantTotal: number,
  alpha: number = 0.05,
  orgId: string = "default",
): Promise<Record<string, any>> {
  const { data } = await client.post(
    `/datasets/${datasetId}/stats/ab_test?control_conversions=${controlConversions}&control_total=${controlTotal}&variant_conversions=${variantConversions}&variant_total=${variantTotal}&alpha=${alpha}&org_id=${orgId}`,
  );
  return data;
}

// ── SQL Query Editor ───────────────────────────────────────────────────────────

export interface QuerySchemaColumn {
  name: string;
  dtype: string;
}

export async function fetchQuerySchema(
  datasetId: string,
  orgId: string = "default",
): Promise<QuerySchemaColumn[]> {
  const { data } = await client.get<{
    schema: Array<{ column: string; type: string }>;
  }>(`/datasets/${datasetId}/query/schema?org_id=${orgId}`);
  return data.schema.map((col) => ({ name: col.column, dtype: col.type }));
}

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  row_count: number;
  truncated: boolean;
  offset: number;
  limit: number;
  has_more: boolean;
  execution_time_ms?: number;
}

export async function runSQLQuery(
  datasetId: string,
  sql: string,
  limit: number = 1000,
  offset: number = 0,
  orgId: string = "default",
): Promise<QueryResult> {
  const { data } = await client.post<QueryResult>(
    `/datasets/${datasetId}/query?org_id=${orgId}`,
    { sql, limit, offset },
  );
  return data;
}

export interface QueryExplainResult {
  plan: string;
}

export async function explainSQLQuery(
  datasetId: string,
  sql: string,
  orgId: string = "default",
): Promise<QueryExplainResult> {
  const { data } = await client.post<QueryExplainResult>(
    `/datasets/${datasetId}/query/explain?org_id=${orgId}`,
    { sql },
  );
  return data;
}

// ── Shares ────────────────────────────────────────────────────────────────────

export interface SharedReport {
  token: string;
  dataset_name: string;
  expires_at: string;
  analysis: {
    analysis_id: string;
    version: number;
    ai_narrative: string | null;
    duration_seconds: number | null;
    created_at: string;
    report: EDAReport;
  };
}

export interface ShareLinkResult {
  token: string;
  share_url: string;
  expires_at: string;
  ttl_hours: number;
}

export async function createDatasetShare(
  datasetId: string,
  ttlHours: number = 168,
  orgId: string = "default",
): Promise<ShareLinkResult> {
  const { data } = await client.post<ShareLinkResult>(
    `/datasets/${datasetId}/share?org_id=${orgId}`,
    { ttl_hours: ttlHours },
  );
  return data;
}

export async function revokeDatasetShare(
  datasetId: string,
  token: string,
  orgId: string = "default",
): Promise<void> {
  await client.delete(`/datasets/${datasetId}/share/${token}?org_id=${orgId}`);
}

export async function getSharedReport(token: string): Promise<SharedReport> {
  const { data } = await client.get<SharedReport>(`/share/${token}`);
  return data;
}
