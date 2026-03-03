/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import { EDAReport } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? '/api' : 'http://localhost:8000');

const client = axios.create({
  baseURL: API_BASE,
  timeout: 300_000, // 5 min — accounts for Render cold start + large file processing
});

export async function uploadFile(file: File): Promise<EDAReport> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await client.post<EDAReport>("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

/** Fire-and-forget ping to wake Render backend before user uploads. */
export function prewarmBackend(): void {
  client.get("/health", { timeout: 15_000 }).catch(() => {/* silent */});
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
    }
  );
  return data;
}

/** Fetch a completed analysis by analysis_id. */
export async function fetchAnalysis(analysisId: string): Promise<{ report: EDAReport }> {
  const { data } = await client.get(`/analyses/${analysisId}`);
  return data;
}

export async function loadSampleData(): Promise<File> {
  const response = await fetch("/sample_sales.csv");
  const blob = await response.blob();
  return new File([blob], "sample_sales.csv", { type: "text/csv" });
}

export async function fetchVisualizations(): Promise<Record<string, any>> {
  const { data } = await client.get("/visualize");
  return data;
}

export async function fetchColumnVisualization(
  columnName: string,
  chartType: "auto" | "distribution" | "box_plot" | "categorical_bar" = "auto"
): Promise<Record<string, any>> {
  const { data } = await client.get(
    `/visualize/${encodeURIComponent(columnName)}`,
    { params: { chart_type: chartType } }
  );
  return data;
}

export async function cleanDataset(operations: Record<string, any>): Promise<Record<string, any>> {
  const { data } = await client.post("/clean", operations);
  return data;
}

export async function transformColumn(params: Record<string, any>): Promise<Record<string, any>> {
  const { data } = await client.post("/transform", params);
  return data;
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
  orgId: string = "default"
): Promise<ChatResult> {
  const { data } = await client.post<ChatResult>(
    `/datasets/${datasetId}/ai/chat?org_id=${orgId}`,
    { question, chat_history: chatHistory, limit: 500 }
  );
  return data;
}

export async function getAICleaningSuggestions(
  datasetId: string,
  orgId: string = "default"
): Promise<{ suggestions: any[] }> {
  const { data } = await client.get(
    `/datasets/${datasetId}/ai/cleaning-suggestions?org_id=${orgId}`
  );
  return data;
}

// ── Credits ───────────────────────────────────────────────────────────────────

export interface CreditStatus {
  org_id: string;
  plan: string;
  ai_credits_used: number;
  ai_credits_limit: number;   // -1 = unlimited
  remaining: number;
  percent_used: number;
}

export async function getCreditStatus(orgId: string = "default"): Promise<CreditStatus> {
  const { data } = await client.get<Record<string, unknown>>(`/orgs/${orgId}/credits`);

  // Backward/forward compatibility across credit payload shapes.
  const used = Number(data.ai_credits_used ?? data.credits_used ?? 0);
  const limit = Number(data.ai_credits_limit ?? data.credits_limit ?? 0);
  const remainingRaw = data.remaining ?? data.credits_remaining;
  const remaining = remainingRaw === undefined
    ? (limit === -1 ? -1 : Math.max(0, limit - used))
    : Number(remainingRaw);
  const percentUsedRaw = data.percent_used;
  const percentUsed = percentUsedRaw === undefined
    ? (limit > 0 ? (used / limit) * 100 : 0)
    : Number(percentUsedRaw);

  return {
    org_id: String(data.org_id ?? orgId),
    plan: String(data.plan ?? "free"),
    ai_credits_used: used,
    ai_credits_limit: limit,
    remaining,
    percent_used: percentUsed,
  };
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
  opts: { archived?: boolean; starred?: boolean } = {}
): Promise<DatasetSummary[]> {
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

export interface AnalysisVersion {
  analysis_id: string;
  version: number;
  duration_seconds: number | null;
  created_at: string;
}

export async function listDatasetAnalyses(
  datasetId: string,
  orgId: string = "default"
): Promise<AnalysisVersion[]> {
  const { data } = await client.get<AnalysisVersion[]>(
    `/datasets/${datasetId}/analyses?org_id=${orgId}`
  );
  return data;
}

export async function fetchDatasetAnalysis(
  datasetId: string,
  orgId: string = "default"
): Promise<{ analysis_id: string; report: EDAReport; ai_narrative: string | null; version: number }> {
  const { data } = await client.get(`/datasets/${datasetId}/analysis?org_id=${orgId}`);
  return data;
}

// ── Connectors ────────────────────────────────────────────────────────────────

export interface ConnectorSummary {
  connector_id: string;
  name: string;
  connector_type: "postgres" | "s3";
  last_tested_at: string | null;
  last_test_ok: boolean | null;
  created_at: string;
}

export async function listConnectors(orgId: string = "default"): Promise<ConnectorSummary[]> {
  const { data } = await client.get<{ connectors: ConnectorSummary[] }>(
    `/connectors?org_id=${orgId}`
  );
  return data.connectors;
}

export async function createConnector(
  body: Record<string, any>,
  orgId: string = "default"
): Promise<ConnectorSummary> {
  const { data } = await client.post<ConnectorSummary>(
    `/connectors?org_id=${orgId}`,
    body
  );
  return data;
}

export async function testConnector(
  connectorId: string,
  orgId: string = "default"
): Promise<{ ok: boolean; tested_at: string }> {
  const { data } = await client.post(`/connectors/${connectorId}/test?org_id=${orgId}`);
  return data;
}

export async function deleteConnector(connectorId: string, orgId: string = "default"): Promise<void> {
  await client.delete(`/connectors/${connectorId}?org_id=${orgId}`);
}

export async function listConnectorTables(
  connectorId: string,
  orgId: string = "default"
): Promise<{ tables?: any[]; objects?: any[] }> {
  const { data } = await client.get(`/connectors/${connectorId}/tables?org_id=${orgId}`);
  return data;
}

export async function importFromConnector(
  connectorId: string,
  body: Record<string, any>,
  orgId: string = "default"
): Promise<{ dataset_id: string; status: string; message: string }> {
  const { data } = await client.post(
    `/connectors/${connectorId}/import?org_id=${orgId}`,
    body
  );
  return data;
}

// ── Monitors ──────────────────────────────────────────────────────────────────

export interface MonitorSummary {
  monitor_id: string;
  dataset_id: string;
  name: string;
  check_type: string;
  column_name: string | null;
  condition: string;
  threshold: number;
  schedule: string;
  is_active: boolean;
  last_checked_at: string | null;
  last_status: string | null;
  created_at: string;
}

export async function listMonitors(
  datasetId: string,
  orgId: string = "default"
): Promise<MonitorSummary[]> {
  const { data } = await client.get<{ monitors: MonitorSummary[] }>(
    `/datasets/${datasetId}/monitors?org_id=${orgId}`
  );
  return data.monitors;
}

export async function createMonitor(
  datasetId: string,
  body: Record<string, any>,
  orgId: string = "default"
): Promise<MonitorSummary> {
  const { data } = await client.post<MonitorSummary>(
    `/datasets/${datasetId}/monitors?org_id=${orgId}`,
    body
  );
  return data;
}

export async function triggerMonitorRun(
  monitorId: string,
  orgId: string = "default"
): Promise<{ task_id: string }> {
  const { data } = await client.post(`/monitors/${monitorId}/run?org_id=${orgId}`);
  return data;
}

// ── Statistical Analysis ───────────────────────────────────────────────────────

export async function fetchAdvancedStats(
  datasetId: string,
  orgId: string = "default"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any>> {
  const { data } = await client.get(`/datasets/${datasetId}/stats/advanced?org_id=${orgId}`);
  return data;
}

export async function runTTest(
  datasetId: string, col1: string, col2: string, orgId: string = "default"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any>> {
  const { data } = await client.post(`/datasets/${datasetId}/stats/ttest?col1=${encodeURIComponent(col1)}&col2=${encodeURIComponent(col2)}&org_id=${orgId}`);
  return data;
}

export async function runChiSquare(
  datasetId: string, col1: string, col2: string, orgId: string = "default"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any>> {
  const { data } = await client.post(`/datasets/${datasetId}/stats/chi_square?col1=${encodeURIComponent(col1)}&col2=${encodeURIComponent(col2)}&org_id=${orgId}`);
  return data;
}

export async function runANOVA(
  datasetId: string, numericCol: string, groupCol: string, orgId: string = "default"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any>> {
  const { data } = await client.post(`/datasets/${datasetId}/stats/anova?numeric_col=${encodeURIComponent(numericCol)}&group_col=${encodeURIComponent(groupCol)}&org_id=${orgId}`);
  return data;
}

export async function runCorrelation(
  datasetId: string, col1: string, col2: string, method: string = "pearson", orgId: string = "default"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any>> {
  const { data } = await client.post(`/datasets/${datasetId}/stats/correlation?col1=${encodeURIComponent(col1)}&col2=${encodeURIComponent(col2)}&method=${method}&org_id=${orgId}`);
  return data;
}

export async function runRegression(
  datasetId: string, xCol: string, yCol: string, orgId: string = "default"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any>> {
  const { data } = await client.post(`/datasets/${datasetId}/stats/regression?x_col=${encodeURIComponent(xCol)}&y_col=${encodeURIComponent(yCol)}&org_id=${orgId}`);
  return data;
}

export async function runLogisticRegression(
  datasetId: string,
  xCol: string,
  yCol: string,
  positiveClass?: string,
  orgId: string = "default"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any>> {
  const positiveParam = positiveClass ? `&positive_class=${encodeURIComponent(positiveClass)}` : "";
  const { data } = await client.post(
    `/datasets/${datasetId}/stats/regression/logistic?x_col=${encodeURIComponent(xCol)}&y_col=${encodeURIComponent(yCol)}${positiveParam}&org_id=${orgId}`
  );
  return data;
}

export async function runPolynomialRegression(
  datasetId: string,
  xCol: string,
  yCol: string,
  degree: number = 2,
  orgId: string = "default"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any>> {
  const { data } = await client.post(
    `/datasets/${datasetId}/stats/regression/polynomial?x_col=${encodeURIComponent(xCol)}&y_col=${encodeURIComponent(yCol)}&degree=${degree}&org_id=${orgId}`
  );
  return data;
}

export async function runMannWhitney(
  datasetId: string,
  col1: string,
  col2: string,
  alternative: "two-sided" | "less" | "greater" = "two-sided",
  orgId: string = "default"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any>> {
  const { data } = await client.post(
    `/datasets/${datasetId}/stats/mann_whitney?col1=${encodeURIComponent(col1)}&col2=${encodeURIComponent(col2)}&alternative=${alternative}&org_id=${orgId}`
  );
  return data;
}

export async function runTimeSeriesDecomposition(
  datasetId: string,
  dateCol: string,
  valueCol: string,
  period?: number,
  model: "additive" | "multiplicative" = "additive",
  orgId: string = "default"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any>> {
  const periodPart = period ? `&period=${period}` : "";
  const { data } = await client.post(
    `/datasets/${datasetId}/stats/time_series/decompose?date_col=${encodeURIComponent(dateCol)}&value_col=${encodeURIComponent(valueCol)}${periodPart}&model=${model}&org_id=${orgId}`
  );
  return data;
}

export async function runArimaForecast(
  datasetId: string,
  dateCol: string,
  valueCol: string,
  options: { periods?: number; p?: number; d?: number; q?: number; alpha?: number } = {},
  orgId: string = "default"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any>> {
  const periods = options.periods ?? 12;
  const p = options.p ?? 1;
  const d = options.d ?? 1;
  const q = options.q ?? 1;
  const alpha = options.alpha ?? 0.05;
  const { data } = await client.post(
    `/datasets/${datasetId}/stats/time_series/arima?date_col=${encodeURIComponent(dateCol)}&value_col=${encodeURIComponent(valueCol)}&periods=${periods}&p=${p}&d=${d}&q=${q}&alpha=${alpha}&org_id=${orgId}`
  );
  return data;
}

export async function runCohortAnalysis(
  datasetId: string,
  entityCol: string,
  dateCol: string,
  freq: "D" | "W" | "M" | "Q" = "M",
  orgId: string = "default"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any>> {
  const { data } = await client.post(
    `/datasets/${datasetId}/stats/cohort?entity_col=${encodeURIComponent(entityCol)}&date_col=${encodeURIComponent(dateCol)}&freq=${freq}&org_id=${orgId}`
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
  orgId: string = "default"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any>> {
  const { data } = await client.post(
    `/datasets/${datasetId}/stats/ab_test?control_conversions=${controlConversions}&control_total=${controlTotal}&variant_conversions=${variantConversions}&variant_total=${variantTotal}&alpha=${alpha}&org_id=${orgId}`
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
  orgId: string = "default"
): Promise<QuerySchemaColumn[]> {
  const { data } = await client.get<{ schema: QuerySchemaColumn[] }>(
    `/datasets/${datasetId}/query/schema?org_id=${orgId}`
  );
  return data.schema;
}

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  row_count: number;
  truncated: boolean;
  execution_time_ms?: number;
}

export async function runSQLQuery(
  datasetId: string,
  sql: string,
  limit: number = 1000,
  orgId: string = "default"
): Promise<QueryResult> {
  const { data } = await client.post<QueryResult>(
    `/datasets/${datasetId}/query?org_id=${orgId}`,
    { sql, limit }
  );
  return data;
}
