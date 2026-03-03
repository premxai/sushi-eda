"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpDown,
  CalendarClock,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Workflow,
} from "lucide-react";
import {
  DatasetSummary,
  PipelineRunSummary,
  PipelineSummary,
  createPipeline,
  deletePipeline,
  listDatasets,
  listPipelineRuns,
  listPipelineVersions,
  listPipelines,
  runPipelineNow,
  updatePipeline,
} from "@/lib/api";

type StepOperation =
  | "select_columns"
  | "filter_rows"
  | "rename_columns"
  | "sort_rows"
  | "limit_rows"
  | "fill_missing"
  | "drop_missing"
  | "derive_column";

interface PipelineStep {
  id: string;
  operation: StepOperation;
  params: Record<string, unknown>;
}

const SCHEDULE_OPTIONS = [
  { label: "Hourly", value: "0 * * * *" },
  { label: "Daily (09:00 UTC)", value: "0 9 * * *" },
  { label: "Weekdays (09:00 UTC)", value: "0 9 * * 1-5" },
  { label: "Weekly (Mon 09:00 UTC)", value: "0 9 * * 1" },
];

const STATUS_COLOR: Record<string, string> = {
  success: "text-emerald-700 bg-emerald-50 border-emerald-200",
  running: "text-amber-700 bg-amber-50 border-amber-200",
  pending: "text-zinc-600 bg-zinc-100 border-zinc-300",
  failed: "text-rose-700 bg-rose-50 border-rose-200",
};

function id() {
  return Math.random().toString(36).slice(2, 10);
}

function stepDefaults(op: StepOperation): Record<string, unknown> {
  switch (op) {
    case "select_columns":
      return { columns: [] };
    case "filter_rows":
      return { column: "", operator: "eq", value: "" };
    case "rename_columns":
      return { mapping: {} };
    case "sort_rows":
      return { column: "", ascending: true };
    case "limit_rows":
      return { limit: 1000 };
    case "fill_missing":
      return { column: "", value: "" };
    case "drop_missing":
      return { subset: [] };
    case "derive_column":
      return { target: "", expression: "" };
    default:
      return {};
  }
}

function buildGraph(sourceDatasetId: string, steps: PipelineStep[]) {
  const sourceNode = {
    id: "source-node",
    type: "source",
    data: { dataset_id: sourceDatasetId },
  };
  const transformNodes = steps.map((step, i) => ({
    id: step.id,
    type: "transform",
    data: {
      operation: step.operation,
      params: step.params,
      order: i + 1,
    },
  }));
  const destinationNode = {
    id: "destination-node",
    type: "destination",
    data: { type: "dataset" },
  };
  const nodes = [sourceNode, ...transformNodes, destinationNode];

  const edges = [];
  let prev = sourceNode.id;
  for (const node of transformNodes) {
    edges.push({ id: `${prev}-${node.id}`, source: prev, target: node.id });
    prev = node.id;
  }
  edges.push({ id: `${prev}-${destinationNode.id}`, source: prev, target: destinationNode.id });

  return { nodes, edges };
}

function parseStepsFromGraph(graph: Record<string, unknown> | null | undefined): PipelineStep[] {
  if (!graph || typeof graph !== "object") return [];
  const nodes = Array.isArray((graph as { nodes?: unknown }).nodes) ? (graph as { nodes: unknown[] }).nodes : [];
  return nodes
    .filter((n): n is { id: string; type?: string; data?: Record<string, unknown> } => typeof n === "object" && n !== null && "id" in n)
    .filter((n) => n.type === "transform")
    .sort((a, b) => Number((a.data?.order ?? 0)) - Number((b.data?.order ?? 0)))
    .map((n) => {
      const op = String(n.data?.operation ?? "limit_rows") as StepOperation;
      return {
        id: n.id,
        operation: op,
        params: (n.data?.params as Record<string, unknown>) ?? stepDefaults(op),
      };
    });
}

export default function PipelinesPage() {
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [pipelines, setPipelines] = useState<PipelineSummary[]>([]);
  const [runs, setRuns] = useState<Record<string, PipelineRunSummary[]>>({});
  const [versions, setVersions] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningPipelineId, setRunningPipelineId] = useState<string | null>(null);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draggingStepId, setDraggingStepId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sourceDatasetId, setSourceDatasetId] = useState("");
  const [schedule, setSchedule] = useState(SCHEDULE_OPTIONS[0].value);
  const [isActive, setIsActive] = useState(true);
  const [steps, setSteps] = useState<PipelineStep[]>([
    { id: id(), operation: "limit_rows", params: stepDefaults("limit_rows") },
  ]);

  const editable = useMemo(
    () => pipelines.find((p) => p.pipeline_id === selectedPipelineId) ?? null,
    [pipelines, selectedPipelineId]
  );

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [datasetsData, pipelineData] = await Promise.all([
        listDatasets("default", { archived: false }),
        listPipelines("default"),
      ]);
      setDatasets(datasetsData.filter((d) => d.status === "ready"));
      setPipelines(pipelineData);
    } catch {
      setError("Failed to load pipelines.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function loadPipelineMeta(pipelineId: string) {
    const [runData, versionData] = await Promise.all([
      listPipelineRuns(pipelineId, "default", 20),
      listPipelineVersions(pipelineId, "default", 100),
    ]);
    setRuns((prev) => ({ ...prev, [pipelineId]: runData }));
    setVersions((prev) => ({ ...prev, [pipelineId]: versionData.length }));
  }

  function resetForm() {
    setSelectedPipelineId(null);
    setName("");
    setDescription("");
    setSourceDatasetId("");
    setSchedule(SCHEDULE_OPTIONS[0].value);
    setIsActive(true);
    setSteps([{ id: id(), operation: "limit_rows", params: stepDefaults("limit_rows") }]);
  }

  function loadIntoForm(pipeline: PipelineSummary) {
    setSelectedPipelineId(pipeline.pipeline_id);
    setName(pipeline.name);
    setDescription(pipeline.description ?? "");
    setSourceDatasetId(pipeline.source_dataset_id ?? "");
    setSchedule(pipeline.schedule);
    setIsActive(pipeline.is_active);
    setSteps(parseStepsFromGraph(pipeline.graph));
    loadPipelineMeta(pipeline.pipeline_id).catch(() => null);
  }

  function addStep(op: StepOperation) {
    setSteps((prev) => [...prev, { id: id(), operation: op, params: stepDefaults(op) }]);
  }

  function updateStep(stepId: string, patch: Partial<PipelineStep>) {
    setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, ...patch } : s)));
  }

  function removeStep(stepId: string) {
    setSteps((prev) => prev.filter((s) => s.id !== stepId));
  }

  function reorderSteps(fromId: string, toId: string) {
    if (fromId === toId) return;
    setSteps((prev) => {
      const next = [...prev];
      const fromIdx = next.findIndex((s) => s.id === fromId);
      const toIdx = next.findIndex((s) => s.id === toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }

  async function savePipeline() {
    if (!name.trim()) {
      setError("Pipeline name is required.");
      return;
    }
    if (!sourceDatasetId) {
      setError("Select a source dataset.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      source_dataset_id: sourceDatasetId,
      schedule,
      is_active: isActive,
      graph: buildGraph(sourceDatasetId, steps),
      destination_type: "dataset",
      destination_config: { format: "csv", auto_analyze: true },
    };
    try {
      if (editable) {
        const updated = await updatePipeline(editable.pipeline_id, payload, "default");
        setPipelines((prev) => prev.map((p) => (p.pipeline_id === updated.pipeline_id ? updated : p)));
        await loadPipelineMeta(updated.pipeline_id);
      } else {
        const created = await createPipeline(payload, "default");
        setPipelines((prev) => [created, ...prev]);
        setSelectedPipelineId(created.pipeline_id);
        await loadPipelineMeta(created.pipeline_id);
      }
    } catch {
      setError("Failed to save pipeline.");
    } finally {
      setSaving(false);
    }
  }

  async function runNow(pipelineId: string) {
    setRunningPipelineId(pipelineId);
    try {
      await runPipelineNow(pipelineId, "default");
      await loadPipelineMeta(pipelineId);
      await loadAll();
    } catch {
      setError("Failed to trigger pipeline run.");
    } finally {
      setRunningPipelineId(null);
    }
  }

  async function removePipeline(pipelineId: string) {
    if (!confirm("Delete this pipeline recipe?")) return;
    try {
      await deletePipeline(pipelineId, "default");
      setPipelines((prev) => prev.filter((p) => p.pipeline_id !== pipelineId));
      if (selectedPipelineId === pipelineId) resetForm();
    } catch {
      setError("Failed to delete pipeline.");
    }
  }

  const inputCls = "rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-800 focus:border-zinc-500 focus:outline-none";

  return (
    <div className="min-h-screen bg-[#f0eee9]">
      <nav className="sticky top-0 z-20 border-b border-black/10 bg-[#f0eee9]/90 px-8 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="text-lg font-semibold text-zinc-900">Sushi</Link>
          <div className="flex items-center gap-4 text-sm text-zinc-600">
            <Link href="/datasets">Datasets</Link>
            <Link href="/connectors">Connectors</Link>
            <span className="rounded-full bg-violet-100 px-3 py-1 text-violet-700">Pipelines</span>
          </div>
        </div>
      </nav>

      <div className="mx-auto grid max-w-7xl gap-5 px-6 py-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-4 rounded-2xl border border-white/80 bg-white/70 p-5 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900">Visual Pipeline Builder</h1>
              <p className="text-sm text-zinc-600">Source → Transform nodes → Destination, with scheduling and run logs.</p>
            </div>
            <button
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700"
              onClick={resetForm}
            >
              <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
              New recipe
            </button>
          </div>

          {error && <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">{error}</div>}

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-zinc-600">
              Recipe name
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Daily revenue prep" />
            </label>
            <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-zinc-600">
              Source dataset
              <select className={inputCls} value={sourceDatasetId} onChange={(e) => setSourceDatasetId(e.target.value)}>
                <option value="">Select dataset</option>
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-zinc-600 md:col-span-2">
              Description
              <input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Prepares marketing cohort features." />
            </label>
            <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-zinc-600">
              Schedule
              <select className={inputCls} value={schedule} onChange={(e) => setSchedule(e.target.value)}>
                {SCHEDULE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Active
            </label>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-800">Node Lane</h2>
              <div className="flex flex-wrap gap-2">
                {(["select_columns", "filter_rows", "rename_columns", "sort_rows", "limit_rows", "fill_missing", "drop_missing", "derive_column"] as StepOperation[]).map((op) => (
                  <button
                    key={op}
                    onClick={() => addStep(op)}
                    className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700"
                  >
                    <Plus className="mr-1 inline h-3 w-3" />
                    {op}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3">
              <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-800">
                Source node: {sourceDatasetId ? datasets.find((d) => d.id === sourceDatasetId)?.name ?? sourceDatasetId : "Not selected"}
              </div>

              {steps.map((step, i) => (
                <div
                  key={step.id}
                  draggable
                  onDragStart={() => setDraggingStepId(step.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggingStepId) reorderSteps(draggingStepId, step.id);
                    setDraggingStepId(null);
                  }}
                  className="rounded-lg border border-zinc-200 bg-white p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-medium text-zinc-800">
                      <ArrowUpDown className="mr-1 inline h-3.5 w-3.5 text-zinc-500" />
                      Transform {i + 1}
                    </div>
                    <button onClick={() => removeStep(step.id)} className="text-zinc-400 hover:text-rose-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-zinc-500">
                      Operation
                      <select
                        className={inputCls}
                        value={step.operation}
                        onChange={(e) => {
                          const op = e.target.value as StepOperation;
                          updateStep(step.id, { operation: op, params: stepDefaults(op) });
                        }}
                      >
                        <option value="select_columns">select_columns</option>
                        <option value="filter_rows">filter_rows</option>
                        <option value="rename_columns">rename_columns</option>
                        <option value="sort_rows">sort_rows</option>
                        <option value="limit_rows">limit_rows</option>
                        <option value="fill_missing">fill_missing</option>
                        <option value="drop_missing">drop_missing</option>
                        <option value="derive_column">derive_column</option>
                      </select>
                    </label>

                    <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-zinc-500 md:col-span-1">
                      Params (JSON)
                      <textarea
                        className={`${inputCls} min-h-[72px] font-mono text-xs`}
                        value={JSON.stringify(step.params)}
                        onChange={(e) => {
                          try {
                            const parsed = JSON.parse(e.target.value);
                            updateStep(step.id, { params: parsed });
                          } catch {
                            // Keep invalid JSON in UI until valid
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              ))}

              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                Destination node: dataset output (CSV) + auto analysis
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={savePipeline}
              disabled={saving}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="mr-1 inline h-4 w-4 animate-spin" /> : <Save className="mr-1 inline h-4 w-4" />}
              {editable ? "Update recipe" : "Save recipe"}
            </button>
            {editable && (
              <button
                onClick={() => runNow(editable.pipeline_id)}
                disabled={runningPipelineId === editable.pipeline_id}
                className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700"
              >
                {runningPipelineId === editable.pipeline_id ? (
                  <Loader2 className="mr-1 inline h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-1 inline h-4 w-4" />
                )}
                Run now
              </button>
            )}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-white/80 bg-white/70 p-5 shadow-sm backdrop-blur">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">
              <Workflow className="mr-1 inline h-4 w-4" />
              Pipelines
            </h2>
            <button onClick={loadAll} className="text-zinc-500 hover:text-zinc-800">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {loading ? (
            <div className="py-10 text-center text-zinc-500"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
          ) : pipelines.length === 0 ? (
            <p className="text-sm text-zinc-500">No pipelines yet.</p>
          ) : (
            <div className="space-y-2">
              {pipelines.map((p) => (
                <div key={p.pipeline_id} className="rounded-lg border border-zinc-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{p.name}</p>
                      <p className="mt-0.5 text-xs text-zinc-500">v{p.version} • cron {p.schedule}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_COLOR[p.last_run_status ?? "pending"] ?? STATUS_COLOR.pending}`}>
                      {p.last_run_status ?? "never ran"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button onClick={() => loadIntoForm(p)} className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700">Edit</button>
                    <button
                      onClick={() => runNow(p.pipeline_id)}
                      className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700"
                    >
                      <Play className="mr-1 inline h-3 w-3" />
                      Run
                    </button>
                    <button
                      onClick={() => removePipeline(p.pipeline_id)}
                      className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700"
                    >
                      <Trash2 className="mr-1 inline h-3 w-3" />
                      Delete
                    </button>
                    <button
                      onClick={() => loadPipelineMeta(p.pipeline_id)}
                      className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700"
                    >
                      <ArrowDownToLine className="mr-1 inline h-3 w-3" />
                      Runs/versions
                    </button>
                  </div>

                  {(runs[p.pipeline_id] || versions[p.pipeline_id]) && (
                    <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-2">
                      <p className="mb-1 text-xs text-zinc-600">
                        <CalendarClock className="mr-1 inline h-3 w-3" />
                        Versions: {versions[p.pipeline_id] ?? 0}
                      </p>
                      <div className="space-y-1">
                        {(runs[p.pipeline_id] ?? []).slice(0, 5).map((r) => (
                          <div key={r.run_id} className="flex items-center justify-between rounded border border-zinc-200 bg-white px-2 py-1">
                            <span className="text-xs text-zinc-600">
                              v{r.recipe_version} • {r.trigger_type}
                            </span>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] ${STATUS_COLOR[r.status] ?? STATUS_COLOR.pending}`}>
                              {r.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

