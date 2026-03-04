"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Chrome,
  Circle,
  Copy,
  Github,
  Slack,
  Terminal,
  Zap,
} from "lucide-react";

// ─── helpers ──────────────────────────────────────────────────────────────────

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };
  return { copied, copy };
}

// ─── sub-components ───────────────────────────────────────────────────────────

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 99, fontSize: 10.5, fontWeight: 600,
      background: `${color}18`, color,
    }}>{label}</span>
  );
}

function CodeBlock({ code, copyKey, copied, onCopy }: {
  code: string; copyKey: string;
  copied: string | null; onCopy: (text: string, key: string) => void;
}) {
  return (
    <div style={{
      position: "relative",
      background: "#1a1917", borderRadius: 10,
      padding: "12px 40px 12px 16px",
      fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
      fontSize: 12.5, color: "#e8e4de", lineHeight: 1.6,
      whiteSpace: "pre-wrap", wordBreak: "break-all",
    }}>
      {code}
      <button
        onClick={() => onCopy(code, copyKey)}
        style={{
          position: "absolute", top: 8, right: 8,
          background: "rgba(255,255,255,0.08)", border: "none",
          borderRadius: 6, cursor: "pointer", color: "#9a9690",
          padding: "4px 7px", fontSize: 11,
          display: "flex", alignItems: "center", gap: 4,
        }}
      >
        {copied === copyKey ? <CheckCircle2 size={12} style={{ color: "#22c55e" }} /> : <Copy size={12} />}
        {copied === copyKey ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{
        width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
        background: "linear-gradient(135deg,#9060f8,#e840c8)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 700, color: "#fff",
      }}>{n}</div>
      <p style={{ fontSize: 13, color: "#3a3835", lineHeight: 1.5, margin: "1px 0 0" }}>{text}</p>
    </div>
  );
}

interface CardProps {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  badge: string;
  badgeColor: string;
  description: string;
  children: React.ReactNode;
}

function IntegrationCard({ icon: Icon, iconColor, title, badge, badgeColor, description, children }: CardProps) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background: "rgba(255,255,255,0.72)",
      border: "1px solid rgba(0,0,0,0.07)",
      borderRadius: 18,
      overflow: "hidden",
      boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
    }}>
      <style>{`@keyframes shimmer{0%{background-position:0% 0}100%{background-position:200% 0}}`}</style>
      <div style={{
        height: 3,
        background: `linear-gradient(90deg, ${iconColor}, #e840c8, #00d4e8, ${iconColor})`,
        backgroundSize: "200% 100%", animation: "shimmer 4s linear infinite",
      }} />
      <div style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12, flexShrink: 0,
            background: `${iconColor}15`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon size={22} style={{ color: iconColor }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111010", margin: 0 }}>{title}</h3>
              <Badge label={badge} color={badgeColor} />
            </div>
            <p style={{ fontSize: 13, color: "#6b6860", margin: 0, lineHeight: 1.5 }}>{description}</p>
          </div>
          <button
            onClick={() => setOpen((v) => !v)}
            style={{
              padding: "7px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
              background: open ? "rgba(0,0,0,0.05)" : "linear-gradient(135deg,#9060f8,#e840c8)",
              color: open ? "#6b6860" : "#fff",
              border: "none", cursor: "pointer", flexShrink: 0,
            }}
          >
            {open ? "Collapse" : "Setup"}
          </button>
        </div>

        {open && (
          <div style={{
            marginTop: 20, paddingTop: 20,
            borderTop: "1px solid rgba(0,0,0,0.06)",
            display: "flex", flexDirection: "column", gap: 14,
          }}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const { copied, copy } = useCopy();
  const apiBase = typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "https://your-api.sushi.ai";

  const slackWebhookUrl = `${apiBase}/slack/events`;
  const githubWebhookUrl = `${apiBase}/integrations/github/webhook`;

  const [slackToken, setSlackToken] = useState("");
  const [slackChannel, setSlackChannel] = useState("#data-alerts");
  const [slackSaved, setSlackSaved] = useState(false);

  const saveSlack = () => {
    try {
      localStorage.setItem("sushi_slack_token", slackToken);
      localStorage.setItem("sushi_slack_channel", slackChannel);
    } catch {}
    setSlackSaved(true);
    setTimeout(() => setSlackSaved(false), 2500);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f0eee9", fontFamily: "inherit" }}>
      <style>{`@keyframes shimmer{0%{background-position:0% 0}100%{background-position:200% 0}}`}</style>

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
        <span style={{ fontWeight: 700, fontSize: 16, color: "#111010" }}>Integrations</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#9a9690" }}>
          Connect Sushi to your existing tools
        </span>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Slack */}
        <IntegrationCard
          icon={Slack}
          iconColor="#4A154B"
          title="Slack"
          badge="Available"
          badgeColor="#22c55e"
          description="Post dataset analysis summaries, monitor alerts, and credit usage directly to Slack channels. Supports slash commands and @mentions."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Step n={1} text="Create a Slack app at api.slack.com → Your Apps → Create New App" />
            <Step n={2} text='Enable "Slash Commands": add /sushi pointing to your API.' />
            <Step n={3} text='Enable "Event Subscriptions" and paste the Request URL below.' />
            <div>
              <p style={{ fontSize: 12, color: "#9a9690", margin: "0 0 6px" }}>Slack Events Request URL</p>
              <CodeBlock code={slackWebhookUrl} copyKey="slack-url" copied={copied} onCopy={copy} />
            </div>
            <Step n={4} text='Add OAuth scopes: commands, chat:write, app_mentions:read. Install to workspace.' />
            <Step n={5} text="Set the following env vars on your backend:" />
            <CodeBlock
              code={`SLACK_SIGNING_SECRET=your-signing-secret\nSLACK_BOT_TOKEN=xoxb-your-bot-token`}
              copyKey="slack-env" copied={copied} onCopy={copy}
            />
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#111010", margin: "4px 0 8px" }}>Available slash commands</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  ["/sushi help", "Show all commands"],
                  ["/sushi report <dataset_id>", "Post analysis summary to channel"],
                  ["/sushi credits", "Show AI credit usage for your org"],
                ].map(([cmd, desc]) => (
                  <div key={cmd} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <code style={{
                      fontSize: 12, padding: "2px 8px", borderRadius: 6,
                      background: "#1a1917", color: "#e8e4de",
                      fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
                      whiteSpace: "nowrap",
                    }}>{cmd}</code>
                    <span style={{ fontSize: 12, color: "#6b6860" }}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Optional: store token client-side for quick test */}
            <div style={{ paddingTop: 8, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#9a9690", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Quick test (stored locally)</p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={slackToken}
                  onChange={(e) => setSlackToken(e.target.value)}
                  placeholder="xoxb-bot-token"
                  style={{ flex: 1, padding: "7px 10px", borderRadius: 8, fontSize: 12.5, border: "1px solid rgba(0,0,0,0.1)", background: "rgba(255,255,255,0.9)", outline: "none" }}
                />
                <input
                  value={slackChannel}
                  onChange={(e) => setSlackChannel(e.target.value)}
                  placeholder="#channel"
                  style={{ width: 130, padding: "7px 10px", borderRadius: 8, fontSize: 12.5, border: "1px solid rgba(0,0,0,0.1)", background: "rgba(255,255,255,0.9)", outline: "none" }}
                />
                <button
                  onClick={saveSlack}
                  disabled={!slackToken}
                  style={{
                    padding: "7px 16px", borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                    background: slackSaved ? "#22c55e" : "linear-gradient(135deg,#9060f8,#e840c8)",
                    color: "#fff", border: "none", cursor: slackToken ? "pointer" : "default",
                    display: "flex", alignItems: "center", gap: 5,
                  }}
                >
                  {slackSaved ? <CheckCircle2 size={13} /> : <Zap size={13} />}
                  {slackSaved ? "Saved!" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </IntegrationCard>

        {/* GitHub */}
        <IntegrationCard
          icon={Github}
          iconColor="#111010"
          title="GitHub"
          badge="Available"
          badgeColor="#22c55e"
          description="Automatically analyze CSV, Parquet, and JSON files on every push to your repository. Results appear in your Sushi dataset list instantly."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Step n={1} text="Go to your GitHub repo → Settings → Webhooks → Add webhook" />
            <div>
              <p style={{ fontSize: 12, color: "#9a9690", margin: "0 0 6px" }}>Payload URL</p>
              <CodeBlock code={githubWebhookUrl} copyKey="gh-url" copied={copied} onCopy={copy} />
            </div>
            <Step n={2} text='Set Content type: application/json. Choose "Just the push event".' />
            <Step n={3} text="Generate a secret and set it on your backend:" />
            <CodeBlock
              code={`GITHUB_WEBHOOK_SECRET=your-webhook-secret\nGITHUB_DEFAULT_ORG_ID=your-org-uuid`}
              copyKey="gh-env" copied={copied} onCopy={copy}
            />
            <Step n={4} text="Any CSV, TSV, Parquet, or JSON file added/modified in a push will be queued for analysis automatically." />
            <div style={{
              padding: "10px 14px", borderRadius: 10,
              background: "rgba(144,96,248,0.07)",
              border: "1px solid rgba(144,96,248,0.15)",
            }}>
              <p style={{ fontSize: 12.5, color: "#6b6860", margin: 0, lineHeight: 1.5 }}>
                <strong style={{ color: "#9060f8" }}>Tip:</strong> Files larger than 100 MB are skipped. Analysis runs asynchronously — check the dataset list after a few seconds.
              </p>
            </div>
          </div>
        </IntegrationCard>

        {/* CLI */}
        <IntegrationCard
          icon={Terminal}
          iconColor="#00d4e8"
          title="Sushi CLI"
          badge="Beta"
          badgeColor="#f97316"
          description="Upload datasets, trigger analyses, and query your data directly from the terminal. Works great in CI/CD pipelines."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <p style={{ fontSize: 12, color: "#9a9690", margin: "0 0 6px" }}>Install</p>
              <CodeBlock code="pip install sushi-eda-cli" copyKey="cli-install" copied={copied} onCopy={copy} />
            </div>
            <div>
              <p style={{ fontSize: 12, color: "#9a9690", margin: "0 0 6px" }}>Configure</p>
              <CodeBlock
                code={`sushi configure --api-url ${apiBase} --org-id YOUR_ORG_ID`}
                copyKey="cli-config" copied={copied} onCopy={copy}
              />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#111010", margin: "4px 0 8px" }}>Common commands</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  ["sushi upload data.csv", "Upload & analyze a dataset"],
                  ["sushi list", "List all datasets in your org"],
                  ["sushi report <dataset_id>", "Print analysis summary"],
                  ["sushi query <dataset_id> 'SELECT * FROM data LIMIT 10'", "Run SQL against a dataset"],
                  ["sushi watch data.csv --interval 3600", "Re-upload and analyze every hour"],
                ].map(([cmd, desc]) => (
                  <div key={cmd} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
                    <code style={{
                      fontSize: 11.5, padding: "2px 8px", borderRadius: 6,
                      background: "#1a1917", color: "#00d4e8",
                      fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
                    }}>{cmd}</code>
                    <span style={{ fontSize: 12, color: "#6b6860", paddingTop: 2 }}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p style={{ fontSize: 12, color: "#9a9690", margin: "0 0 6px" }}>Use in GitHub Actions</p>
              <CodeBlock
                code={`- name: Analyze data\n  run: |\n    pip install sushi-eda-cli\n    sushi configure --api-url \${{ secrets.SUSHI_API_URL }} --org-id \${{ secrets.SUSHI_ORG_ID }}\n    sushi upload data/latest.csv`}
                copyKey="cli-ci"
                copied={copied}
                onCopy={copy}
              />
            </div>
          </div>
        </IntegrationCard>

        {/* Chrome Extension */}
        <IntegrationCard
          icon={Chrome}
          iconColor="#4285F4"
          title="Chrome Extension"
          badge="Coming soon"
          badgeColor="#9060f8"
          description="Analyze any CSV or table on the web with one click. Works on Google Sheets, GitHub, Notion, and raw CSV URLs."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{
              padding: 20, borderRadius: 14, textAlign: "center",
              background: "linear-gradient(135deg, rgba(66,133,244,0.06), rgba(144,96,248,0.06))",
              border: "1px dashed rgba(66,133,244,0.2)",
            }}>
              <Chrome size={36} style={{ color: "#4285F4", opacity: 0.5, margin: "0 auto 12px" }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: "#6b6860", margin: "0 0 6px" }}>
                Chrome Extension — launching Q2 2026
              </p>
              <p style={{ fontSize: 13, color: "#9a9690", margin: 0, lineHeight: 1.5 }}>
                Right-click any table or CSV link → "Analyze with Sushi"
              </p>
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#111010", margin: "0 0 8px" }}>Planned features</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  "Detect CSV / JSON URLs automatically and offer one-click analysis",
                  "Scrape HTML tables from any webpage and upload as datasets",
                  "Overlay column quality scores on Google Sheets",
                  "Send selected rows to Sushi SQL Editor",
                ].map((f, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <Circle size={6} style={{ color: "#9060f8", flexShrink: 0, marginTop: 5 }} />
                    <span style={{ fontSize: 13, color: "#3a3835" }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                placeholder="your@email.com — get notified at launch"
                style={{
                  flex: 1, padding: "8px 12px", borderRadius: 9, fontSize: 13,
                  border: "1px solid rgba(66,133,244,0.3)",
                  background: "rgba(255,255,255,0.9)", outline: "none",
                }}
              />
              <button style={{
                padding: "8px 18px", borderRadius: 9, fontSize: 13, fontWeight: 600,
                background: "linear-gradient(135deg,#4285F4,#9060f8)",
                color: "#fff", border: "none", cursor: "pointer",
              }}>
                Notify me
              </button>
            </div>
          </div>
        </IntegrationCard>

      </div>
    </div>
  );
}
