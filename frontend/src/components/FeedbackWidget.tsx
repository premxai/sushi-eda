"use client";

import React, { useState } from "react";
import { CheckCircle2, Loader2, MessageSquarePlus, X } from "lucide-react";
import { getApiErrorMessage, submitFeedback } from "@/lib/api";

/** Floating feedback button + popover. Mounted once in the root layout. */
export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (message.trim().length < 3 || sending) return;
    setSending(true);
    setError(null);
    try {
      await submitFeedback(message.trim(), email.trim() || undefined, window.location.pathname);
      setSent(true);
      setMessage("");
      setTimeout(() => {
        setSent(false);
        setOpen(false);
      }, 1800);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not send feedback right now."));
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ position: "fixed", bottom: 18, right: 18, zIndex: 90 }}>
      {open && (
        <div
          style={{
            width: 300,
            marginBottom: 10,
            borderRadius: 14,
            background: "rgba(255,255,255,0.97)",
            border: "1px solid rgba(0,0,0,0.1)",
            boxShadow: "0 10px 40px rgba(0,0,0,0.14)",
            padding: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
              Tell us what&apos;s missing
            </span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close feedback"
              style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--muted-ink)" }}
            >
              <X size={14} />
            </button>
          </div>

          {sent ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 4px", color: "#16a34a", fontSize: 13 }}>
              <CheckCircle2 size={16} /> Thanks — we read every note.
            </div>
          ) : (
            <>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="A bug, a confusing screen, a feature you wish existed…"
                style={{
                  width: "100%", boxSizing: "border-box", resize: "vertical",
                  borderRadius: 8, border: "1px solid rgba(0,0,0,0.12)",
                  padding: "8px 10px", fontSize: 13, color: "var(--ink)",
                  outline: "none", background: "#fff",
                }}
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email (optional, for a reply)"
                type="email"
                style={{
                  width: "100%", boxSizing: "border-box", marginTop: 6,
                  borderRadius: 8, border: "1px solid rgba(0,0,0,0.12)",
                  padding: "7px 10px", fontSize: 12.5, color: "var(--ink)",
                  outline: "none", background: "#fff",
                }}
              />
              {error && <p style={{ fontSize: 11.5, color: "#dc2626", margin: "6px 0 0" }}>{error}</p>}
              <button
                onClick={send}
                disabled={message.trim().length < 3 || sending}
                style={{
                  marginTop: 8, width: "100%", display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 6, padding: "8px 0",
                  borderRadius: 8, border: "none", cursor: "pointer",
                  background: "linear-gradient(135deg, var(--salmon), var(--tuna))",
                  color: "#fff", fontSize: 12.5, fontWeight: 600,
                  opacity: message.trim().length < 3 || sending ? 0.55 : 1,
                }}
              >
                {sending ? <Loader2 size={13} className="animate-spin" /> : null}
                {sending ? "Sending…" : "Send feedback"}
              </button>
            </>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Send feedback"
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "9px 14px", borderRadius: 99, border: "1px solid rgba(0,0,0,0.08)",
          background: "rgba(255,255,255,0.92)", backdropFilter: "blur(10px)",
          boxShadow: "0 4px 18px rgba(0,0,0,0.12)", cursor: "pointer",
          fontSize: 12.5, fontWeight: 600, color: "var(--muted-ink)", marginLeft: "auto",
        }}
      >
        <MessageSquarePlus size={14} style={{ color: "var(--salmon)" }} />
        Feedback
      </button>
    </div>
  );
}
