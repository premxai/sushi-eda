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
  Archive,
  Database,
  Unplug,
} from "lucide-react";
import Link from "next/link";

export type NavSection =
  | "overview"
  | "columns"
  | "correlations"
  | "outliers"
  | "insights"
  | "visualizations"
  | "cleaning"
  | "transforms"
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
  { id: "correlations",   label: "Correlations",   icon: GitCompareArrows,    group: "Analysis" },
  { id: "outliers",       label: "Outliers",       icon: AlertTriangle,       group: "Analysis" },
  { id: "insights",       label: "Insights",       icon: Lightbulb,           group: "Analysis" },
  { id: "visualizations", label: "Visualizations", icon: ChartNoAxesCombined, group: "Analysis" },
  { id: "cleaning",       label: "Data Cleaning",  icon: Sparkles,            group: "Engineering" },
  { id: "transforms",     label: "Transforms",     icon: FlaskConical,        group: "Engineering" },
  { id: "data",           label: "Data Table",     icon: Table2,              group: "Data" },
];

const GROUPS = ["Analysis", "Engineering", "Data"];

interface SidebarProps {
  fileName: string;
  activeSection: NavSection;
  onSectionChange: (section: NavSection) => void;
  onNewFile: () => void;
  datasetId?: string | null;
  onArchive?: () => void;
}

export function Sidebar({
  fileName,
  activeSection,
  onSectionChange,
  onNewFile,
  datasetId,
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

      {/* ── Logo ── */}
      <Link href="/" style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "20px 20px",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        textDecoration: "none",
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: "linear-gradient(135deg, #1a1a1a, #333)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, flexShrink: 0,
        }}>🍣</div>
        <span style={{ fontWeight: 600, fontSize: 16, color: "#111010", letterSpacing: "-0.2px" }}>Sushi</span>
      </Link>

      {/* ── Active file chip ── */}
      <div style={{ padding: "10px 12px 4px" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 10px", borderRadius: 8,
          background: "rgba(144,96,248,0.07)",
          border: "1px solid rgba(144,96,248,0.14)",
        }}>
          <FileSpreadsheet style={{ width: 13, height: 13, color: "#9060f8", flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: "#111010", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {fileName}
          </span>
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
        <Link
          href="/datasets"
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "9px 10px", borderRadius: 8, marginBottom: 1,
            fontSize: 13.5, color: "#6b6860", textDecoration: "none",
            fontWeight: 400,
          }}
        >
          <Database style={{ width: 16, height: 16, flexShrink: 0, opacity: 0.5 }} />
          My Datasets
        </Link>

        <Link
          href="/connectors"
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "9px 10px", borderRadius: 8, marginBottom: 1,
            fontSize: 13.5, color: "#6b6860", textDecoration: "none",
            fontWeight: 400,
          }}
        >
          <Unplug style={{ width: 16, height: 16, flexShrink: 0, opacity: 0.5 }} />
          Connections
        </Link>

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

        <button
          onClick={onNewFile}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            width: "100%", padding: "9px 12px", borderRadius: 8, marginTop: 6,
            fontSize: 13.5, fontWeight: 500,
            background: "linear-gradient(135deg, #9060f8, #e840c8)",
            color: "white", border: "none", cursor: "pointer",
            boxShadow: "0 2px 12px rgba(144,96,248,0.3)",
            transition: "opacity 0.15s, transform 0.15s",
          }}
        >
          <Plus style={{ width: 13, height: 13 }} />
          Analyze New File
        </button>
      </div>
    </aside>
  );
}
