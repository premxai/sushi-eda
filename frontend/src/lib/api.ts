/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from "axios";
import { EDAReport } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? '/api' : 'http://localhost:8000');

const client = axios.create({ baseURL: API_BASE });

export async function uploadFile(file: File): Promise<EDAReport> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await client.post<EDAReport>("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

/** Async upload — returns a dataset_id immediately; use useJobStream to track progress. */
export async function uploadFileAsync(
  file: File,
  orgId: string = "default"
): Promise<{ dataset_id: string; status: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await client.post<{ dataset_id: string; status: string }>(
    `/datasets/upload?org_id=${orgId}`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
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
  const { data } = await client.get<CreditStatus>(`/orgs/${orgId}/credits`);
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
