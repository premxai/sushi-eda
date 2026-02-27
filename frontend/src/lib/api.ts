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
