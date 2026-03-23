"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Download,
  Lock,
  RefreshCw,
  Shield,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import {
  AuditLogEntry,
  OrgMemberEntry,
  listAuditLogs,
  listOrgMembers,
  removeMember,
  updateMemberRole,
} from "@/lib/api";

// ─── helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function actionColor(action: string): string {
  if (["delete", "archive"].includes(action)) return "#ef4444";
  if (["upload", "analyze"].includes(action)) return "#22c55e";
  if (["invite", "login"].includes(action)) return "#3b82f6";
  if (["query", "export"].includes(action)) return "#f97316";
  return "#9a9690";
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const colors = ["#9060f8", "#e840c8", "#00d4e8", "#f97316", "#22c55e", "#3b82f6"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  const bg = colors[Math.abs(h) % colors.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: bg, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 700, color: "#fff",
    }}>
      {(name[0] || "?").toUpperCase()}
    </div>
  );
}

const ROLE_COLORS: Record<string, string> = {
  admin: "#9060f8",
  editor: "#f97316",
  viewer: "#22c55e",
};

// ─── Team Tab ─────────────────────────────────────────────────────────────────

function TeamTab({ orgId }: { orgId: string }) {
  const [members, setMembers] = useState<OrgMemberEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setMembers(await listOrgMembers(orgId)); } finally { setLoading(false); }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const changeRole = async (userId: string, role: string) => {
    setSaving(userId);
    try {
      const updated = await updateMemberRole(orgId, userId, role);
      setMembers((prev) => prev.map((m) => m.user_id === userId ? { ...m, role: updated.role } : m));
    } finally { setSaving(null); }
  };

  const remove = async (userId: string) => {
    if (confirmRemove !== userId) { setConfirmRemove(userId); return; }
    await removeMember(orgId, userId);
    setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    setConfirmRemove(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ fontSize: 13, color: "#9a9690", margin: 0 }}>
          {members.length} member{members.length !== 1 ? "s" : ""} · Manage roles and access
        </p>
        <button
          onClick={load}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#9a9690", padding: 4 }}
        >
          <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
        </button>
      </div>

      {loading && members.length === 0 ? (
        <p style={{ fontSize: 13, color: "#c8c4be", textAlign: "center", padding: 32 }}>Loading members…</p>
      ) : members.length === 0 ? (
        <p style={{ fontSize: 13, color: "#c8c4be", textAlign: "center", padding: 32 }}>No members found.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {members.map((m) => (
            <div key={m.member_id} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 16px",
              background: "rgba(255,255,255,0.72)",
              border: "1px solid rgba(0,0,0,0.06)",
              borderRadius: 12,
            }}>
              <Avatar name={m.name || m.email || "?"} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: "#111010", margin: 0 }}>
                  {m.name || "Unknown"}
                </p>
                <p style={{ fontSize: 12, color: "#9a9690", margin: 0 }}>{m.email}</p>
              </div>
              <span style={{ fontSize: 11.5, color: "#9a9690" }}>{timeAgo(m.joined_at)}</span>

              {/* Role selector */}
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <select
                  value={m.role}
                  onChange={(e) => changeRole(m.user_id, e.target.value)}
                  disabled={saving === m.user_id}
                  style={{
                    padding: "4px 24px 4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${ROLE_COLORS[m.role]}40`,
                    background: `${ROLE_COLORS[m.role]}10`,
                    color: ROLE_COLORS[m.role],
                    appearance: "none", cursor: "pointer", outline: "none",
                  }}
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
                <ChevronDown size={11} style={{ position: "absolute", right: 6, color: ROLE_COLORS[m.role], pointerEvents: "none" }} />
              </div>

              <button
                onClick={() => remove(m.user_id)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: confirmRemove === m.user_id ? "#ef4444" : "#c8c4be",
                  padding: 4, borderRadius: 6, fontSize: 11,
                  display: "flex", alignItems: "center", gap: 3,
                }}
              >
                <Trash2 size={13} />
                {confirmRemove === m.user_id && "Confirm?"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Invite placeholder */}
      <div style={{
        padding: "14px 16px",
        border: "1px dashed rgba(144,96,248,0.3)",
        borderRadius: 12,
        display: "flex", gap: 8,
      }}>
        <input
          placeholder="Invite by email (Clerk handles invitations)"
          style={{
            flex: 1, padding: "7px 10px", borderRadius: 8, fontSize: 12.5,
            border: "1px solid rgba(0,0,0,0.1)",
            background: "rgba(255,255,255,0.9)", outline: "none", color: "#6b6860",
          }}
          disabled
        />
        <button style={{
          padding: "7px 16px", borderRadius: 8, fontSize: 12.5, fontWeight: 600,
          background: "rgba(0,0,0,0.05)", color: "#9a9690", border: "none", cursor: "default",
        }}>
          Invite via Clerk →
        </button>
      </div>
    </div>
  );
}

// ─── Audit Log Tab ────────────────────────────────────────────────────────────

const ACTION_OPTIONS = ["", "upload", "analyze", "query", "export", "delete", "invite", "login"];
const RESOURCE_OPTIONS = ["", "dataset", "analysis", "monitor", "pipeline", "connector"];

function AuditTab({ orgId }: { orgId: string }) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAuditLogs(orgId, {
        action: actionFilter || undefined,
        resource_type: resourceFilter || undefined,
        limit, offset,
      });
      setLogs(res.logs);
    } finally { setLoading(false); }
  }, [orgId, actionFilter, resourceFilter, offset]);

  useEffect(() => { load(); }, [load]);

  const exportCSV = () => {
    const header = "time,action,resource_type,resource_id,user_id,ip\n";
    const rows = logs.map((l) =>
      [l.created_at, l.action, l.resource_type || "", l.resource_id || "", l.user_id || "", l.ip_address || ""].join(",")
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "sushi-audit.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setOffset(0); }}
          style={{ padding: "6px 10px", borderRadius: 8, fontSize: 12.5, border: "1px solid rgba(0,0,0,0.1)", background: "rgba(255,255,255,0.9)", outline: "none" }}
        >
          {ACTION_OPTIONS.map((a) => <option key={a} value={a}>{a || "All actions"}</option>)}
        </select>
        <select
          value={resourceFilter}
          onChange={(e) => { setResourceFilter(e.target.value); setOffset(0); }}
          style={{ padding: "6px 10px", borderRadius: 8, fontSize: 12.5, border: "1px solid rgba(0,0,0,0.1)", background: "rgba(255,255,255,0.9)", outline: "none" }}
        >
          {RESOURCE_OPTIONS.map((r) => <option key={r} value={r}>{r || "All resources"}</option>)}
        </select>
        <button onClick={load} style={{ background: "none", border: "none", cursor: "pointer", color: "#9a9690", padding: 4 }}>
          <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
        </button>
        <button
          onClick={exportCSV}
          style={{
            marginLeft: "auto", padding: "6px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600,
            background: "rgba(0,0,0,0.06)", color: "#6b6860", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5,
          }}
        >
          <Download size={13} /> Export CSV
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid rgba(0,0,0,0.07)" }}>
              {["Time", "Action", "Resource", "Resource ID", "User", "IP"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: "#9a9690", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && logs.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: 32, color: "#c8c4be" }}>Loading…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: 32, color: "#c8c4be" }}>No audit events found.</td></tr>
            ) : logs.map((l) => (
              <tr key={l.log_id} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
                <td style={{ padding: "9px 10px", color: "#9a9690", whiteSpace: "nowrap" }}>{timeAgo(l.created_at)}</td>
                <td style={{ padding: "9px 10px" }}>
                  <span style={{
                    padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600,
                    background: `${actionColor(l.action)}15`, color: actionColor(l.action),
                  }}>{l.action}</span>
                </td>
                <td style={{ padding: "9px 10px", color: "#6b6860" }}>{l.resource_type || "—"}</td>
                <td style={{ padding: "9px 10px", color: "#9a9690", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11 }}>
                  {l.resource_id ? l.resource_id.slice(0, 8) + "…" : "—"}
                </td>
                <td style={{ padding: "9px 10px", color: "#9a9690", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11 }}>
                  {l.user_id ? l.user_id.slice(0, 8) + "…" : "system"}
                </td>
                <td style={{ padding: "9px 10px", color: "#9a9690", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11 }}>
                  {l.ip_address || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={() => setOffset((o) => Math.max(0, o - limit))}
          disabled={offset === 0}
          style={{ padding: "5px 14px", borderRadius: 8, fontSize: 12.5, border: "1px solid rgba(0,0,0,0.1)", background: "rgba(255,255,255,0.9)", cursor: offset === 0 ? "default" : "pointer", color: offset === 0 ? "#c8c4be" : "#6b6860" }}
        >Prev</button>
        <button
          onClick={() => setOffset((o) => o + limit)}
          disabled={logs.length < limit}
          style={{ padding: "5px 14px", borderRadius: 8, fontSize: 12.5, border: "1px solid rgba(0,0,0,0.1)", background: "rgba(255,255,255,0.9)", cursor: logs.length < limit ? "default" : "pointer", color: logs.length < limit ? "#c8c4be" : "#6b6860" }}
        >Next</button>
      </div>
    </div>
  );
}

// ─── Security Tab ─────────────────────────────────────────────────────────────

function SecurityTab() {
  const sections = [
    {
      icon: Lock,
      color: "#9060f8",
      title: "SSO / SAML (via Clerk)",
      items: [
        "Go to clerk.com → your application → SSO Connections",
        'Enable "Enterprise SSO" and choose SAML 2.0 or OIDC',
        "Paste your IdP metadata URL (Okta, Azure AD, Google Workspace, etc.)",
        "Clerk handles the SP metadata, ACS URL, and token exchange automatically",
        "Users from your IdP domain are auto-provisioned to your Sushi org",
      ],
    },
    {
      icon: Shield,
      color: "#00d4e8",
      title: "RBAC — Role-Based Access Control",
      items: [
        "viewer — read-only access to datasets, reports, and SQL queries",
        "editor — can upload datasets, run transforms, create monitors and pipelines",
        "admin — full access including member management, billing, and audit log",
        "All API endpoints enforce role checks via Clerk JWT org claims",
        "Dev bypass: org_id='default' skips auth for local development",
      ],
    },
    {
      icon: UserCog,
      color: "#f97316",
      title: "Data Retention & Privacy",
      items: [
        "Datasets stored in Cloudflare R2 — set a TTL via R2 Lifecycle Rules",
        "Analyses and audit logs retained for 90 days on the free tier",
        "Pro / Enterprise: configurable retention from 30 days to unlimited",
        "GDPR: request data export or deletion via Settings → Privacy",
        "All data encrypted at rest (AES-256) and in transit (TLS 1.3)",
      ],
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {sections.map((s) => {
        const Icon = s.icon;
        return (
          <div key={s.title} style={{
            background: "rgba(255,255,255,0.72)",
            border: "1px solid rgba(0,0,0,0.06)",
            borderRadius: 14, padding: "16px 18px",
          }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                background: `${s.color}15`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon size={17} style={{ color: s.color }} />
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111010", margin: 0 }}>{s.title}</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {s.items.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                    background: `${s.color}15`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700, color: s.color, marginTop: 1,
                  }}>{i + 1}</div>
                  <p style={{ fontSize: 13, color: "#3a3835", margin: 0, lineHeight: 1.5 }}>{item}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = "team" | "audit" | "security";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "team",     label: "Team",      icon: Users },
  { id: "audit",    label: "Audit Log", icon: CheckCircle2 },
  { id: "security", label: "Security",  icon: Shield },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("team");
  const orgId = "default"; // swap with Clerk org ID in production

  return (
    <div style={{ minHeight: "100vh", background: "#f0eee9" }}>
      <style>{`@keyframes shimmer{0%{background-position:0% 0}100%{background-position:200% 0}} @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{
        background: "rgba(240,238,233,0.92)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0,0,0,0.07)",
        padding: "14px 32px",
        display: "flex", alignItems: "center", gap: 16,
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{
          height: 3, position: "absolute", top: 0, left: 0, right: 0,
          background: "linear-gradient(90deg,#9060f8,#e840c8,#00d4e8,#9060f8)",
          backgroundSize: "200% 100%", animation: "shimmer 4s linear infinite",
        }} />
        <Link href="/" style={{ color: "#9a9690", display: "flex", alignItems: "center", gap: 6, textDecoration: "none", fontSize: 13 }}>
          <ArrowLeft size={15} /> Dashboard
        </Link>
        <span style={{ color: "rgba(0,0,0,0.15)" }}>|</span>
        <span style={{ fontWeight: 700, fontSize: 16, color: "#111010" }}>Settings</span>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{
          marginBottom: 18,
          padding: "12px 14px",
          borderRadius: 12,
          background: "rgba(245,158,11,0.08)",
          border: "1px solid rgba(245,158,11,0.18)",
        }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: "#111010", margin: 0 }}>
            Team administration is in launch preview
          </p>
          <p style={{ fontSize: 12.5, color: "#6b6860", margin: "4px 0 0", lineHeight: 1.5 }}>
            Use this page as an investor-proof surface for role management and audit visibility. For the MVP launch, keep it behind authenticated admin access and do not overpromise enterprise controls beyond what you have tested.
          </p>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", gap: 4, marginBottom: 24,
          background: "rgba(255,255,255,0.72)",
          border: "1px solid rgba(0,0,0,0.07)",
          borderRadius: 14, padding: 4,
          width: "fit-content",
        }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                padding: "8px 18px", borderRadius: 10, fontSize: 13.5, fontWeight: 600,
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 7,
                background: tab === id ? "linear-gradient(135deg,#9060f8,#e840c8)" : "transparent",
                color: tab === id ? "#fff" : "#6b6860",
                transition: "all 0.15s",
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{
          background: "rgba(255,255,255,0.72)",
          border: "1px solid rgba(0,0,0,0.07)",
          borderRadius: 18, padding: 24,
          boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
        }}>
          {tab === "team"     && <TeamTab orgId={orgId} />}
          {tab === "audit"    && <AuditTab orgId={orgId} />}
          {tab === "security" && <SecurityTab />}
        </div>
      </div>
    </div>
  );
}
