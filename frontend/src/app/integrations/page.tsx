"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Github,
  Slack,
  Terminal,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" ? `${window.location.origin}/api` : "https://your-api.sushi.ai");

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };
  return { copied, copy };
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 99,
        fontSize: 10.5,
        fontWeight: 700,
        background: `${color}18`,
        color,
      }}
    >
      {label}
    </span>
  );
}

function CodeBlock({
  code,
  copyKey,
  copied,
  onCopy,
}: {
  code: string;
  copyKey: string;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  return (
    <div
      style={{
        position: "relative",
        background: "#1a1917",
        borderRadius: 10,
        padding: "12px 44px 12px 16px",
        fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
        fontSize: 12.5,
        color: "#e8e4de",
        lineHeight: 1.6,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {code}
      <button
        onClick={() => onCopy(code, copyKey)}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          background: "rgba(255,255,255,0.08)",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
          color: "#9a9690",
          padding: "4px 7px",
          fontSize: 11,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {copied === copyKey ? (
          <CheckCircle2 size={12} style={{ color: "#22c55e" }} />
        ) : (
          <Copy size={12} />
        )}
        {copied === copyKey ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          flexShrink: 0,
          background: "linear-gradient(135deg,#9060f8,#e840c8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
          color: "#fff",
        }}
      >
        {n}
      </div>
      <p
        style={{
          fontSize: 13,
          color: "#3a3835",
          lineHeight: 1.5,
          margin: "1px 0 0",
        }}
      >
        {text}
      </p>
    </div>
  );
}

function Card({
  icon: Icon,
  iconColor,
  title,
  badge,
  badgeColor,
  description,
  children,
}: {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  badge: string;
  badgeColor: string;
  description: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.72)",
        border: "1px solid rgba(0,0,0,0.07)",
        borderRadius: 18,
        overflow: "hidden",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          height: 3,
          background: `linear-gradient(90deg, ${iconColor}, #e840c8, #00d4e8, ${iconColor})`,
          backgroundSize: "200% 100%",
        }}
      />
      <div style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 12,
              flexShrink: 0,
              background: `${iconColor}15`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon size={22} style={{ color: iconColor }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#111010",
                  margin: 0,
                }}
              >
                {title}
              </h3>
              <Badge label={badge} color={badgeColor} />
            </div>
            <p
              style={{
                fontSize: 13,
                color: "#6b6860",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {description}
            </p>
          </div>
          <button
            onClick={() => setOpen((value) => !value)}
            style={{
              padding: "7px 16px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              background: open
                ? "rgba(0,0,0,0.05)"
                : "linear-gradient(135deg,#9060f8,#e840c8)",
              color: open ? "#6b6860" : "#fff",
              border: "none",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {open ? "Collapse" : "Setup"}
          </button>
        </div>

        {open && (
          <div
            style={{
              marginTop: 20,
              paddingTop: 20,
              borderTop: "1px solid rgba(0,0,0,0.06)",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  const { copied, copy } = useCopy();
  const normalizedApiBase = API_BASE.replace(/\/$/, "");
  const slackWebhookUrl = `${normalizedApiBase}/slack/events`;
  const githubWebhookUrl = `${normalizedApiBase}/integrations/github/webhook`;

  return (
    <div style={{ minHeight: "100vh", background: "#f0eee9" }}>
      <div
        style={{
          background: "rgba(240,238,233,0.92)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(0,0,0,0.07)",
          padding: "14px 32px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            height: 3,
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            background: "linear-gradient(90deg,#9060f8,#e840c8,#00d4e8,#9060f8)",
            backgroundSize: "200% 100%",
          }}
        />
        <Link
          href="/"
          style={{
            color: "#9a9690",
            display: "flex",
            alignItems: "center",
            gap: 6,
            textDecoration: "none",
            fontSize: 13,
          }}
        >
          <ArrowLeft size={15} /> Dashboard
        </Link>
        <span style={{ color: "rgba(0,0,0,0.15)" }}>|</span>
        <span style={{ fontWeight: 700, fontSize: 16, color: "#111010" }}>
          Integrations
        </span>
        <span
          style={{ marginLeft: "auto", fontSize: 12, color: "#9a9690" }}
        >
          Launch-preview setup guides
        </span>
      </div>

      <div
        style={{
          maxWidth: 800,
          margin: "0 auto",
          padding: "32px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderRadius: 14,
            background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.18)",
          }}
        >
          <p
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              color: "#111010",
              margin: 0,
            }}
          >
            These integrations are guided beta surfaces
          </p>
          <p
            style={{
              fontSize: 12.5,
              color: "#6b6860",
              margin: "4px 0 0",
              lineHeight: 1.5,
            }}
          >
            Keep them in the product as investor-proof setup guides. Show them
            live only after validating the target environment and secrets.
          </p>
        </div>

        <Card
          icon={Slack}
          iconColor="#4A154B"
          title="Slack"
          badge="Guided beta"
          badgeColor="#f97316"
          description="Post dataset summaries and monitor alerts to Slack after validating signing secrets and one working workspace mapping."
        >
          <Step n={1} text="Create a Slack app at api.slack.com and enable slash commands plus event subscriptions." />
          <Step n={2} text="Use the request URL below for Events API and configure slash commands separately." />
          <CodeBlock
            code={slackWebhookUrl}
            copyKey="slack-url"
            copied={copied}
            onCopy={copy}
          />
          <Step n={3} text="Set Slack secrets only on the backend. Do not paste them into the browser." />
          <CodeBlock
            code={`SLACK_SIGNING_SECRET=your-signing-secret\nSLACK_BOT_TOKEN=xoxb-your-bot-token`}
            copyKey="slack-env"
            copied={copied}
            onCopy={copy}
          />
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(239,68,68,0.07)",
              border: "1px solid rgba(239,68,68,0.15)",
            }}
          >
            <p style={{ fontSize: 12.5, color: "#6b6860", margin: 0 }}>
              <strong style={{ color: "#ef4444" }}>Security note:</strong>{" "}
              browser-stored Slack tokens are intentionally not supported in the
              MVP launch.
            </p>
          </div>
        </Card>

        <Card
          icon={Github}
          iconColor="#111010"
          title="GitHub"
          badge="Guided beta"
          badgeColor="#f97316"
          description="Automatically queue supported data files for analysis after validating webhook signatures and one repo-to-org mapping."
        >
          <Step n={1} text="Create a GitHub webhook for push events only." />
          <CodeBlock
            code={githubWebhookUrl}
            copyKey="github-url"
            copied={copied}
            onCopy={copy}
          />
          <Step n={2} text="Set a shared secret and map the repo to the correct org on the backend." />
          <CodeBlock
            code={`GITHUB_WEBHOOK_SECRET=your-webhook-secret\nGITHUB_DEFAULT_ORG_ID=your-org-uuid`}
            copyKey="github-env"
            copied={copied}
            onCopy={copy}
          />
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(144,96,248,0.07)",
              border: "1px solid rgba(144,96,248,0.15)",
            }}
          >
            <p style={{ fontSize: 12.5, color: "#6b6860", margin: 0 }}>
              Use this as a controlled demo flow unless you have already verified
              production webhook delivery and file import behavior.
            </p>
          </div>
        </Card>

        <Card
          icon={Terminal}
          iconColor="#00d4e8"
          title="CLI And Automation"
          badge="Separate surface"
          badgeColor="#9a9690"
          description="Useful for operations and automation, but not part of the website MVP launch."
        >
          <CodeBlock
            code="pip install sushi-eda-cli"
            copyKey="cli-install"
            copied={copied}
            onCopy={copy}
          />
          <CodeBlock
            code={`sushi configure --api-url ${normalizedApiBase} --org-id YOUR_ORG_ID`}
            copyKey="cli-config"
            copied={copied}
            onCopy={copy}
          />
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(0,0,0,0.05)",
              border: "1px solid rgba(0,0,0,0.08)",
            }}
          >
            <p style={{ fontSize: 12.5, color: "#6b6860", margin: 0 }}>
              Keep CLI references out of the primary investor demo unless you
              separately validate packaging and auth setup.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
