"use client";

import { useState } from "react";
import { X, Database, Cloud, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { createConnector, testConnector } from "@/lib/api";

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
      // Create temporarily, test, then delete if user cancels — simpler: test inline via a temp create
      const connector = await createConnector(buildBody(), orgId);
      const result = await testConnector(connector.connector_id, orgId);
      setTestResult(result.ok ? "ok" : "fail");
      if (!result.ok) {
        // Clean up the unsaved connector
        const { deleteConnector } = await import("@/lib/api");
        await deleteConnector(connector.connector_id, orgId);
      } else {
        // Keep it — treat test as implicit save
        onCreated?.();
        setTimeout(() => {
          handleClose();
        }, 1200);
      }
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

  const inputCls =
    "w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 " +
    "focus:outline-none focus:ring-2 focus:ring-violet-300 text-neutral-800 placeholder-neutral-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-neutral-900">Add Data Connector</h2>
          <button onClick={handleClose} className="text-neutral-400 hover:text-neutral-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Connector type tabs */}
        <div className="flex rounded-lg border border-neutral-200 overflow-hidden">
          {(["postgres", "s3"] as ConnectorType[]).map((t) => (
            <button
              key={t}
              onClick={() => setConnectorType(t)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors
                ${connectorType === t
                  ? "bg-neutral-900 text-white"
                  : "bg-white text-neutral-500 hover:bg-neutral-50"
                }`}
            >
              {t === "postgres" ? <Database className="h-4 w-4" /> : <Cloud className="h-4 w-4" />}
              {t === "postgres" ? "PostgreSQL" : "S3 / R2"}
            </button>
          ))}
        </div>

        {/* Name */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-600">Connection name</label>
          <input
            className={inputCls}
            placeholder="My production DB"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Postgres fields */}
        {connectorType === "postgres" && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-medium text-neutral-600">Host</label>
                <input className={inputCls} placeholder="db.example.com"
                  value={pgFields.host} onChange={(e) => setPgFields(f => ({ ...f, host: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-600">Port</label>
                <input className={inputCls} placeholder="5432"
                  value={pgFields.port} onChange={(e) => setPgFields(f => ({ ...f, port: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-600">Database</label>
              <input className={inputCls} placeholder="mydb"
                value={pgFields.database} onChange={(e) => setPgFields(f => ({ ...f, database: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-600">Username</label>
                <input className={inputCls} placeholder="postgres"
                  value={pgFields.username} onChange={(e) => setPgFields(f => ({ ...f, username: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-600">Password</label>
                <input className={inputCls} type="password" placeholder="••••••••"
                  value={pgFields.password} onChange={(e) => setPgFields(f => ({ ...f, password: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-600">SSL mode</label>
              <select className={inputCls}
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
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-600">Bucket</label>
              <input className={inputCls} placeholder="my-data-bucket"
                value={s3Fields.bucket} onChange={(e) => setS3Fields(f => ({ ...f, bucket: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-600">Region</label>
                <input className={inputCls} placeholder="us-east-1"
                  value={s3Fields.region} onChange={(e) => setS3Fields(f => ({ ...f, region: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-600">Endpoint URL <span className="text-neutral-400">(optional)</span></label>
                <input className={inputCls} placeholder="https://..."
                  value={s3Fields.endpoint_url} onChange={(e) => setS3Fields(f => ({ ...f, endpoint_url: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-600">Access Key ID</label>
              <input className={inputCls} placeholder="AKIAIOSFODNN7EXAMPLE"
                value={s3Fields.access_key_id} onChange={(e) => setS3Fields(f => ({ ...f, access_key_id: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-600">Secret Access Key</label>
              <input className={inputCls} type="password" placeholder="••••••••"
                value={s3Fields.secret_access_key} onChange={(e) => setS3Fields(f => ({ ...f, secret_access_key: e.target.value }))} />
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleTest}
            disabled={!name || testResult === "testing" || saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-200
                       text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 transition-colors"
          >
            {testResult === "testing" && <Loader2 className="h-4 w-4 animate-spin" />}
            {testResult === "ok"      && <CheckCircle className="h-4 w-4 text-green-500" />}
            {testResult === "fail"    && <XCircle className="h-4 w-4 text-red-500" />}
            {testResult === "idle"    && <Database className="h-4 w-4" />}
            Test & Save
          </button>

          <button
            onClick={handleSave}
            disabled={!name || saving || testResult === "testing"}
            className="flex-1 py-2 rounded-lg bg-neutral-900 text-white text-sm font-medium
                       hover:bg-neutral-700 disabled:opacity-40 transition-colors"
          >
            {saving ? "Saving…" : "Save without test"}
          </button>
        </div>
      </div>
    </div>
  );
}
