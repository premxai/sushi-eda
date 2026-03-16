"use client";

import { useState } from "react";
import {
  X,
  Database,
  Cloud,
  CheckCircle2,
  XCircle,
  Loader2,
  Table2,
  Globe,
} from "lucide-react";
import { createConnector, testConnector, deleteConnector } from "@/lib/api";

type ConnectorType = "postgres" | "s3" | "google_sheets" | "rest";

interface Props {
  open: boolean;
  onClose: () => void;
  orgId?: string;
  onCreated?: () => void;
}

const DEFAULT_POSTGRES = {
  host: "",
  port: "5432",
  database: "",
  username: "",
  password: "",
  ssl_mode: "require",
};
const DEFAULT_S3 = {
  bucket: "",
  region: "us-east-1",
  access_key_id: "",
  secret_access_key: "",
  endpoint_url: "",
};
const DEFAULT_GOOGLE_SHEETS = {
  sheet_url: "",
  gid: "",
  csv_url: "",
};
const DEFAULT_REST = {
  base_url: "",
  endpoints: "/",
  healthcheck_endpoint: "",
  data_key: "",
  auth_header: "Authorization",
  bearer_token: "",
  headers_json: "{}",
};

export default function ConnectorModal({
  open,
  onClose,
  orgId = "default",
  onCreated,
}: Props) {
  const [connectorType, setConnectorType] = useState<ConnectorType>("postgres");
  const [name, setName] = useState("");
  const [pgFields, setPgFields] = useState(DEFAULT_POSTGRES);
  const [s3Fields, setS3Fields] = useState(DEFAULT_S3);
  const [gsFields, setGsFields] = useState(DEFAULT_GOOGLE_SHEETS);
  const [restFields, setRestFields] = useState(DEFAULT_REST);
  const [testResult, setTestResult] = useState<
    "idle" | "testing" | "ok" | "fail"
  >("idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdConnectorId, setCreatedConnectorId] = useState<string | null>(
    null,
  );

  if (!open) return null;

  function parseOptionalJson(input: string): Record<string, string> {
    const raw = input.trim();
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Headers JSON must be an object");
    }
    return Object.fromEntries(
      Object.entries(parsed).map(([k, v]) => [
        String(k),
        v == null ? "" : String(v),
      ]),
    );
  }

  function buildBody() {
    if (connectorType === "postgres") {
      return {
        type: "postgres",
        name,
        ...pgFields,
        port: Number(pgFields.port),
      };
    }

    if (connectorType === "s3") {
      return {
        type: "s3",
        name,
        ...s3Fields,
        endpoint_url: s3Fields.endpoint_url || undefined,
      };
    }

    if (connectorType === "google_sheets") {
      const body: Record<string, unknown> = { type: "google_sheets", name };
      if (gsFields.sheet_url.trim()) body.sheet_url = gsFields.sheet_url.trim();
      if (gsFields.gid.trim()) body.gid = gsFields.gid.trim();
      if (gsFields.csv_url.trim()) body.csv_url = gsFields.csv_url.trim();
      return body;
    }

    const headers = parseOptionalJson(restFields.headers_json);
    const endpoints = restFields.endpoints
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const body: Record<string, unknown> = {
      type: "rest",
      name,
      base_url: restFields.base_url.trim(),
      headers,
      endpoints,
      auth_header: restFields.auth_header.trim() || "Authorization",
    };
    if (restFields.healthcheck_endpoint.trim()) {
      body.healthcheck_endpoint = restFields.healthcheck_endpoint.trim();
    }
    if (restFields.data_key.trim()) {
      body.data_key = restFields.data_key.trim();
    }
    if (restFields.bearer_token.trim()) {
      body.bearer_token = restFields.bearer_token.trim();
    }
    return body;
  }

  async function handleTest() {
    setError(null);
    setTestResult("testing");
    let newId: string | null = null;
    try {
      const connector = await createConnector(buildBody(), orgId);
      newId = connector.connector_id;
      setCreatedConnectorId(newId);
      const result = await testConnector(connector.connector_id, orgId);
      setTestResult(result.ok ? "ok" : "fail");
      if (!result.ok) {
        await deleteConnector(connector.connector_id, orgId);
        setCreatedConnectorId(null);
      } else {
        onCreated?.();
        setTimeout(handleClose, 1200);
      }
    } catch (e: unknown) {
      const err = e as {
        response?: { data?: { detail?: string } };
        message?: string;
      };
      setTestResult("fail");
      setError(
        err?.response?.data?.detail ?? err?.message ?? "Connection test failed",
      );
      const idToClean = newId ?? createdConnectorId;
      if (idToClean) {
        try {
          await deleteConnector(idToClean, orgId);
        } catch {}
        setCreatedConnectorId(null);
      }
    }
  }

  async function handleSave() {
    if (createdConnectorId) {
      onCreated?.();
      handleClose();
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await createConnector(buildBody(), orgId);
      onCreated?.();
      handleClose();
    } catch (e: unknown) {
      const err = e as {
        response?: { data?: { detail?: string } };
        message?: string;
      };
      setError(
        err?.response?.data?.detail ??
          err?.message ??
          "Failed to save connector",
      );
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setName("");
    setPgFields(DEFAULT_POSTGRES);
    setS3Fields(DEFAULT_S3);
    setGsFields(DEFAULT_GOOGLE_SHEETS);
    setRestFields(DEFAULT_REST);
    setTestResult("idle");
    setError(null);
    setCreatedConnectorId(null);
    onClose();
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 11px",
    borderRadius: 8,
    fontSize: 13,
    border: "1px solid rgba(0,0,0,0.1)",
    background: "rgba(255,255,255,0.8)",
    color: "#111010",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 10,
    fontWeight: 500,
    color: "#6b6860",
    marginBottom: 4,
    fontFamily: "ui-monospace, Menlo, monospace",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  };

  const TYPE_OPTIONS: Array<{
    type: ConnectorType;
    label: string;
    icon: typeof Database;
  }> = [
    { type: "postgres", label: "PostgreSQL", icon: Database },
    { type: "s3", label: "S3 / R2", icon: Cloud },
    { type: "google_sheets", label: "Sheets", icon: Table2 },
    { type: "rest", label: "REST API", icon: Globe },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.35)",
          backdropFilter: "blur(6px)",
        }}
        onClick={handleClose}
      />

      <div
        style={{
          position: "relative",
          zIndex: 10,
          width: "100%",
          maxWidth: 520,
          background: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.9)",
          boxShadow:
            "0 20px 60px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.95)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: "linear-gradient(90deg, #9060f8, #e840c8, #00d4e8)",
          }}
        />

        <div style={{ padding: 24, maxHeight: "80vh", overflow: "auto" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#111010",
                  marginBottom: 3,
                }}
              >
                Add Data Connector
              </h2>
              <p style={{ fontSize: 12, color: "#9a9690" }}>
                Connect to a live data source
              </p>
            </div>
            <button
              onClick={handleClose}
              style={{
                padding: 6,
                borderRadius: 8,
                border: "none",
                background: "rgba(0,0,0,0.06)",
                cursor: "pointer",
                color: "#6b6860",
                display: "flex",
                alignItems: "center",
              }}
            >
              <X style={{ width: 15, height: 15 }} />
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 4,
              background: "rgba(0,0,0,0.05)",
              borderRadius: 12,
              padding: 3,
              marginBottom: 20,
            }}
          >
            {TYPE_OPTIONS.map(({ type, icon: Icon, label }) => (
              <button
                key={type}
                onClick={() => setConnectorType(type)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  padding: "8px 10px",
                  borderRadius: 9,
                  fontSize: 12,
                  fontWeight: connectorType === type ? 500 : 400,
                  color: connectorType === type ? "#111010" : "#6b6860",
                  background: connectorType === type ? "white" : "transparent",
                  boxShadow:
                    connectorType === type
                      ? "0 1px 4px rgba(0,0,0,0.1)"
                      : "none",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <Icon style={{ width: 14, height: 14 }} />
                {label}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Connection name</label>
            <input
              style={inputStyle}
              placeholder="My production source"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {connectorType === "postgres" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr",
                  gap: 8,
                }}
              >
                <div>
                  <label style={labelStyle}>Host</label>
                  <input
                    style={inputStyle}
                    placeholder="db.example.com"
                    value={pgFields.host}
                    onChange={(e) =>
                      setPgFields((f) => ({ ...f, host: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label style={labelStyle}>Port</label>
                  <input
                    style={inputStyle}
                    placeholder="5432"
                    value={pgFields.port}
                    onChange={(e) =>
                      setPgFields((f) => ({ ...f, port: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Database</label>
                <input
                  style={inputStyle}
                  placeholder="mydb"
                  value={pgFields.database}
                  onChange={(e) =>
                    setPgFields((f) => ({ ...f, database: e.target.value }))
                  }
                />
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                <div>
                  <label style={labelStyle}>Username</label>
                  <input
                    style={inputStyle}
                    placeholder="postgres"
                    value={pgFields.username}
                    onChange={(e) =>
                      setPgFields((f) => ({ ...f, username: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label style={labelStyle}>Password</label>
                  <input
                    style={inputStyle}
                    type="password"
                    placeholder="********"
                    value={pgFields.password}
                    onChange={(e) =>
                      setPgFields((f) => ({ ...f, password: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div>
                <label style={labelStyle}>SSL mode</label>
                <select
                  style={inputStyle}
                  value={pgFields.ssl_mode}
                  onChange={(e) =>
                    setPgFields((f) => ({ ...f, ssl_mode: e.target.value }))
                  }
                >
                  <option value="require">require</option>
                  <option value="prefer">prefer</option>
                  <option value="disable">disable</option>
                </select>
              </div>
            </div>
          )}

          {connectorType === "s3" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              <div>
                <label style={labelStyle}>Bucket</label>
                <input
                  style={inputStyle}
                  placeholder="my-data-bucket"
                  value={s3Fields.bucket}
                  onChange={(e) =>
                    setS3Fields((f) => ({ ...f, bucket: e.target.value }))
                  }
                />
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                <div>
                  <label style={labelStyle}>Region</label>
                  <input
                    style={inputStyle}
                    placeholder="us-east-1"
                    value={s3Fields.region}
                    onChange={(e) =>
                      setS3Fields((f) => ({ ...f, region: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label style={labelStyle}>Endpoint URL (optional)</label>
                  <input
                    style={inputStyle}
                    placeholder="https://..."
                    value={s3Fields.endpoint_url}
                    onChange={(e) =>
                      setS3Fields((f) => ({
                        ...f,
                        endpoint_url: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Access Key ID</label>
                <input
                  style={inputStyle}
                  placeholder="AKIA..."
                  value={s3Fields.access_key_id}
                  onChange={(e) =>
                    setS3Fields((f) => ({
                      ...f,
                      access_key_id: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label style={labelStyle}>Secret Access Key</label>
                <input
                  style={inputStyle}
                  type="password"
                  placeholder="********"
                  value={s3Fields.secret_access_key}
                  onChange={(e) =>
                    setS3Fields((f) => ({
                      ...f,
                      secret_access_key: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          )}

          {connectorType === "google_sheets" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              <div>
                <label style={labelStyle}>Sheet URL</label>
                <input
                  style={inputStyle}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={gsFields.sheet_url}
                  onChange={(e) =>
                    setGsFields((f) => ({ ...f, sheet_url: e.target.value }))
                  }
                />
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                <div>
                  <label style={labelStyle}>GID (optional)</label>
                  <input
                    style={inputStyle}
                    placeholder="0"
                    value={gsFields.gid}
                    onChange={(e) =>
                      setGsFields((f) => ({ ...f, gid: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label style={labelStyle}>CSV URL (optional)</label>
                  <input
                    style={inputStyle}
                    placeholder="https://docs.google.com/.../export?format=csv"
                    value={gsFields.csv_url}
                    onChange={(e) =>
                      setGsFields((f) => ({ ...f, csv_url: e.target.value }))
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {connectorType === "rest" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              <div>
                <label style={labelStyle}>Base URL</label>
                <input
                  style={inputStyle}
                  placeholder="https://api.example.com"
                  value={restFields.base_url}
                  onChange={(e) =>
                    setRestFields((f) => ({ ...f, base_url: e.target.value }))
                  }
                />
              </div>
              <div>
                <label style={labelStyle}>Endpoints (one per line)</label>
                <textarea
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical" }}
                  placeholder={"/users\n/orders"}
                  value={restFields.endpoints}
                  onChange={(e) =>
                    setRestFields((f) => ({ ...f, endpoints: e.target.value }))
                  }
                />
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                <div>
                  <label style={labelStyle}>Healthcheck endpoint</label>
                  <input
                    style={inputStyle}
                    placeholder="/health"
                    value={restFields.healthcheck_endpoint}
                    onChange={(e) =>
                      setRestFields((f) => ({
                        ...f,
                        healthcheck_endpoint: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label style={labelStyle}>Data key (optional)</label>
                  <input
                    style={inputStyle}
                    placeholder="data"
                    value={restFields.data_key}
                    onChange={(e) =>
                      setRestFields((f) => ({ ...f, data_key: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                <div>
                  <label style={labelStyle}>Auth header</label>
                  <input
                    style={inputStyle}
                    placeholder="Authorization"
                    value={restFields.auth_header}
                    onChange={(e) =>
                      setRestFields((f) => ({
                        ...f,
                        auth_header: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label style={labelStyle}>Bearer token</label>
                  <input
                    style={inputStyle}
                    type="password"
                    placeholder="token"
                    value={restFields.bearer_token}
                    onChange={(e) =>
                      setRestFields((f) => ({
                        ...f,
                        bearer_token: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Extra headers JSON</label>
                <textarea
                  rows={3}
                  style={{
                    ...inputStyle,
                    resize: "vertical",
                    fontFamily: "ui-monospace, Menlo, monospace",
                    fontSize: 12,
                  }}
                  placeholder={`{"X-API-Key":"...","Accept":"application/json"}`}
                  value={restFields.headers_json}
                  onChange={(e) =>
                    setRestFields((f) => ({
                      ...f,
                      headers_json: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          )}

          {error && (
            <div
              style={{
                marginTop: 12,
                display: "flex",
                gap: 7,
                alignItems: "flex-start",
                padding: "8px 12px",
                borderRadius: 8,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.15)",
              }}
            >
              <XCircle
                style={{
                  width: 14,
                  height: 14,
                  color: "#ef4444",
                  flexShrink: 0,
                  marginTop: 1,
                }}
              />
              <p style={{ fontSize: 12, color: "#ef4444" }}>{error}</p>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <button
              onClick={() => void handleTest()}
              disabled={!name || testResult === "testing" || saving}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "9px 16px",
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.1)",
                background: "rgba(255,255,255,0.8)",
                fontSize: 13,
                fontWeight: 500,
                color: "#111010",
                cursor: "pointer",
                opacity: !name || testResult === "testing" || saving ? 0.4 : 1,
                transition: "opacity 0.15s",
              }}
            >
              {testResult === "testing" && (
                <Loader2
                  style={{
                    width: 13,
                    height: 13,
                    animation: "spin 1s linear infinite",
                  }}
                />
              )}
              {testResult === "ok" && (
                <CheckCircle2
                  style={{ width: 13, height: 13, color: "#10b981" }}
                />
              )}
              {testResult === "fail" && (
                <XCircle style={{ width: 13, height: 13, color: "#ef4444" }} />
              )}
              {testResult === "idle" && (
                <Database style={{ width: 13, height: 13 }} />
              )}
              {testResult === "ok" ? "Connected!" : "Test & Save"}
            </button>

            <button
              onClick={() => void handleSave()}
              disabled={!name || saving || testResult === "testing"}
              style={{
                flex: 1,
                padding: "9px 16px",
                borderRadius: 10,
                background: "linear-gradient(135deg, #9060f8, #e840c8)",
                color: "white",
                border: "none",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                opacity: !name || saving || testResult === "testing" ? 0.4 : 1,
                boxShadow: "0 2px 12px rgba(144,96,248,0.3)",
                transition: "opacity 0.15s",
              }}
            >
              {saving ? "Saving..." : "Save without test"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
