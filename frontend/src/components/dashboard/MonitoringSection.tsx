"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  Play,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  deleteMonitor,
  getMonitorRuns,
  listMonitors,
  MonitorRun,
  MonitorSummary,
  triggerMonitorRun,
  updateMonitor,
} from "@/lib/api";
import MonitorCreateModal from "@/components/MonitorCreateModal";

interface Props {
  datasetId: string | null;
  orgId?: string;
}

const CHECK_TYPE_LABELS: Record<string, string> = {
  row_count: "Row count",
  null_rate: "Null rate",
  quality_score: "Quality score",
  column_drift: "Column drift",
};

const CONDITION_LABELS: Record<string, string> = {
  lt: "<",
  gt: ">",
  eq: "=",
  change_pct: "Δ%",
};

function StatusDot({ status }: { status: string | null }) {
  if (!status) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 11,
          color: "#9a9690",
          fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
        }}
      >
        <Clock size={10} /> never run
      </span>
    );
  }
  const ok = status === "ok";
  const firing = status === "firing";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        color: ok ? "#22c55e" : firing ? "#ef4444" : "#9a9690",
        fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
      }}
    >
      {ok ? (
        <CheckCircle2 size={10} />
      ) : firing ? (
        <XCircle size={10} />
      ) : (
        <AlertTriangle size={10} />
      )}
      {status}
    </span>
  );
}

function RunHistoryRow({ run }: { run: MonitorRun }) {
  const ok = run.status === "ok";
  const firing = run.status === "firing";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "5px 0",
        borderBottom: "1px solid rgba(0,0,0,0.04)",
        fontSize: 12,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          flexShrink: 0,
          background: ok ? "#22c55e" : firing ? "#ef4444" : "#d1d5db",
        }}
      />
      <span
        style={{
          color: "#6b6860",
          fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
          fontSize: 11,
          flexShrink: 0,
        }}
      >
        {new Date(run.ran_at).toLocaleString()}
      </span>
      {run.actual_value !== null && (
        <span style={{ color: "#9060f8", fontWeight: 500, flexShrink: 0 }}>
          {typeof run.actual_value === "number"
            ? run.actual_value.toFixed(2)
            : run.actual_value}
        </span>
      )}
      {run.message && (
        <span
          style={{
            color: "#6b6860",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {run.message}
        </span>
      )}
    </div>
  );
}

function MonitorCard({
  monitor,
  orgId,
  onDeleted,
  onUpdated,
}: {
  monitor: MonitorSummary;
  orgId: string;
  onDeleted: () => void;
  onUpdated: (m: MonitorSummary) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [runs, setRuns] = useState<MonitorRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);

  const loadRuns = useCallback(async () => {
    if (!expanded) return;
    setRunsLoading(true);
    try {
      const r = await getMonitorRuns(monitor.monitor_id, orgId, 10);
      setRuns(r);
    } finally {
      setRunsLoading(false);
    }
  }, [expanded, monitor.monitor_id, orgId]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  async function handleRun() {
    setRunning(true);
    try {
      await triggerMonitorRun(monitor.monitor_id, orgId);
    } finally {
      setRunning(false);
      setTimeout(() => loadRuns(), 1000);
    }
  }

  async function handleToggle() {
    setToggling(true);
    try {
      const updated = await updateMonitor(
        monitor.monitor_id,
        { is_active: !monitor.is_active },
        orgId,
      );
      onUpdated(updated);
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete monitor "${monitor.name}"?`)) return;
    setDeleting(true);
    try {
      await deleteMonitor(monitor.monitor_id, orgId);
      onDeleted();
    } finally {
      setDeleting(false);
    }
  }

  const isFiring = monitor.last_status === "firing";

  return (
    <div
      style={{
        background: isFiring
          ? "linear-gradient(145deg, rgba(239,68,68,0.06), rgba(239,68,68,0.02))"
          : "rgba(255,255,255,0.72)",
        border: `1px solid ${isFiring ? "rgba(239,68,68,0.2)" : "rgba(0,0,0,0.07)"}`,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      {/* Iridescent top stripe */}
      <div
        style={{
          height: 3,
          background: isFiring
            ? "linear-gradient(90deg, #ef4444, #f97316)"
            : "linear-gradient(90deg, #9060f8, #e840c8, #00d4e8, #9060f8)",
          backgroundSize: "200% 100%",
          animation: isFiring ? "none" : "shimmer 4s linear infinite",
        }}
      />

      <div style={{ padding: "14px 16px" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              color: "#9a9690",
              flexShrink: 0,
            }}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  color: "#111010",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {monitor.name}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  padding: "1px 6px",
                  borderRadius: 20,
                  background: monitor.is_active
                    ? "rgba(144,96,248,0.1)"
                    : "rgba(0,0,0,0.06)",
                  color: monitor.is_active ? "#9060f8" : "#9a9690",
                  fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
                  flexShrink: 0,
                }}
              >
                {monitor.is_active ? "active" : "paused"}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 3,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: "#9a9690",
                  fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
                }}
              >
                {CHECK_TYPE_LABELS[monitor.check_type] ?? monitor.check_type}
                {monitor.column_name ? ` · ${monitor.column_name}` : ""}{" "}
                {CONDITION_LABELS[monitor.condition] ?? monitor.condition}{" "}
                {monitor.threshold}
              </span>
              <StatusDot status={monitor.last_status} />
            </div>
          </div>

          {/* Actions */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              flexShrink: 0,
            }}
          >
            <button
              onClick={handleToggle}
              disabled={toggling}
              title={monitor.is_active ? "Pause" : "Resume"}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px 6px",
                borderRadius: 6,
                fontSize: 11,
                color: "#9a9690",
                opacity: toggling ? 0.5 : 1,
              }}
            >
              {monitor.is_active ? "Pause" : "Resume"}
            </button>
            <button
              onClick={handleRun}
              disabled={running}
              title="Run now"
              style={{
                background: "rgba(144,96,248,0.1)",
                border: "none",
                cursor: "pointer",
                padding: "4px 8px",
                borderRadius: 6,
                color: "#9060f8",
                display: "flex",
                alignItems: "center",
                gap: 4,
                opacity: running ? 0.6 : 1,
              }}
            >
              {running ? (
                <Loader2
                  size={11}
                  style={{ animation: "spin 1s linear infinite" }}
                />
              ) : (
                <Play size={11} />
              )}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              title="Delete"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px 6px",
                borderRadius: 6,
                color: "#ef4444",
                opacity: deleting ? 0.5 : 1,
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Run history */}
        {expanded && (
          <div
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            <p
              style={{
                fontSize: 9,
                letterSpacing: "1.5px",
                textTransform: "uppercase",
                color: "#9a9690",
                marginBottom: 6,
                fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
              }}
            >
              Run history
            </p>
            {runsLoading ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: "#9a9690",
                  fontSize: 12,
                }}
              >
                <Loader2
                  size={12}
                  style={{ animation: "spin 1s linear infinite" }}
                />{" "}
                Loading…
              </div>
            ) : runs.length === 0 ? (
              <p style={{ fontSize: 12, color: "#9a9690" }}>
                No runs yet. Click Run now to trigger the first check.
              </p>
            ) : (
              <div>
                {runs.map((r) => (
                  <RunHistoryRow key={r.run_id} run={r} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function MonitoringSection({ datasetId, orgId = "default" }: Props) {
  const [monitors, setMonitors] = useState<MonitorSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!datasetId) return;
    setLoading(true);
    try {
      const m = await listMonitors(datasetId, orgId);
      setMonitors(m);
    } finally {
      setLoading(false);
    }
  }, [datasetId, orgId]);

  useEffect(() => {
    load();
  }, [load]);

  function handleUpdated(updated: MonitorSummary) {
    setMonitors((prev) =>
      prev.map((m) => (m.monitor_id === updated.monitor_id ? updated : m)),
    );
  }

  if (!datasetId || datasetId === "local") {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#9a9690" }}>
        <Bell size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
        <p style={{ fontSize: 14 }}>Monitors require a backend connection.</p>
        <p style={{ fontSize: 12, marginTop: 6, color: "#c8c4be" }}>
          Upload your dataset with the backend running to create monitors.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 32px", maxWidth: 820, margin: "0 auto" }}>
      <style>{`
        @keyframes shimmer { 0% { background-position: 0% 0; } 100% { background-position: 200% 0; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "#111010",
              margin: 0,
            }}
          >
            Monitors
          </h2>
          <p style={{ fontSize: 13, color: "#9a9690", margin: "4px 0 0" }}>
            Track data quality thresholds and get alerted when something drifts.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "9px 16px",
            borderRadius: 10,
            background: "linear-gradient(135deg, #9060f8, #e840c8)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
          }}
        >
          <Plus size={14} />
          New monitor
        </button>
      </div>

      {/* Empty / Loading */}
      {loading ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "#9a9690",
            padding: "32px 0",
          }}
        >
          <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
          Loading monitors…
        </div>
      ) : monitors.length === 0 ? (
        <div
          style={{
            background: "rgba(255,255,255,0.72)",
            border: "1px dashed rgba(0,0,0,0.12)",
            borderRadius: 16,
            padding: 48,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Bell size={36} style={{ color: "#d1c8f8", opacity: 0.7 }} />
          <div style={{ textAlign: "center" }}>
            <p
              style={{
                fontWeight: 600,
                fontSize: 15,
                color: "#111010",
                margin: "0 0 4px",
              }}
            >
              No monitors yet
            </p>
            <p style={{ fontSize: 13, color: "#9a9690", margin: 0 }}>
              Create a monitor to track row count, null rates, quality score, or
              column drift.
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              marginTop: 8,
              padding: "8px 20px",
              borderRadius: 10,
              background: "rgba(144,96,248,0.1)",
              color: "#9060f8",
              fontSize: 13,
              fontWeight: 600,
              border: "1px solid rgba(144,96,248,0.2)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Plus size={14} /> Create first monitor
          </button>
        </div>
      ) : (
        <>
          {/* Status summary bar */}
          <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
            {[
              { label: "Total", value: monitors.length, color: "#111010" },
              {
                label: "Active",
                value: monitors.filter((m) => m.is_active).length,
                color: "#9060f8",
              },
              {
                label: "Firing",
                value: monitors.filter((m) => m.last_status === "firing")
                  .length,
                color: "#ef4444",
              },
              {
                label: "OK",
                value: monitors.filter((m) => m.last_status === "ok").length,
                color: "#22c55e",
              },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                style={{
                  background: "rgba(255,255,255,0.72)",
                  border: "1px solid rgba(0,0,0,0.07)",
                  borderRadius: 10,
                  padding: "10px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <span style={{ fontSize: 20, fontWeight: 700, color }}>
                  {value}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    color: "#9a9690",
                    fontFamily:
                      "ui-monospace, 'Cascadia Code', Menlo, monospace",
                  }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Monitor cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {monitors.map((m) => (
              <MonitorCard
                key={m.monitor_id}
                monitor={m}
                orgId={orgId}
                onDeleted={load}
                onUpdated={handleUpdated}
              />
            ))}
          </div>
        </>
      )}

      <MonitorCreateModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        datasetId={datasetId}
        orgId={orgId}
        onCreated={() => {
          setModalOpen(false);
          load();
        }}
      />
    </div>
  );
}
