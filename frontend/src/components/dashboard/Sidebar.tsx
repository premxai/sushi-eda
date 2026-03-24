"use client";

import React from "react";
import {
  Archive,
  BarChart3,
  BookOpen,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronRight,
  Columns3,
  Database,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  GitCompareArrows,
  Home,
  Lightbulb,
  Plus,
  Sigma,
  Sparkles,
  Table2,
  TerminalSquare,
  AlertTriangle,
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
  group: "Guided" | "Advanced";
}

const navItems: NavItem[] = [
  { id: "overview", label: "Data Summary", icon: BarChart3, group: "Guided" },
  { id: "columns", label: "Field Health", icon: Columns3, group: "Guided" },
  { id: "statistics", label: "Compare & Validate", icon: Sigma, group: "Guided" },
  { id: "correlations", label: "What Moves Together", icon: GitCompareArrows, group: "Guided" },
  { id: "outliers", label: "Unusual Values", icon: AlertTriangle, group: "Guided" },
  { id: "report", label: "Reports", icon: FileText, group: "Guided" },
  { id: "visualizations", label: "Charts & Trends", icon: ChartNoAxesCombined, group: "Advanced" },
  { id: "insights", label: "AI Notes", icon: Lightbulb, group: "Advanced" },
  { id: "cleaning", label: "Clean & Improve", icon: Sparkles, group: "Advanced" },
  { id: "transforms", label: "Derived Fields", icon: FlaskConical, group: "Advanced" },
  { id: "sql", label: "Advanced Queries", icon: TerminalSquare, group: "Advanced" },
  { id: "data", label: "Raw Table", icon: Table2, group: "Advanced" },
];

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
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const guidedItems = navItems.filter((item) => item.group === "Guided");
  const advancedItems = navItems.filter((item) => item.group === "Advanced");

  const renderNavButton = (item: NavItem) => {
    const isActive = activeSection === item.id;

    return (
      <button
        key={item.id}
        onClick={() => onSectionChange(item.id)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "9px 10px",
          borderRadius: 8,
          fontSize: 13.5,
          fontWeight: isActive ? 500 : 400,
          color: isActive ? "#9060f8" : "#6b6860",
          background: isActive ? "rgba(144,96,248,0.1)" : "transparent",
          border: "none",
          cursor: "pointer",
          width: "100%",
          textAlign: "left",
          transition: "background 0.15s, color 0.15s",
        }}
      >
        <item.icon
          style={{
            width: 16,
            height: 16,
            flexShrink: 0,
            opacity: isActive ? 1 : 0.5,
          }}
        />
        {item.label}
        {isActive && (
          <div
            style={{
              marginLeft: "auto",
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "#9060f8",
              flexShrink: 0,
              boxShadow: "0 0 6px rgba(144,96,248,0.7)",
            }}
          />
        )}
      </button>
    );
  };

  return (
    <aside
      style={{
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
      }}
    >
      <button
        onClick={onNewFile}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "20px 20px",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          width: "100%",
          textAlign: "left",
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: "linear-gradient(135deg, #1a1a1a, #333)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          S
        </div>
        <span style={{ fontWeight: 600, fontSize: 16, color: "#111010", letterSpacing: "-0.2px" }}>
          Sushi
        </span>
      </button>

      <div style={{ padding: "10px 12px 8px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            borderRadius: 8,
            background: "rgba(144,96,248,0.07)",
            border: "1px solid rgba(144,96,248,0.14)",
            marginBottom: 8,
          }}
        >
          <FileSpreadsheet style={{ width: 13, height: 13, color: "#9060f8", flexShrink: 0 }} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "#111010",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {fileName}
          </span>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={onNewFile}
            title="Back to Home"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              flex: 1,
              padding: "7px 10px",
              borderRadius: 7,
              fontSize: 12.5,
              fontWeight: 500,
              background: "rgba(0,0,0,0.05)",
              border: "1px solid rgba(0,0,0,0.08)",
              color: "#6b6860",
              cursor: "pointer",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.09)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.05)")}
          >
            <Home style={{ width: 13, height: 13 }} />
            Home
          </button>
          <button
            onClick={() => (onNewFileRequest ? onNewFileRequest() : onNewFile())}
            title="Start a new saved workspace"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              flex: 1,
              padding: "7px 10px",
              borderRadius: 7,
              fontSize: 12.5,
              fontWeight: 500,
              background: "linear-gradient(135deg, #9060f8, #e840c8)",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(144,96,248,0.3)",
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            <Plus style={{ width: 13, height: 13 }} />
            New Upload
          </button>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "6px 12px" }}>
        <div style={{ marginBottom: 18 }}>
          <p
            style={{
              fontSize: 9,
              fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "#9a9690",
              padding: "0 8px",
              marginBottom: 3,
            }}
          >
            Guided
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {guidedItems.map(renderNavButton)}
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <button
            type="button"
            onClick={() => setShowAdvanced((current) => !current)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 8px",
              borderRadius: 8,
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                fontSize: 9,
                fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
                letterSpacing: "2px",
                textTransform: "uppercase",
                color: "#9a9690",
              }}
            >
              Advanced
            </span>
            {showAdvanced ? (
              <ChevronDown style={{ width: 14, height: 14, color: "#9a9690" }} />
            ) : (
              <ChevronRight style={{ width: 14, height: 14, color: "#9a9690" }} />
            )}
          </button>
          {showAdvanced && (
            <div style={{ display: "flex", flexDirection: "column", gap: 1, marginTop: 4 }}>
              {advancedItems.map(renderNavButton)}
            </div>
          )}
        </div>
      </nav>

      <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", padding: 12 }}>
        <CreditsUsageBar orgId={orgId} className="mb-2" />

        {launchFooterLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 10px",
              borderRadius: 8,
              marginBottom: 1,
              fontSize: 13.5,
              color: "#6b6860",
              textDecoration: "none",
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
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 10px",
              borderRadius: 8,
              marginBottom: 1,
              fontSize: 13.5,
              color: "#6b6860",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              width: "100%",
              textAlign: "left",
              fontWeight: 400,
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
