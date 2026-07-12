/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import { EDAReport } from "./types";
import { getSupabaseAccessToken } from "@/lib/supabase/client";

// Supabase sessions are forwarded as bearer tokens. With no Supabase variables
// configured, local development intentionally falls back to the backend demo mode.
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" ? "/api" : "http://localhost:8000");

// Uploads may bypass a hosting proxy when it has multipart body limits. Keep
// ordinary reads on /api, while a configured direct backend is used as a
// resilient fallback for file transfer.
const UPLOAD_API_BASE = process.env.NEXT_PUBLIC_UPLOAD_API_URL?.replace(/\/$/, "");

const client = axios.create({
  baseURL: API_BASE,
  timeout: 60_000,
});

client.interceptors.request.use(async (config) => {
  const accessToken = await getSupabaseAccessToken();
  if (accessToken) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

export function getApiErrorMessage(error: unknown, fallback: string): string {
  const sanitizeDetail = (detail: string): string => {
    const normalized = detail.toLowerCase();
    if (normalized.includes("database_url missing") || normalized.includes("database not configured")) {
      return "Saved datasets are unavailable in this environment right now.";
    }
    return detail;
  };

  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) {
      return "Your sign-in session is missing or expired. Please sign in again, then retry.";
    }
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
    if (error.code === "ECONNABORTED") {
      return "The upload took too long to reach Sushi. Please retry; your file was not saved twice.";
    }
    if (!error.response) {
      return "Sushi’s upload service could not be reached. Check your connection and retry.";
    }
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

/** True when the error is an HTTP 429 (upload or AI rate limit exceeded). */
export function isRateLimitError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 429;
}

/** Fire-and-forget ping to wake a sleeping backend before user uploads. */
export function prewarmBackend(): void {
  client.get("/health", { timeout: 15_000 }).catch(() => {});
}

export async function healthCheck(): Promise<boolean> {
  try {
    await client.get("/health");
    return true;
  } catch {
    return false;
  }
}

// ── Upload & analysis ──────────────────────────────────────────────────────

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const SUPPORTED_EXTENSIONS = ["csv", "tsv", "xlsx", "json", "parquet", "db", "sqlite", "sqlite3"];
export const SUPPORTED_FORMATS_COPY = "CSV, TSV, XLSX, JSON, Parquet, or SQLite";
export const SUPPORTED_FORMATS_SUMMARY = "6 file formats · up to 25 MB";
export const SUPPORTED_FORMATS_LIST = "CSV · TSV · XLSX · JSON · Parquet · SQLite";
export const SUPPORTED_FILE_ACCEPT: Record<string, string[]> = {
  "text/csv": [".csv"],
  "text/tab-separated-values": [".tsv"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/json": [".json"],
  "application/vnd.apache.parquet": [".parquet"],
  "application/x-sqlite3": [".db", ".sqlite", ".sqlite3"],
};

/** Async upload: returns a dataset_id immediately; use useJobStream to track progress. */
export async function uploadFileAsync(
  file: File,
  orgId: string = "default",
  onProgress?: (percent: number) => void,
): Promise<{ dataset_id: string; status: string }> {
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) {
    throw new Error("Your sign-in session is missing or expired. Please sign in again before uploading.");
  }
  const formData = new FormData();
  formData.append("file", file);
  const postUpload = (baseURL: string) => axios.post<{ dataset_id: string; status: string }>(
    `${baseURL.replace(/\/$/, "")}/datasets/upload?org_id=${encodeURIComponent(orgId)}`,
    formData,
    {
      // Let the browser set the multipart boundary. Supplying Content-Type
      // manually can strip that boundary in some adapters.
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 120_000,
      onUploadProgress: (e) => {
        if (e.total) onProgress?.(Math.round((e.loaded / e.total) * 50));
      },
    },
  );

  const primary = UPLOAD_API_BASE || API_BASE;
  try {
    return (await postUpload(primary)).data;
  } catch (error) {
    // If a same-origin proxy drops a multipart request, retry once directly
    // against the explicitly configured CORS-enabled Render API.
    if (UPLOAD_API_BASE && primary !== API_BASE && axios.isAxiosError(error) && !error.response) {
      return (await postUpload(API_BASE)).data;
    }
    throw error;
  }
}

export async function fetchAnalysis(analysisId: string): Promise<{ report: EDAReport; ai_narrative?: string | null }> {
  const { data } = await client.get(`/analyses/${analysisId}`);
  return data;
}

export async function loadSampleData(): Promise<File> {
  const response = await fetch("/sample_sales.csv");
  const blob = await response.blob();
  return new File([blob], "sample_sales.csv", { type: "text/csv" });
}

/** Pre-analyzed example dataset seeded by the backend; null while it's still preparing. */
export async function fetchExampleDataset(): Promise<{ dataset_id: string; filename: string } | null> {
  // The backend prepares the bundled example after boot. Poll briefly instead
  // of falling back to a guest upload, which is intentionally unavailable.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const { data } = await client.get<{ dataset_id: string; filename: string }>("/example");
      return data;
    } catch {
      if (attempt < 7) await new Promise((resolve) => window.setTimeout(resolve, 900));
    }
  }
  return null;
}

// ── Visualizations ──────────────────────────────────────────────────────────

export async function fetchDatasetVisualizations(datasetId: string, orgId: string = "default"): Promise<Record<string, any>> {
  const { data } = await client.get(`/datasets/${datasetId}/visualize?org_id=${orgId}`);
  return data;
}

export async function fetchColumnVisualization(
  datasetId: string,
  columnName: string,
  chartType: "auto" | "distribution" | "box_plot" | "violin" | "categorical_bar" = "auto",
  orgId: string = "default",
): Promise<Record<string, any>> {
  const { data } = await client.get(`/datasets/${datasetId}/visualize/${encodeURIComponent(columnName)}`, {
    params: { chart_type: chartType, org_id: orgId },
  });
  return data;
}

export async function fetchTrendChart(
  datasetId: string,
  dateColumn: string,
  valueColumn?: string,
  agg: "sum" | "mean" | "count" | "max" | "min" | "median" = "sum",
  orgId: string = "default",
): Promise<Record<string, any>> {
  const { data } = await client.get(`/datasets/${datasetId}/visualize/trend`, {
    params: { date_column: dateColumn, value_column: valueColumn, agg, org_id: orgId },
  });
  return data;
}

export async function fetchBusinessChart(
  datasetId: string,
  chartType: "pareto" | "top_n" | "waterfall",
  category: string,
  value?: string,
  agg?: string,
  topN?: number,
  ascending?: boolean,
  orgId: string = "default",
): Promise<Record<string, any>> {
  const { data } = await client.get(`/datasets/${datasetId}/visualize/business/${chartType}`, {
    params: { category, value, agg, top_n: topN, ascending, org_id: orgId },
  });
  return data;
}

export async function fetchScatterMatrix(datasetId: string, columns?: string[], orgId: string = "default"): Promise<Record<string, any>> {
  const { data } = await client.get(`/datasets/${datasetId}/visualize/scatter-matrix`, {
    params: { columns: columns?.join(","), org_id: orgId },
  });
  return data;
}

export async function fetchQualityRadar(datasetId: string, orgId: string = "default"): Promise<Record<string, any>> {
  const { data } = await client.get(`/datasets/${datasetId}/visualize/quality-radar`, { params: { org_id: orgId } });
  return data;
}

export interface DatasetRowsResult {
  rows: Record<string, unknown>[];
  row_count: number;
  total_rows: number;
  truncated: boolean;
}

/** Full (up to 20k) dataset rows for client-side chart building, unlike
 * report.preview, which is always just the first 50 rows. */
export async function fetchDatasetRows(
  datasetId: string,
  opts: { columns?: string[]; limit?: number } = {},
  orgId: string = "default",
): Promise<DatasetRowsResult> {
  const params = new URLSearchParams({ org_id: orgId });
  if (opts.columns?.length) params.set("columns", opts.columns.join(","));
  if (opts.limit != null) params.set("limit", String(opts.limit));
  const { data } = await client.get<DatasetRowsResult>(`/datasets/${datasetId}/data?${params}`);
  return data;
}

// ── AI features ──────────────────────────────────────────────────────────────

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
  const { data } = await client.post<ChatResult>(`/datasets/${datasetId}/ai/chat?org_id=${orgId}`, {
    question,
    chat_history: chatHistory,
    limit: 500,
  });
  return data;
}

/** Generate (or regenerate) the plain-English AI summary for the latest analysis. */
export async function regenerateNarrative(
  datasetId: string,
  orgId: string = "default",
  anthropicApiKey?: string,
): Promise<{ analysis_id: string; ai_narrative: string }> {
  const headers = anthropicApiKey ? { "X-Anthropic-API-Key": anthropicApiKey.trim() } : undefined;
  const { data } = await client.post(`/datasets/${datasetId}/analysis/narrative?org_id=${orgId}`, {}, { headers, timeout: 90_000 });
  return data;
}

export interface CleaningSuggestion {
  id: string;
  priority: "high" | "medium" | "low";
  category: string;
  column: string | null;
  title: string;
  description: string;
  estimated_rows_affected: number | null;
}

export async function getAICleaningSuggestions(datasetId: string, orgId: string = "default"): Promise<{ suggestions: CleaningSuggestion[] }> {
  const { data } = await client.get(`/datasets/${datasetId}/ai/cleaning-suggestions?org_id=${orgId}`);
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

export interface SavedReportSummary {
  analysis_id: string;
  dataset_id: string;
  name: string;
  created_at: string;
  rows: number | null;
  columns: number | null;
  quality_score: number | null;
}

export interface PersonalDashboard {
  profile: { name: string | null; email: string };
  limits: { datasets: number; reports: number };
  saved_datasets: DatasetSummary[];
  saved_reports: SavedReportSummary[];
}

export async function getPersonalDashboard(): Promise<PersonalDashboard> {
  const { data } = await client.get<PersonalDashboard>("/dashboard");
  return data;
}

export async function saveDashboardDataset(datasetId: string): Promise<void> {
  await client.post(`/dashboard/datasets/${datasetId}`);
}

export async function removeDashboardDataset(datasetId: string): Promise<void> {
  await client.delete(`/dashboard/datasets/${datasetId}`);
}

export async function saveDashboardReport(datasetId: string): Promise<void> {
  await client.post(`/dashboard/reports/dataset/${datasetId}`);
}

export async function removeDashboardReport(analysisId: string): Promise<void> {
  await client.delete(`/dashboard/reports/${analysisId}`);
}

export async function listDatasets(orgId: string = "default", opts: { archived?: boolean; starred?: boolean } = {}): Promise<DatasetSummary[]> {
  const params = new URLSearchParams({ org_id: orgId });
  if (opts.archived) params.set("archived", "true");
  if (opts.starred) params.set("starred", "true");
  const { data } = await client.get<DatasetSummary[]>(`/datasets?${params}`);
  return data;
}

export async function starDataset(datasetId: string, orgId: string = "default"): Promise<void> {
  await client.patch(`/datasets/${datasetId}/star?org_id=${orgId}`);
}

export async function archiveDataset(datasetId: string, orgId: string = "default"): Promise<void> {
  await client.patch(`/datasets/${datasetId}/archive?org_id=${orgId}`);
}

export async function restoreDataset(datasetId: string, orgId: string = "default"): Promise<void> {
  await client.patch(`/datasets/${datasetId}/restore?org_id=${orgId}`);
}

export async function renameDataset(datasetId: string, name: string, orgId: string = "default"): Promise<DatasetSummary> {
  const { data } = await client.patch<DatasetSummary>(`/datasets/${datasetId}/rename?org_id=${orgId}`, { name });
  return data;
}

export async function deleteDataset(datasetId: string, orgId: string = "default"): Promise<void> {
  await client.delete(`/datasets/${datasetId}?org_id=${orgId}`);
}

export async function fetchDatasetAnalysis(
  datasetId: string,
  orgId: string = "default",
): Promise<{ analysis_id: string; report: EDAReport; ai_narrative: string | null; version: number }> {
  const { data } = await client.get(`/datasets/${datasetId}/analysis?org_id=${orgId}`);
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
    schema_diff: { file1_only: string[]; file2_only: string[]; common: string[] };
    row_count_diff: number;
    column_count_diff: number;
  };
}

export async function compareDatasets(file1: File, file2: File): Promise<DatasetComparisonResult> {
  const formData = new FormData();
  formData.append("file1", file1);
  formData.append("file2", file2);
  const { data } = await client.post<DatasetComparisonResult>("/compare", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

// ── Statistical analysis ───────────────────────────────────────────────────────

export async function fetchAdvancedStats(datasetId: string, orgId: string = "default"): Promise<Record<string, any>> {
  const { data } = await client.get(`/datasets/${datasetId}/stats/advanced?org_id=${orgId}`);
  return data;
}

export async function runTTest(datasetId: string, col1: string, col2: string, orgId: string = "default") {
  const { data } = await client.post(`/datasets/${datasetId}/stats/ttest?col1=${encodeURIComponent(col1)}&col2=${encodeURIComponent(col2)}&org_id=${orgId}`);
  return data;
}

export async function runMannWhitney(
  datasetId: string,
  col1: string,
  col2: string,
  alternative: "two-sided" | "less" | "greater" = "two-sided",
  orgId: string = "default",
) {
  const { data } = await client.post(
    `/datasets/${datasetId}/stats/mann_whitney?col1=${encodeURIComponent(col1)}&col2=${encodeURIComponent(col2)}&alternative=${alternative}&org_id=${orgId}`,
  );
  return data;
}

export async function runChiSquare(datasetId: string, col1: string, col2: string, orgId: string = "default") {
  const { data } = await client.post(
    `/datasets/${datasetId}/stats/chi_square?col1=${encodeURIComponent(col1)}&col2=${encodeURIComponent(col2)}&org_id=${orgId}`,
  );
  return data;
}

export async function runANOVA(datasetId: string, numericCol: string, groupCol: string, orgId: string = "default") {
  const { data } = await client.post(
    `/datasets/${datasetId}/stats/anova?numeric_col=${encodeURIComponent(numericCol)}&group_col=${encodeURIComponent(groupCol)}&org_id=${orgId}`,
  );
  return data;
}

export async function runCorrelation(datasetId: string, col1: string, col2: string, method: string = "pearson", orgId: string = "default") {
  const { data } = await client.post(
    `/datasets/${datasetId}/stats/correlation?col1=${encodeURIComponent(col1)}&col2=${encodeURIComponent(col2)}&method=${method}&org_id=${orgId}`,
  );
  return data;
}

export async function runRegression(datasetId: string, xCol: string, yCol: string, orgId: string = "default") {
  const { data } = await client.post(
    `/datasets/${datasetId}/stats/regression?x_col=${encodeURIComponent(xCol)}&y_col=${encodeURIComponent(yCol)}&org_id=${orgId}`,
  );
  return data;
}

export async function runLogisticRegression(datasetId: string, xCol: string, yCol: string, positiveClass?: string, orgId: string = "default") {
  const positiveParam = positiveClass ? `&positive_class=${encodeURIComponent(positiveClass)}` : "";
  const { data } = await client.post(
    `/datasets/${datasetId}/stats/regression/logistic?x_col=${encodeURIComponent(xCol)}&y_col=${encodeURIComponent(yCol)}${positiveParam}&org_id=${orgId}`,
  );
  return data;
}

export async function runPolynomialRegression(datasetId: string, xCol: string, yCol: string, degree: number = 2, orgId: string = "default") {
  const { data } = await client.post(
    `/datasets/${datasetId}/stats/regression/polynomial?x_col=${encodeURIComponent(xCol)}&y_col=${encodeURIComponent(yCol)}&degree=${degree}&org_id=${orgId}`,
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
) {
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
  options: { periods?: number; p?: number; d?: number; q?: number; alpha?: number } = {},
  orgId: string = "default",
) {
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

export async function runCohortAnalysis(datasetId: string, entityCol: string, dateCol: string, freq: "D" | "W" | "M" | "Q" = "M", orgId: string = "default") {
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
) {
  const { data } = await client.post(
    `/datasets/${datasetId}/stats/ab_test?control_conversions=${controlConversions}&control_total=${controlTotal}&variant_conversions=${variantConversions}&variant_total=${variantTotal}&alpha=${alpha}&org_id=${orgId}`,
  );
  return data;
}

// ── SQL query editor ───────────────────────────────────────────────────────────

export interface QuerySchemaColumn {
  name: string;
  dtype: string;
}

export async function fetchQuerySchema(datasetId: string, orgId: string = "default"): Promise<QuerySchemaColumn[]> {
  const { data } = await client.get<{ schema: Array<{ column: string; type: string }> }>(`/datasets/${datasetId}/query/schema?org_id=${orgId}`);
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
}

export async function runSQLQuery(datasetId: string, sql: string, limit: number = 1000, offset: number = 0, orgId: string = "default"): Promise<QueryResult> {
  const { data } = await client.post<QueryResult>(`/datasets/${datasetId}/query?org_id=${orgId}`, { sql, limit, offset });
  return data;
}

export async function explainSQLQuery(datasetId: string, sql: string, orgId: string = "default"): Promise<{ plan: string }> {
  const { data } = await client.post<{ plan: string }>(`/datasets/${datasetId}/query/explain?org_id=${orgId}`, { sql });
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

export async function createDatasetShare(datasetId: string, ttlHours: number = 168, orgId: string = "default"): Promise<ShareLinkResult> {
  const { data } = await client.post<ShareLinkResult>(`/datasets/${datasetId}/share?org_id=${orgId}`, { ttl_hours: ttlHours });
  return data;
}

export async function revokeDatasetShare(datasetId: string, token: string, orgId: string = "default"): Promise<void> {
  await client.delete(`/datasets/${datasetId}/share/${token}?org_id=${orgId}`);
}

export async function getSharedReport(token: string): Promise<SharedReport> {
  const { data } = await client.get<SharedReport>(`/share/${token}`);
  return data;
}

// ── Export ────────────────────────────────────────────────────────────────────

async function downloadBlob(path: string, fallbackFilename: string): Promise<void> {
  const response = await client.get(path, { responseType: "blob" });
  const disposition: string | undefined = response.headers["content-disposition"];
  const match = disposition?.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] || fallbackFilename;
  const url = URL.createObjectURL(response.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportDatasetExcel(datasetId: string, fileName: string, orgId: string = "default"): Promise<void> {
  await downloadBlob(`/datasets/${datasetId}/export/excel?org_id=${orgId}`, `${fileName}.xlsx`);
}

export async function exportDatasetMarkdown(datasetId: string, fileName: string, orgId: string = "default"): Promise<void> {
  await downloadBlob(`/datasets/${datasetId}/export/markdown?org_id=${orgId}`, `${fileName}_report.md`);
}

// ── Feedback ──────────────────────────────────────────────────────────────────

export async function submitFeedback(message: string, email?: string, page?: string): Promise<void> {
  await client.post("/feedback", { message, email, page });
}
