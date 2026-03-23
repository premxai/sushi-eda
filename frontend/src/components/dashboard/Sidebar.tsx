"use client";

import React from "react";
import {
  BarChart3,
  Columns3,
  GitCompareArrows,
  AlertTriangle,
  Table2,
  Lightbulb,
  FileSpreadsheet,
  Plus,
  ChartNoAxesCombined,
  Sparkles,
  FlaskConical,
  Sigma,
  Archive,
  Database,
  TerminalSquare,
  FileText,
  BookOpen,
  Home,
} from "lucide-react";
import Link from "next/link";
import CreditsUsageBar from "@/components/CreditsUsageBar";

export type NavSection =
  | "overview"
  | "columns"
  | "statistics"
  | "correlations"
  | "outliers"
  | "insights"
  | "visualizations"
  | "report"
  | "cleaning"
  | "transforms"
  | "sql"
  | "monitors"
  | "comments"
  | "data";

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.ElementType;
  group: string;
}

const navItems: NavItem[] = [
  { id: "overview",       label: "Overview",       icon: BarChart3,           group: "Analysis" },
  { id: "columns",        label: "Columns",        icon: Columns3,            group: "Analysis" },
  { id: "statistics",     label: "Statistics",     icon: Sigma,               group: "Analysis" },
  { id: "correlations",   label: "Correlations",   icon: GitCompareArrows,    group: "Analysis" },
  { id: "outliers",       label: "Outliers",       icon: AlertTriangle,       group: "Analysis" },
  { id: "insights",       label: "Insights",       icon: Lightbulb,           group: "Analysis" },
  { id: "visualizations", label: "Visualizations", icon: ChartNoAxesCombined, group: "Analysis" },
  { id: "report",         label: "Report",         icon: FileText,            group: "Analysis" },
  { id: "cleaning",       label: "Data Cleaning",  icon: Sparkles,            group: "Engineering" },
  { id: "transforms",     label: "Transforms",     icon: FlaskConical,        group: "Engineering" },
  { id: "sql",            label: "SQL Editor",     icon: TerminalSquare,      group: "Engineering" },
  { id: "data",           label: "Data Table",     icon: Table2,              group: "Data" },
];

const GROUPS = ["Analysis", "Engineering", "Data"];

const launchFooterLinks = [
  { href: "/datasets", label: "My Datasets", icon: Database },
  { href: "/docs", label: "Docs", icon: BookOpen },
] as const;

interface SidebarProps {
  fileName: string;
  activeSection: NavSection;
  onSectionChange: (section: NavSection) => void;
  onNewFile: () => void;
  onNewFileRequest?: () => void;
  onDatasetPick?: (id: string, filename: string) => void;
  datasetId?: string | null;
  orgId?: string;
  onArchive?: () => void;
}

export function Sidebar({
  fileName,
  activeSection,
  onSectionChange,
  onNewFile,
  onNewFileRequest,
  datasetId,
  orgId = "default",
  onArchive,
}: SidebarProps) {
  return (
    <aside style={{
      width: 230,
      height: "100vh",
      flexShrink: 0,
      background: "rgba(255,255,255,0.65)",
      borderRight: "1px solid rgba(0,0,0,0.07)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      display: "flex",
      flexDirection: "column",
      overflowY: "auto",
      overflowX: "hidden",
    }}>

      {/* ── Logo (click = go home) ── */}
      <button
        onClick={onNewFile}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "20px 20px",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          background: "transparent", border: "none", cursor: "pointer",
          width: "100%", textAlign: "left",
        }}
      >
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: "linear-gradient(135deg, #1a1a1a, #333)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, flexShrink: 0,
        }}>🍣</div>
        <span style={{ fontWeight: 600, fontSize: 16, color: "#111010", letterSpacing: "-0.2px" }}>Sushi</span>
      </button>

      {/* ── Active file chip + actions ── */}
      <div style={{ padding: "10px 12px 8px" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 10px", borderRadius: 8,
          background: "rgba(144,96,248,0.07)",
          border: "1px solid rgba(144,96,248,0.14)",
          marginBottom: 8,
        }}>
          <FileSpreadsheet style={{ width: 13, height: 13, color: "#9060f8", flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: "#111010", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {fileName}
          </span>
        </div>

        {/* Home + Analyze New File buttons */}
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={onNewFile}
            title="Back to Home"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              flex: 1, padding: "7px 10px", borderRadius: 7,
              fontSize: 12.5, fontWeight: 500,
              background: "rgba(0,0,0,0.05)",
              border: "1px solid rgba(0,0,0,0.08)",
              color: "#6b6860", cursor: "pointer",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.09)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.05)")}
          >
            <Home style={{ width: 13, height: 13 }} />
            Home
          </button>
          <button
            onClick={() => onNewFileRequest ? onNewFileRequest() : onNewFile()}
            title="Analyze a new file"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              flex: 1, padding: "7px 10px", borderRadius: 7,
              fontSize: 12.5, fontWeight: 500,
              background: "linear-gradient(135deg, #9060f8, #e840c8)",
              border: "none",
              color: "#fff", cursor: "pointer",
              boxShadow: "0 2px 8px rgba(144,96,248,0.3)",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            <Plus style={{ width: 13, height: 13 }} />
            New File
          </button>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, padding: "6px 12px" }}>
        {GROUPS.map((group) => {
          const items = navItems.filter((i) => i.group === group);
          return (
            <div key={group} style={{ marginBottom: 18 }}>
              <p style={{
                fontSize: 9,
                fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: "#9a9690",
                padding: "0 8px",
                marginBottom: 3,
              }}>
                {group}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {items.map((item) => {
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSectionChange(item.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "9px 10px", borderRadius: 8,
                        fontSize: 13.5, fontWeight: isActive ? 500 : 400,
                        color: isActive ? "#9060f8" : "#6b6860",
                        background: isActive ? "rgba(144,96,248,0.1)" : "transparent",
                        border: "none", cursor: "pointer",
                        width: "100%", textAlign: "left",
                        transition: "background 0.15s, color 0.15s",
                      }}
                    >
                      <item.icon style={{
                        width: 16, height: 16, flexShrink: 0,
                        opacity: isActive ? 1 : 0.5,
                      }} />
                      {item.label}
                      {isActive && (
                        <div style={{
                          marginLeft: "auto", width: 5, height: 5, borderRadius: "50%",
                          background: "#9060f8", flexShrink: 0,
                          boxShadow: "0 0 6px rgba(144,96,248,0.7)",
                        }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── Footer actions ── */}
      <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", padding: 12 }}>
        <CreditsUsageBar orgId={orgId} className="mb-2" />

        {launchFooterLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 10px", borderRadius: 8, marginBottom: 1,
              fontSize: 13.5, color: "#6b6860", textDecoration: "none",
              fontWeight: 400,
            }}
          >
            <item.icon style={{ width: 16, height: 16, flexShrink: 0, opacity: 0.5 }} />
            {item.label}
          </Link>
        ))}

        {datasetId && onArchive && (
          <button
            onClick={onArchive}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 10px", borderRadius: 8, marginBottom: 1,
              fontSize: 13.5, color: "#6b6860",
              background: "transparent", border: "none", cursor: "pointer",
              width: "100%", textAlign: "left", fontWeight: 400,
            }}
          >
            <Archive style={{ width: 16, height: 16, flexShrink: 0, opacity: 0.5 }} />
            Archive dataset
          </button>
        )}

      </div>
    </aside>
  );
}
