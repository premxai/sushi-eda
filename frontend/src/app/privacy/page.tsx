import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy — Sushi",
  description: "What happens to the data you upload to Sushi, in plain English.",
};

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "What happens when you upload a file",
    body: (
      <>
        Your file is sent over an encrypted connection, stored privately, and
        analyzed automatically. The analysis results (statistics, charts, and the
        AI-written summary) are saved so you can reopen the report and share it
        with a link. Nobody else can browse your uploads.
      </>
    ),
  },
  {
    title: "Your file is deleted after 7 days",
    body: (
      <>
        Uploaded files and their analysis reports are automatically and
        permanently deleted 7 days after upload. Share links stop working when
        the underlying report is deleted. If you need something gone sooner,
        archive or delete the dataset yourself from <Link href="/datasets" style={{ color: "#9060f8" }}>My Datasets</Link>.
      </>
    ),
  },
  {
    title: "Your data is never used to train AI",
    body: (
      <>
        The AI summary and chat features send a statistical profile of your data
        (and, for chat, query results) to Anthropic&apos;s Claude API to generate
        answers. Anthropic does not train models on this API data. We never sell
        your data or use it for anything other than producing your report.
      </>
    ),
  },
  {
    title: "What we don't collect",
    body: (
      <>
        No account is required, so we hold no profile about you. We don&apos;t use
        advertising trackers. Anonymous, aggregate usage counts (like number of
        analyses run) may be recorded to keep the service healthy and prevent abuse.
      </>
    ),
  },
  {
    title: "Sensitive data",
    body: (
      <>
        Please don&apos;t upload data that identifies real people (names, emails,
        health or financial records) unless you&apos;re authorized to work with it.
        For confidential datasets, Sushi is open source and can be{" "}
        <a
          href="https://github.com/premxai/sushi-eda"
          style={{ color: "#9060f8" }}
          target="_blank"
          rel="noopener noreferrer"
        >
          self-hosted
        </a>{" "}
        entirely on your own infrastructure.
      </>
    ),
  },
  {
    title: "Questions",
    body: (
      <>
        Use the Feedback button in the app, or open an issue on{" "}
        <a
          href="https://github.com/premxai/sushi-eda/issues"
          style={{ color: "#9060f8" }}
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
        .
      </>
    ),
  },
];

export default function PrivacyPage() {
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
        <Link
          href="/"
          style={{ color: "#9a9690", display: "flex", alignItems: "center", gap: 6, textDecoration: "none", fontSize: 13 }}
        >
          <ArrowLeft size={15} /> Back
        </Link>
        <span style={{ color: "rgba(0,0,0,0.15)" }}>|</span>
        <span style={{ fontWeight: 700, fontSize: 16, color: "#111010" }}>Privacy</span>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <ShieldCheck size={22} style={{ color: "#22c55e" }} />
          <h1 style={{ fontSize: 30, fontWeight: 800, color: "#111010", margin: 0, letterSpacing: "-0.4px" }}>
            Your data, plainly
          </h1>
        </div>
        <p style={{ fontSize: 14, color: "#6b6860", margin: "6px 0 32px", lineHeight: 1.6 }}>
          Sushi exists to help you understand a data file, not to collect your data.
          Here is exactly what happens to what you upload — no legalese.
        </p>

        {SECTIONS.map((s) => (
          <section key={s.title} style={{ marginBottom: 26 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111010", marginBottom: 6 }}>
              {s.title}
            </h2>
            <p style={{ fontSize: 13.5, color: "#4b4540", lineHeight: 1.65, margin: 0 }}>{s.body}</p>
          </section>
        ))}

        <p style={{ fontSize: 12, color: "#9a9690", marginTop: 40 }}>
          Last updated July 2026. Material changes will be noted in the{" "}
          <Link href="/changelog" style={{ color: "#9060f8" }}>changelog</Link>.
        </p>
      </div>
    </div>
  );
}
