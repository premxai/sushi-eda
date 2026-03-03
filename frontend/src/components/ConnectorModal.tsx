"use client";

import { useState } from "react";
import { X, Database, Cloud, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { createConnector, testConnector, deleteConnector } from "@/lib/api";

type ConnectorType = "postgres" | "s3";

interface Props {
  open: boolean;
  onClose: () => void;
  orgId?: string;
  onCreated?: () => void;
}

const DEFAULT_POSTGRES = {
  host: "", port: "5432", database: "", username: "", password: "", ssl_mode: "require",
};
const DEFAULT_S3 = {
  bucket: "", region: "us-east-1", access_key_id: "", secret_access_key: "", endpoint_url: "",
};

export default function ConnectorModal({ open, onClose, orgId = "default", onCreated }: Props) {
  const [connectorType, setConnectorType] = useState<ConnectorType>("postgres");
  const [name, setName] = useState("");
  const [pgFields, setPgFields] = useState(DEFAULT_POSTGRES);
  const [s3Fields, setS3Fields] = useState(DEFAULT_S3);
  const [testResult, setTestResult] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function buildBody() {
    if (connectorType === "postgres") {
      return { type: "postgres", name, ...pgFields, port: Number(pgFields.port) };
    }
    return {
      type: "s3", name, ...s3Fields,
      endpoint_url: s3Fields.endpoint_url || undefined,
    };
  }

  async function handleTest() {
    setError(null);
    setTestResult("testing");
    try {
      const connector = await createConnector(buildBody(), orgId);
      const result = await testConnector(connector.connector_id, orgId);
      setTestResult(result.ok ? "ok" : "fail");
      if (!result.ok) {
        await deleteConnector(connector.connector_id, orgId);
      } else {
        onCreated?.();
        setTimeout(handleClose, 1200);
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setTestResult("fail");
      setError(e?.response?.data?.detail || "Connection test failed");
    }
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await createConnector(buildBody(), orgId);
      onCreated?.();
      handleClose();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to save connector");
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setName("");
    setPgFields(DEFAULT_POSTGRES);
    setS3Fields(DEFAULT_S3);
    setTestResult("idle");
    setError(null);
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

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      {/* Backdrop */}
      <div
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(6px)" }}
        onClick={handleClose}
      />

      {/* Modal */}
      <div style={{
        position: "relative", zIndex: 10,
        width: "100%", maxWidth: 440,
        background: "rgba(255,255,255,0.9)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.9)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.95)",
        overflow: "hidden",
      }}>
        {/* Iridescent top stripe */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: "linear-gradient(90deg, #9060f8, #e840c8, #00d4e8)",
        }} />

        <div style={{ padding: 24 }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "#111010", marginBottom: 3 }}>Add Data Connector</h2>
              <p style={{ fontSize: 12, color: "#9a9690" }}>Connect to a live data source</p>
            </div>
            <button
              onClick={handleClose}
              style={{
                padding: 6, borderRadius: 8, border: "none",
                background: "rgba(0,0,0,0.06)", cursor: "pointer",
                color: "#6b6860", display: "flex", alignItems: "center",
              }}
            >
              <X style={{ width: 15, height: 15 }} />
            </button>
          </div>

          {/* Type toggle */}
          <div style={{
            display: "flex", gap: 4,
            background: "rgba(0,0,0,0.05)",
            borderRadius: 12, padding: 3,
            marginBottom: 20,
          }}>
            {([
              { type: "postgres" as ConnectorType, icon: Database, label: "PostgreSQL" },
              { type: "s3" as ConnectorType, icon: Cloud, label: "S3 / R2" },
            ]).map(({ type, icon: Icon, label }) => (
              <button
                key={type}
                onClick={() => setConnectorType(type)}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  padding: "8px 12px", borderRadius: 9, fontSize: 13,
                  fontWeight: connectorType === type ? 500 : 400,
                  color: connectorType === type ? "#111010" : "#6b6860",
                  background: connectorType === type ? "white" : "transparent",
                  boxShadow: connectorType === type ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                  border: "none", cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <Icon style={{ width: 14, height: 14 }} />
                {label}
              </button>
            ))}
          </div>

          {/* Name */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Connection name</label>
            <input
              style={inputStyle}
              placeholder="My production DB"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Postgres fields */}
          {connectorType === "postgres" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
                <div>
                  <label style={labelStyle}>Host</label>
                  <input style={inputStyle} placeholder="db.example.com"
                    value={pgFields.host} onChange={(e) => setPgFields(f => ({ ...f, host: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Port</label>
                  <input style={inputStyle} placeholder="5432"
                    value={pgFields.port} onChange={(e) => setPgFields(f => ({ ...f, port: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Database</label>
                <input style={inputStyle} placeholder="mydb"
                  value={pgFields.database} onChange={(e) => setPgFields(f => ({ ...f, database: e.target.value }))} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={labelStyle}>Username</label>
                  <input style={inputStyle} placeholder="postgres"
                    value={pgFields.username} onChange={(e) => setPgFields(f => ({ ...f, username: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Password</label>
                  <input style={inputStyle} type="password" placeholder="••••••••"
                    value={pgFields.password} onChange={(e) => setPgFields(f => ({ ...f, password: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>SSL mode</label>
                <select style={{ ...inputStyle }}
                  value={pgFields.ssl_mode} onChange={(e) => setPgFields(f => ({ ...f, ssl_mode: e.target.value }))}>
                  <option value="require">require</option>
                  <option value="prefer">prefer</option>
                  <option value="disable">disable</option>
                </select>
              </div>
            </div>
          )}

          {/* S3 fields */}
          {connectorType === "s3" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              <div>
                <label style={labelStyle}>Bucket</label>
                <input style={inputStyle} placeholder="my-data-bucket"
                  value={s3Fields.bucket} onChange={(e) => setS3Fields(f => ({ ...f, bucket: e.target.value }))} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={labelStyle}>Region</label>
                  <input style={inputStyle} placeholder="us-east-1"
                    value={s3Fields.region} onChange={(e) => setS3Fields(f => ({ ...f, region: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>
                    Endpoint URL <span style={{ color: "#9a9690", fontWeight: 400 }}>(R2/MinIO)</span>
                  </label>
                  <input style={inputStyle} placeholder="https://..."
                    value={s3Fields.endpoint_url} onChange={(e) => setS3Fields(f => ({ ...f, endpoint_url: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Access Key ID</label>
                <input style={inputStyle} placeholder="AKIAIOSFODNN7EXAMPLE"
                  value={s3Fields.access_key_id} onChange={(e) => setS3Fields(f => ({ ...f, access_key_id: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Secret Access Key</label>
                <input style={inputStyle} type="password" placeholder="••••••••"
                  value={s3Fields.secret_access_key} onChange={(e) => setS3Fields(f => ({ ...f, secret_access_key: e.target.value }))} />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              marginTop: 12, display: "flex", gap: 7, alignItems: "flex-start",
              padding: "8px 12px", borderRadius: 8,
              background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)",
            }}>
              <XCircle style={{ width: 14, height: 14, color: "#ef4444", flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: "#ef4444" }}>{error}</p>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <button
              onClick={handleTest}
              disabled={!name || testResult === "testing" || saving}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "9px 16px", borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.1)",
                background: "rgba(255,255,255,0.8)",
                fontSize: 13, fontWeight: 500, color: "#111010",
                cursor: "pointer",
                opacity: (!name || testResult === "testing" || saving) ? 0.4 : 1,
                transition: "opacity 0.15s",
              }}
            >
              {testResult === "testing" && <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} />}
              {testResult === "ok"      && <CheckCircle2 style={{ width: 13, height: 13, color: "#10b981" }} />}
              {testResult === "fail"    && <XCircle style={{ width: 13, height: 13, color: "#ef4444" }} />}
              {testResult === "idle"    && <Database style={{ width: 13, height: 13 }} />}
              {testResult === "ok" ? "Connected!" : "Test & Save"}
            </button>

            <button
              onClick={handleSave}
              disabled={!name || saving || testResult === "testing"}
              style={{
                flex: 1, padding: "9px 16px", borderRadius: 10,
                background: "linear-gradient(135deg, #9060f8, #e840c8)",
                color: "white", border: "none", fontSize: 13, fontWeight: 500,
                cursor: "pointer",
                opacity: (!name || saving || testResult === "testing") ? 0.4 : 1,
                boxShadow: "0 2px 12px rgba(144,96,248,0.3)",
                transition: "opacity 0.15s",
              }}
            >
              {saving ? "Saving…" : "Save without test"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
