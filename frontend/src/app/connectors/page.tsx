"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  Cloud,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Table2,
  ArrowRight,
  AlertCircle,
  Unplug,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { SignedIn, UserButton } from "@/lib/auth";
import {
  listConnectors,
  deleteConnector,
  testConnector,
  listConnectorTables,
  importFromConnector,
  ConnectorSummary,
} from "@/lib/api";
import ConnectorModal from "@/components/ConnectorModal";

const ORG_ID = "default";

type TableEntry = {
  schema?: string;
  name: string;
  type?: string;
  estimated_rows?: number;
  resource?: string;
};
type S3Object = {
  key: string;
  size_bytes: number;
  last_modified: string;
  extension: string;
};

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatBytes(b: number): string {
  if (b === 0) return "0 B";
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(1)} ${["B", "KB", "MB", "GB"][i]}`;
}

// ── Connector card ────────────────────────────────────────────────────────────

function ConnectorCard({
  connector,
  onDelete,
  onRefresh,
}: {
  connector: ConnectorSummary;
  onDelete: (id: string) => void;
  onRefresh: (id: string) => void;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [tables, setTables] = useState<TableEntry[] | S3Object[] | null>(null);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [importingKey, setImportingKey] = useState<string | null>(null);
  const [importName, setImportName] = useState("");
  const [importTarget, setImportTarget] = useState<TableEntry | S3Object | null>(null);
  const [customQuery, setCustomQuery] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  const isPostgres = connector.connector_type === "postgres";
  const isS3 = connector.connector_type === "s3";
  const isGoogleSheets = connector.connector_type === "google_sheets";
  const isRest = connector.connector_type === "rest";
  const isTabularConnector = !isS3;

  async function handleExpand() {
    if (expanded) { setExpanded(false); return; }
    setExpanded(true);
    if (tables !== null) return;
    setTablesLoading(true);
    try {
      const data = await listConnectorTables(connector.connector_id, ORG_ID);
      if (isS3) {
        setTables((data.objects ?? []) as S3Object[]);
      } else {
        setTables((data.tables ?? []) as TableEntry[]);
      }
    } catch {
      setTables([]);
    } finally {
      setTablesLoading(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      await testConnector(connector.connector_id, ORG_ID);
      onRefresh(connector.connector_id);
    } finally {
      setTesting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteConnector(connector.connector_id, ORG_ID);
      onDelete(connector.connector_id);
    } finally {
      setDeleting(false);
    }
  }

  async function handleImport() {
    if (!importTarget) return;
    setImportError(null);
    const selectedIsS3 = "key" in importTarget;
    const body: Record<string, unknown> = {
      name: importName || (selectedIsS3 ? (importTarget as S3Object).key.split("/").pop() : (importTarget as TableEntry).name),
    };
    if (selectedIsS3) {
      body.key = (importTarget as S3Object).key;
    } else if (isPostgres && customQuery.trim()) {
      body.query = customQuery.trim();
    } else if (isRest) {
      body.table = (importTarget as TableEntry).name;
    } else {
      const selectedTable = importTarget as TableEntry;
      if (isPostgres) {
        body.schema = selectedTable.schema ?? "public";
      }
      body.table = selectedTable.name;
    }
    const key = selectedIsS3
      ? (importTarget as S3Object).key
      : `${(importTarget as TableEntry).schema ?? ""}.${(importTarget as TableEntry).name}`;
    setImportingKey(key);
    try {
      const result = await importFromConnector(connector.connector_id, body, ORG_ID);
      if (result.dataset_id) {
        sessionStorage.setItem("eda_dataset_id", result.dataset_id);
        router.push("/datasets");
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setImportError(err?.response?.data?.detail ?? "Import failed");
      setImportingKey(null);
    }
  }

  const statusColor = connector.last_test_ok === true
    ? "#10b981"
    : connector.last_test_ok === false
      ? "#ef4444"
      : "#9a9690";

  const statusLabel = connector.last_test_ok === true
    ? "Connected"
    : connector.last_test_ok === false
      ? "Failed"
      : "Untested";

  const connectorTypeConfig = isPostgres
    ? {
        background: "linear-gradient(135deg, rgba(59,130,246,0.1), rgba(99,102,241,0.12))",
        icon: <Database style={{ width: 18, height: 18, color: "#3b82f6" }} />,
        label: "postgresql",
      }
    : isS3
      ? {
          background: "linear-gradient(135deg, rgba(245,158,11,0.1), rgba(249,115,22,0.12))",
          icon: <Cloud style={{ width: 18, height: 18, color: "#f59e0b" }} />,
          label: "s3 / object storage",
        }
      : isGoogleSheets
        ? {
            background: "linear-gradient(135deg, rgba(34,197,94,0.1), rgba(16,185,129,0.12))",
            icon: <Table2 style={{ width: 18, height: 18, color: "#10b981" }} />,
            label: "google sheets",
          }
        : {
            background: "linear-gradient(135deg, rgba(14,165,233,0.1), rgba(59,130,246,0.12))",
            icon: <Globe style={{ width: 18, height: 18, color: "#0ea5e9" }} />,
            label: "rest api",
          };

  return (
    <div style={{
      background: "rgba(255,255,255,0.72)",
      border: "1px solid rgba(255,255,255,0.8)",
      borderRadius: 16,
      overflow: "hidden",
      boxShadow: "0 2px 16px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
    }}>
      {/* Header row */}
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
        {/* Type icon */}
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: connectorTypeConfig.background,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {connectorTypeConfig.icon}
        </div>

        {/* Name + type */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: "#111010", marginBottom: 2 }}>
            {connector.name}
          </p>
          <p style={{
            fontSize: 11, color: "#9a9690",
            fontFamily: "ui-monospace, Menlo, monospace",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}>
            {connectorTypeConfig.label}
          </p>
        </div>

        {/* Status pill */}
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "4px 10px", borderRadius: 99,
          background: connector.last_test_ok === true
            ? "rgba(16,185,129,0.1)"
            : connector.last_test_ok === false
              ? "rgba(239,68,68,0.1)"
              : "rgba(0,0,0,0.06)",
          flexShrink: 0,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: statusColor, fontWeight: 500 }}>{statusLabel}</span>
          {connector.last_tested_at && (
            <span style={{ fontSize: 11, color: "#9a9690", marginLeft: 2 }}>
              {timeAgo(connector.last_tested_at)}
            </span>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button
            onClick={handleTest}
            disabled={testing}
            title="Test connection"
            style={{
              padding: "7px 10px", borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.1)",
              background: "transparent", cursor: "pointer",
              color: "#6b6860", fontSize: 12,
              display: "flex", alignItems: "center", gap: 5,
              transition: "background 0.15s",
            }}
          >
            {testing
              ? <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} />
              : <RefreshCw style={{ width: 13, height: 13 }} />}
            <span>Test</span>
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            title="Delete connector"
            style={{
              padding: "7px 10px", borderRadius: 8,
              border: "1px solid rgba(239,68,68,0.2)",
              background: "transparent", cursor: "pointer",
              color: "#ef4444",
              display: "flex", alignItems: "center",
              transition: "background 0.15s",
            }}
          >
            {deleting
              ? <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} />
              : <Trash2 style={{ width: 13, height: 13 }} />}
          </button>
          <button
            onClick={handleExpand}
            style={{
              padding: "7px 10px", borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.1)",
              background: expanded ? "rgba(144,96,248,0.08)" : "transparent",
              cursor: "pointer",
              color: expanded ? "#9060f8" : "#6b6860",
              display: "flex", alignItems: "center", gap: 5,
              fontSize: 12, fontWeight: 500,
              transition: "background 0.15s",
            }}
          >
            {expanded
              ? <ChevronDown style={{ width: 13, height: 13 }} />
              : <ChevronRight style={{ width: 13, height: 13 }} />}
            Browse
          </button>
        </div>
      </div>

      {/* Expanded: table browser */}
      {expanded && (
        <div style={{
          borderTop: "1px solid rgba(0,0,0,0.06)",
          background: "linear-gradient(145deg, rgba(14,14,22,0.93), rgba(8,8,16,0.97))",
          padding: 20,
        }}>
          {/* Iridescent stripe */}
          <div style={{
            position: "absolute", left: 0, right: 0, height: 1, marginTop: -20,
            background: "linear-gradient(90deg, transparent, rgba(0,212,232,0.4), rgba(144,96,248,0.4), rgba(232,64,200,0.4), transparent)",
            pointerEvents: "none",
          }} />

          {tablesLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
              <Loader2 style={{ width: 20, height: 20, color: "#9060f8", animation: "spin 1s linear infinite" }} />
            </div>
          ) : !tables || tables.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <Table2 style={{ width: 28, height: 28, color: "rgba(255,255,255,0.2)", margin: "0 auto 10px" }} />
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>
                {isS3 ? "No objects found" : "No resources found"}
              </p>
            </div>
          ) : (
            <div>
              <p style={{
                fontSize: 9, fontFamily: "ui-monospace, Menlo, monospace",
                letterSpacing: "2px", textTransform: "uppercase",
                color: "rgba(255,255,255,0.3)", marginBottom: 12,
              }}>
                {isS3 ? `${tables.length} objects` : `${tables.length} resources`}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 320, overflowY: "auto" }}>
                {isTabularConnector
                  ? (tables as TableEntry[]).map((t, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "10px 14px", borderRadius: 10,
                          background: importTarget === t
                            ? "rgba(144,96,248,0.18)"
                            : "rgba(255,255,255,0.06)",
                          border: importTarget === t
                            ? "1px solid rgba(144,96,248,0.35)"
                            : "1px solid rgba(255,255,255,0.07)",
                          cursor: "pointer",
                          transition: "background 0.12s",
                        }}
                        onClick={() => {
                          setImportTarget(t);
                          setImportName(t.name);
                          if (isPostgres) setCustomQuery("");
                          setImportError(null);
                        }}
                      >
                        <Table2 style={{ width: 13, height: 13, color: "rgba(255,255,255,0.35)", flexShrink: 0 }} />
                        <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, color: "rgba(255,255,255,0.8)", flex: 1 }}>
                          {isPostgres && t.schema && t.schema !== "public" ? `${t.schema}.` : ""}{t.name}
                        </span>
                        {t.estimated_rows != null && t.estimated_rows > 0 && (
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "ui-monospace, Menlo, monospace" }}>
                            ~{t.estimated_rows.toLocaleString()} rows
                          </span>
                        )}
                        {t.type && (
                          <span style={{ padding: "2px 6px", borderRadius: 5, fontSize: 10, background: "rgba(0,212,232,0.15)", color: "#00d4e8" }}>
                            {t.type}
                          </span>
                        )}
                      </div>
                    ))
                  : (tables as S3Object[]).map((obj, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "10px 14px", borderRadius: 10,
                          background: importTarget === obj
                            ? "rgba(144,96,248,0.18)"
                            : "rgba(255,255,255,0.06)",
                          border: importTarget === obj
                            ? "1px solid rgba(144,96,248,0.35)"
                            : "1px solid rgba(255,255,255,0.07)",
                          cursor: "pointer",
                          transition: "background 0.12s",
                        }}
                        onClick={() => {
                          setImportTarget(obj);
                          setImportName(obj.key.split("/").pop() ?? obj.key);
                          setImportError(null);
                        }}
                      >
                        <span style={{ padding: "2px 6px", borderRadius: 5, fontSize: 10, fontWeight: 600, background: "rgba(144,96,248,0.18)", color: "#9060f8", flexShrink: 0, fontFamily: "ui-monospace, Menlo, monospace" }}>
                          {obj.extension.replace(".", "")}
                        </span>
                        <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, color: "rgba(255,255,255,0.8)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {obj.key}
                        </span>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>
                          {formatBytes(obj.size_bytes)}
                        </span>
                      </div>
                    ))
                }
              </div>

              {/* Import panel — shows when a table/object is selected */}
              {importTarget && (
                <div style={{
                  marginTop: 16, padding: "16px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                }}>
                  <p style={{
                    fontSize: 9, fontFamily: "ui-monospace, Menlo, monospace",
                    letterSpacing: "2px", textTransform: "uppercase",
                    color: "rgba(255,255,255,0.3)", marginBottom: 12,
                  }}>
                    Import as dataset
                  </p>
                  <div style={{ display: "flex", gap: 8, marginBottom: isPostgres ? 10 : 0 }}>
                    <input
                      value={importName}
                      onChange={(e) => setImportName(e.target.value)}
                      placeholder="Dataset name"
                      style={{
                        flex: 1, padding: "8px 12px", borderRadius: 8, fontSize: 13,
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        color: "rgba(255,255,255,0.88)",
                        outline: "none",
                      }}
                    />
                  </div>
                  {isPostgres && (
                    <textarea
                      value={customQuery}
                      onChange={(e) => setCustomQuery(e.target.value)}
                      placeholder={`Optional: custom SQL query\nSELECT * FROM "${(importTarget as TableEntry).name}" WHERE ...`}
                      rows={3}
                      style={{
                        width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 12,
                        fontFamily: "ui-monospace, Menlo, monospace",
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "rgba(255,255,255,0.7)",
                        outline: "none", resize: "vertical",
                        marginBottom: 10,
                        boxSizing: "border-box",
                      }}
                    />
                  )}
                  {isGoogleSheets && (
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 10 }}>
                      Import reads the selected sheet resource as tabular data.
                    </p>
                  )}
                  {isRest && (
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 10 }}>
                      Import fetches the selected endpoint and normalizes JSON into rows.
                    </p>
                  )}
                  {importError && (
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 10 }}>
                      <AlertCircle style={{ width: 13, height: 13, color: "#ef4444", flexShrink: 0 }} />
                      <p style={{ fontSize: 12, color: "#ef4444" }}>{importError}</p>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      onClick={handleImport}
                      disabled={importingKey !== null}
                      style={{
                        display: "flex", alignItems: "center", gap: 7,
                        padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                        background: "linear-gradient(135deg, #9060f8, #e840c8)",
                        color: "white", border: "none", cursor: "pointer",
                        boxShadow: "0 2px 12px rgba(144,96,248,0.3)",
                        opacity: importingKey !== null ? 0.7 : 1,
                      }}
                    >
                      {importingKey !== null
                        ? <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} />
                        : <ArrowRight style={{ width: 13, height: 13 }} />}
                      Import & Analyze
                    </button>
                    <button
                      onClick={() => { setImportTarget(null); setImportError(null); }}
                      style={{
                        padding: "8px 14px", borderRadius: 8, fontSize: 13,
                        background: "transparent", border: "1px solid rgba(255,255,255,0.12)",
                        color: "rgba(255,255,255,0.5)", cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<ConnectorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listConnectors(ORG_ID);
      setConnectors(data);
    } catch {
      setConnectors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleDelete(id: string) {
    setConnectors((prev) => prev.filter((c) => c.connector_id !== id));
  }

  async function handleRefresh(id: string) {
    try {
      const fresh = await listConnectors(ORG_ID);
      const updated = fresh.find((c) => c.connector_id === id);
      if (updated) setConnectors((prev) => prev.map((c) => c.connector_id === id ? updated : c));
    } catch { /* silent */ }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f0eee9" }}>

      {/* ── NAV ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(240,238,233,0.88)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0,0,0,0.07)",
        padding: "0 48px",
        height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(144,96,248,0.5), rgba(232,64,200,0.5), transparent)" }} />
        <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <Image src="/sushi-logo.png" alt="Sushi" width={28} height={28} />
          <span style={{ fontWeight: 600, fontSize: 17, color: "#111010", letterSpacing: "-0.3px" }}>Sushi</span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/datasets" style={{ fontSize: 13, color: "#6b6860", textDecoration: "none" }}>
            My Datasets
          </Link>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: "linear-gradient(135deg, #9060f8, #e840c8)",
              color: "white", border: "none", cursor: "pointer",
              boxShadow: "0 2px 12px rgba(144,96,248,0.3)",
            }}
          >
            <Plus size={13} />
            New connector
          </button>
          <SignedIn>
            <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
          </SignedIn>
        </div>
      </nav>

      {/* ── CONTENT ── */}
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "48px 24px" }}>

        {/* Heading */}
        <div style={{ marginBottom: 36 }}>
          <h1 className="font-display" style={{ fontSize: 38, fontWeight: 400, color: "#111010", lineHeight: 1.15, marginBottom: 8 }}>
            Connections
          </h1>
          <p style={{ fontSize: 14, color: "#6b6860" }}>
            {loading
              ? "Loading..."
              : connectors.length > 0
                ? `${connectors.length} data source${connectors.length !== 1 ? "s" : ""} connected`
                : "Connect databases, cloud files, sheets, and APIs directly. No CSV export loop."}
          </p>
        </div>

        {/* Connector list */}
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
            <Loader2 style={{ width: 22, height: 22, color: "#9060f8", animation: "spin 1s linear infinite" }} />
          </div>
        ) : connectors.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{
              width: 72, height: 72, borderRadius: 20, margin: "0 auto 20px",
              background: "linear-gradient(135deg, rgba(144,96,248,0.12), rgba(232,64,200,0.12))",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Unplug style={{ width: 32, height: 32, color: "#9060f8" }} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 500, color: "#111010", marginBottom: 8 }}>
              No connections yet
            </p>
            <p style={{ fontSize: 13, color: "#6b6860", marginBottom: 24, maxWidth: 360, margin: "0 auto 24px" }}>
              Connect PostgreSQL, S3, Google Sheets, and REST APIs to import data directly without downloading files.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
              {[
                { icon: Database, label: "PostgreSQL", color: "#3b82f6" },
                { icon: Cloud, label: "S3 / R2", color: "#f59e0b" },
                { icon: Table2, label: "Google Sheets", color: "#10b981" },
                { icon: Globe, label: "REST API", color: "#0ea5e9" },
              ].map(({ icon: Icon, label, color }) => (
                <button
                  key={label}
                  onClick={() => setModalOpen(true)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 20px", borderRadius: 12,
                    background: "rgba(255,255,255,0.72)",
                    border: "1px solid rgba(255,255,255,0.8)",
                    boxShadow: "0 2px 16px rgba(0,0,0,0.05)",
                    cursor: "pointer", fontSize: 13.5, fontWeight: 500,
                    color: "#111010",
                  }}
                >
                  <Icon style={{ width: 16, height: 16, color }} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {connectors.map((c) => (
              <ConnectorCard
                key={c.connector_id}
                connector={c}
                onDelete={handleDelete}
                onRefresh={handleRefresh}
              />
            ))}
            {/* Add more */}
            <button
              onClick={() => setModalOpen(true)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "13px 20px", borderRadius: 16,
                background: "rgba(255,255,255,0.4)",
                border: "1.5px dashed rgba(144,96,248,0.3)",
                cursor: "pointer", fontSize: 13.5, color: "#9060f8", fontWeight: 500,
                transition: "background 0.15s",
              }}
            >
              <Plus style={{ width: 15, height: 15 }} />
              Add another connection
            </button>
          </div>
        )}

        {/* Info cards */}
        {!loading && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 48 }}>
            {[
              { icon: CheckCircle2, label: "PostgreSQL", desc: "Connect to any Postgres database. Browse tables, run custom queries, import directly.", color: "#3b82f6" },
              { icon: Cloud, label: "S3 / R2 / MinIO", desc: "Import CSV, Parquet, TSV, or JSON files from any S3-compatible object storage.", color: "#f59e0b" },
              { icon: Globe, label: "Sheets + REST", desc: "Ingest Google Sheets and REST API JSON payloads directly as datasets.", color: "#10b981" },
            ].map(({ icon: Icon, label, desc, color }) => (
              <div key={label} style={{
                padding: "16px 18px", borderRadius: 14,
                background: "rgba(255,255,255,0.55)",
                border: "1px solid rgba(255,255,255,0.7)",
                boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, marginBottom: 10,
                  background: `${color}18`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon style={{ width: 15, height: 15, color }} />
                </div>
                <p style={{ fontSize: 13, fontWeight: 500, color: "#111010", marginBottom: 4 }}>{label}</p>
                <p style={{ fontSize: 12, color: "#9a9690", lineHeight: 1.5 }}>{desc}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      <ConnectorModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        orgId={ORG_ID}
        onCreated={() => { setModalOpen(false); load(); }}
      />
    </div>
  );
}
