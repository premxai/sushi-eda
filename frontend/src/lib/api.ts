/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import { EDAReport } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? '/api' : 'http://localhost:8000');

const client = axios.create({
  baseURL: API_BASE,
  timeout: 300_000, // 5 min - accounts for Render cold start + large file processing
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

client.interceptors.request.use(async (config) => {
  const token = await getClerkToken();
  if (!token) return config;
  config.headers = config.headers ?? {};
  (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  return config;
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
  connector_type: "postgres" | "s3" | "google_sheets" | "rest";
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
): Promise<{ tables?: Record<string, unknown>[]; objects?: Record<string, unknown>[] }> {
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

export async function updateMonitor(
  monitorId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: Record<string, any>,
  orgId: string = "default"
): Promise<MonitorSummary> {
  const { data } = await client.patch<MonitorSummary>(`/monitors/${monitorId}?org_id=${orgId}`, body);
  return data;
}

export async function deleteMonitor(
  monitorId: string,
  orgId: string = "default"
): Promise<void> {
  await client.delete(`/monitors/${monitorId}?org_id=${orgId}`);
}

export interface MonitorRun {
  run_id: string;
  status: string;
  actual_value: number | null;
  message: string | null;
  ran_at: string;
}

export async function getMonitorRuns(
  monitorId: string,
  orgId: string = "default",
  limit: number = 20
): Promise<MonitorRun[]> {
  const { data } = await client.get<{ monitor_id: string; runs: MonitorRun[] }>(
    `/monitors/${monitorId}/runs?org_id=${orgId}&limit=${limit}`
  );
  return data.runs;
}

// ── Pipelines (Task 27) ───────────────────────────────────────────────────────

export interface PipelineSummary {
  pipeline_id: string;
  name: string;
  description: string | null;
  source_dataset_id: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  graph: Record<string, any>;
  destination_type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  destination_config: Record<string, any> | null;
  schedule: string;
  is_active: boolean;
  version: number;
  last_run_at: string | null;
  last_run_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface PipelineRunSummary {
  run_id: string;
  pipeline_id: string;
  status: string;
  trigger_type: string;
  recipe_version: number;
  output_dataset_id: string | null;
  logs: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metrics: Record<string, any> | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export async function listPipelines(orgId: string = "default"): Promise<PipelineSummary[]> {
  const { data } = await client.get<{ pipelines: PipelineSummary[] }>(`/pipelines?org_id=${orgId}`);
  return data.pipelines;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createPipeline(body: Record<string, any>, orgId: string = "default"): Promise<PipelineSummary> {
  const { data } = await client.post<PipelineSummary>(`/pipelines?org_id=${orgId}`, body);
  return data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updatePipeline(pipelineId: string, body: Record<string, any>, orgId: string = "default"): Promise<PipelineSummary> {
  const { data } = await client.patch<PipelineSummary>(`/pipelines/${pipelineId}?org_id=${orgId}`, body);
  return data;
}

export async function deletePipeline(pipelineId: string, orgId: string = "default"): Promise<void> {
  await client.delete(`/pipelines/${pipelineId}?org_id=${orgId}`);
}

export async function runPipelineNow(pipelineId: string, orgId: string = "default"): Promise<{ task_id: string; run_id: string; status: string }> {
  const { data } = await client.post(`/pipelines/${pipelineId}/run?org_id=${orgId}`);
  return data;
}

export async function listPipelineRuns(
  pipelineId: string,
  orgId: string = "default",
  limit: number = 50
): Promise<PipelineRunSummary[]> {
  const { data } = await client.get<{ runs: PipelineRunSummary[] }>(
    `/pipelines/${pipelineId}/runs?org_id=${orgId}&limit=${limit}`
  );
  return data.runs;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function listPipelineVersions(pipelineId: string, orgId: string = "default", limit: number = 50): Promise<any[]> {
  const { data } = await client.get<{ versions: any[] }>(
    `/pipelines/${pipelineId}/versions?org_id=${orgId}&limit=${limit}`
  );
  return data.versions;
}

// ── Statistical Analysis ───────────────────────────────────────────────────────

export async function fetchAdvancedStats(
  datasetId: string,
  orgId: string = "default"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any>> {
  if (datasetId === "local") {
    const { data } = await client.get(`/stats/advanced`);
    return data;
  }
  const { data } = await client.get(`/datasets/${datasetId}/stats/advanced?org_id=${orgId}`);
  return data;
}

export async function runTTest(
  datasetId: string, col1: string, col2: string, orgId: string = "default"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any>> {
  if (datasetId === "local") {
    const { data } = await client.post(`/stats/ttest?col1=${encodeURIComponent(col1)}&col2=${encodeURIComponent(col2)}`);
    return data;
  }
  const { data } = await client.post(`/datasets/${datasetId}/stats/ttest?col1=${encodeURIComponent(col1)}&col2=${encodeURIComponent(col2)}&org_id=${orgId}`);
  return data;
}

export async function runChiSquare(
  datasetId: string, col1: string, col2: string, orgId: string = "default"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any>> {
  if (datasetId === "local") {
    const { data } = await client.post(`/stats/chi_square?col1=${encodeURIComponent(col1)}&col2=${encodeURIComponent(col2)}`);
    return data;
  }
  const { data } = await client.post(`/datasets/${datasetId}/stats/chi_square?col1=${encodeURIComponent(col1)}&col2=${encodeURIComponent(col2)}&org_id=${orgId}`);
  return data;
}

export async function runANOVA(
  datasetId: string, numericCol: string, groupCol: string, orgId: string = "default"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any>> {
  if (datasetId === "local") {
    const { data } = await client.post(`/stats/anova?numeric_col=${encodeURIComponent(numericCol)}&group_col=${encodeURIComponent(groupCol)}`);
    return data;
  }
  const { data } = await client.post(`/datasets/${datasetId}/stats/anova?numeric_col=${encodeURIComponent(numericCol)}&group_col=${encodeURIComponent(groupCol)}&org_id=${orgId}`);
  return data;
}

export async function runCorrelation(
  datasetId: string, col1: string, col2: string, method: string = "pearson", orgId: string = "default"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any>> {
  if (datasetId === "local") {
    const { data } = await client.post(`/stats/correlation?col1=${encodeURIComponent(col1)}&col2=${encodeURIComponent(col2)}&method=${method}`);
    return data;
  }
  const { data } = await client.post(`/datasets/${datasetId}/stats/correlation?col1=${encodeURIComponent(col1)}&col2=${encodeURIComponent(col2)}&method=${method}&org_id=${orgId}`);
  return data;
}

export async function runRegression(
  datasetId: string, xCol: string, yCol: string, orgId: string = "default"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<Record<string, any>> {
  if (datasetId === "local") {
    const { data } = await client.post(`/stats/regression?x_col=${encodeURIComponent(xCol)}&y_col=${encodeURIComponent(yCol)}`);
    return data;
  }
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
  if (datasetId === "local") {
    const { data } = await client.post(
      `/stats/regression/logistic?x_col=${encodeURIComponent(xCol)}&y_col=${encodeURIComponent(yCol)}${positiveParam}`
    );
    return data;
  }
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
  if (datasetId === "local") {
    const { data } = await client.post(
      `/stats/regression/polynomial?x_col=${encodeURIComponent(xCol)}&y_col=${encodeURIComponent(yCol)}&degree=${degree}`
    );
    return data;
  }
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
  if (datasetId === "local") {
    const { data } = await client.post(
      `/stats/mann_whitney?col1=${encodeURIComponent(col1)}&col2=${encodeURIComponent(col2)}&alternative=${alternative}`
    );
    return data;
  }
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
  if (datasetId === "local") {
    const { data } = await client.post(
      `/stats/time_series/decompose?date_col=${encodeURIComponent(dateCol)}&value_col=${encodeURIComponent(valueCol)}${periodPart}&model=${model}`
    );
    return data;
  }
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
  if (datasetId === "local") {
    const { data } = await client.post(
      `/stats/time_series/arima?date_col=${encodeURIComponent(dateCol)}&value_col=${encodeURIComponent(valueCol)}&periods=${periods}&p=${p}&d=${d}&q=${q}&alpha=${alpha}`
    );
    return data;
  }
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
  if (datasetId === "local") {
    const { data } = await client.post(
      `/stats/cohort?entity_col=${encodeURIComponent(entityCol)}&date_col=${encodeURIComponent(dateCol)}&freq=${freq}`
    );
    return data;
  }
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
  if (datasetId === "local") {
    const { data } = await client.post(
      `/stats/ab_test?control_conversions=${controlConversions}&control_total=${controlTotal}&variant_conversions=${variantConversions}&variant_total=${variantTotal}&alpha=${alpha}`
    );
    return data;
  }
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
  const { data } = await client.get<{ schema: Array<{ column: string; type: string }> }>(
    `/datasets/${datasetId}/query/schema?org_id=${orgId}`
  );
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
  orgId: string = "default"
): Promise<QueryResult> {
  const { data } = await client.post<QueryResult>(
    `/datasets/${datasetId}/query?org_id=${orgId}`,
    { sql, limit, offset }
  );
  return data;
}

export interface QueryExplainResult {
  plan: string;
}

export async function explainSQLQuery(
  datasetId: string,
  sql: string,
  orgId: string = "default"
): Promise<QueryExplainResult> {
  const { data } = await client.post<QueryExplainResult>(
    `/datasets/${datasetId}/query/explain?org_id=${orgId}`,
    { sql }
  );
  return data;
}

// ── Comments / Collaboration (Task 33) ────────────────────────────────────────

export interface CommentReply {
  comment_id: string;
  parent_id: string;
  column_name: string | null;
  author_name: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  user_id: string | null;
}

export interface CommentThread {
  comment_id: string;
  dataset_id: string;
  parent_id: null;
  column_name: string | null;
  author_name: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  user_id: string | null;
  replies: CommentReply[];
}

export async function listComments(
  datasetId: string,
  orgId: string = "default",
  columnName?: string
): Promise<CommentThread[]> {
  const params = new URLSearchParams({ org_id: orgId });
  if (columnName) params.set("column_name", columnName);
  const { data } = await client.get<CommentThread[]>(
    `/datasets/${datasetId}/comments?${params}`
  );
  return data;
}

export async function createComment(
  datasetId: string,
  body: { content: string; column_name?: string; parent_id?: string; author_name?: string },
  orgId: string = "default"
): Promise<CommentThread> {
  const { data } = await client.post<CommentThread>(
    `/datasets/${datasetId}/comments?org_id=${orgId}`,
    body
  );
  return data;
}

export async function editComment(
  commentId: string,
  content: string,
  orgId: string = "default"
): Promise<CommentThread> {
  const { data } = await client.patch<CommentThread>(
    `/comments/${commentId}?org_id=${orgId}`,
    { content }
  );
  return data;
}

export async function deleteComment(
  commentId: string,
  orgId: string = "default"
): Promise<void> {
  await client.delete(`/comments/${commentId}?org_id=${orgId}`);
}

// ── Admin / Enterprise (Task 35) ──────────────────────────────────────────────

export interface AuditLogEntry {
  log_id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  user_id: string | null;
  ip_address: string | null;
  extra: Record<string, unknown> | null;
  created_at: string;
}

export interface OrgMemberEntry {
  member_id: string;
  user_id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  role: "viewer" | "editor" | "admin";
  joined_at: string;
}

export async function listAuditLogs(
  orgId: string = "default",
  opts: { action?: string; resource_type?: string; limit?: number; offset?: number } = {}
): Promise<{ logs: AuditLogEntry[]; count: number }> {
  const p = new URLSearchParams();
  if (opts.action) p.set("action", opts.action);
  if (opts.resource_type) p.set("resource_type", opts.resource_type);
  if (opts.limit) p.set("limit", String(opts.limit));
  if (opts.offset) p.set("offset", String(opts.offset));
  const { data } = await client.get<{ logs: AuditLogEntry[]; count: number }>(
    `/orgs/${orgId}/audit-logs?${p}`
  );
  return data;
}

export async function listOrgMembers(orgId: string = "default"): Promise<OrgMemberEntry[]> {
  const { data } = await client.get<OrgMemberEntry[]>(`/orgs/${orgId}/members`);
  return data;
}

export async function updateMemberRole(
  orgId: string,
  userId: string,
  role: string
): Promise<OrgMemberEntry> {
  const { data } = await client.patch<OrgMemberEntry>(
    `/orgs/${orgId}/members/${userId}`,
    { role }
  );
  return data;
}

export async function removeMember(orgId: string, userId: string): Promise<void> {
  await client.delete(`/orgs/${orgId}/members/${userId}`);
}

