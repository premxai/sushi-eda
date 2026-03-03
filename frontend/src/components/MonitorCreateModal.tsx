"use client";

import { useState } from "react";
import { X, Bell, Loader2 } from "lucide-react";
import { createMonitor } from "@/lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
  datasetId: string;
  orgId?: string;
  onCreated?: () => void;
}

const CHECK_TYPES = [
  { value: "row_count",     label: "Row count" },
  { value: "quality_score", label: "Quality score" },
  { value: "null_rate",     label: "Null rate (column)" },
  { value: "column_drift",  label: "Column mean drift" },
];
const CONDITIONS = [
  { value: "lt", label: "drops below (<)" },
  { value: "gt", label: "exceeds (>)" },
  { value: "eq", label: "equals (=)" },
];

const SCHEDULES = [
  { value: "0 * * * *",    label: "Every hour" },
  { value: "0 9 * * *",    label: "Daily at 9 AM UTC" },
  { value: "0 9 * * 1",    label: "Weekly (Mon 9 AM)" },
  { value: "0 0 1 * *",    label: "Monthly" },
];

export default function MonitorCreateModal({
  open, onClose, datasetId, orgId = "default", onCreated
}: Props) {
  const [name, setName] = useState("");
  const [checkType, setCheckType] = useState("row_count");
  const [columnName, setColumnName] = useState("");
  const [condition, setCondition] = useState("lt");
  const [threshold, setThreshold] = useState("");
  const [schedule, setSchedule] = useState("0 9 * * *");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const needsColumn = checkType === "null_rate" || checkType === "column_drift";

  async function handleSave() {
    if (!name || !threshold) return;
    setError(null);
    setSaving(true);
    try {
      await createMonitor(
        datasetId,
        {
          name,
          check_type: checkType,
          column_name: needsColumn ? columnName || null : null,
          condition,
          threshold: parseFloat(threshold),
          schedule,
        },
        orgId
      );
      onCreated?.();
      handleClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to create monitor");
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setName(""); setCheckType("row_count"); setColumnName("");
    setCondition("lt"); setThreshold(""); setSchedule("0 9 * * *");
    setError(null);
    onClose();
  }

  const inputCls =
    "w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 " +
    "focus:outline-none focus:ring-2 focus:ring-violet-300 text-neutral-800 placeholder-neutral-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-violet-500" />
            <h2 className="text-base font-bold text-neutral-900">Create Monitor</h2>
          </div>
          <button onClick={handleClose} className="text-neutral-400 hover:text-neutral-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-600">Monitor name</label>
          <input className={inputCls} placeholder="Row count drop alert"
            value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-600">Check type</label>
          <select className={inputCls} value={checkType} onChange={(e) => setCheckType(e.target.value)}>
            {CHECK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {needsColumn && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-600">Column name</label>
            <input className={inputCls} placeholder="e.g. revenue"
              value={columnName} onChange={(e) => setColumnName(e.target.value)} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-600">Alert when value</label>
            <select className={inputCls} value={condition} onChange={(e) => setCondition(e.target.value)}>
              {CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-600">Threshold</label>
            <input className={inputCls} type="number" placeholder="e.g. 1000"
              value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-600">Run schedule</label>
          <select className={inputCls} value={schedule} onChange={(e) => setSchedule(e.target.value)}>
            {SCHEDULES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          onClick={handleSave}
          disabled={!name || !threshold || saving}
          className="w-full py-2.5 rounded-xl bg-neutral-900 text-white text-sm font-medium
                     hover:bg-neutral-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saving ? "Creating…" : "Create Monitor"}
        </button>
      </div>
    </div>
  );
}
