"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  CornerDownRight,
  Edit2,
  MessageCircle,
  RefreshCw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import {
  CommentThread,
  createComment,
  deleteComment,
  editComment,
  listComments,
} from "@/lib/api";

// ─── helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const AVATAR_COLORS = [
  "#9060f8", "#e840c8", "#00d4e8", "#f97316", "#22c55e", "#3b82f6",
];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ─── sub-components ───────────────────────────────────────────────────────────

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const bg = avatarColor(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.38, fontWeight: 700, color: "#fff",
    }}>
      {initials(name)}
    </div>
  );
}

interface CommentCardProps {
  comment: CommentThread | CommentThread["replies"][number];
  orgId: string;
  onReply?: () => void;
  onDeleted: (id: string) => void;
  onEdited: (id: string, newContent: string) => void;
  isReply?: boolean;
}

function CommentCard({ comment, orgId, onReply, onDeleted, onEdited, isReply }: CommentCardProps) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(comment.content);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSaveEdit = async () => {
    if (!editVal.trim()) return;
    setSaving(true);
    try {
      const updated = await editComment(comment.comment_id, editVal.trim(), orgId);
      onEdited(comment.comment_id, updated.content);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await deleteComment(comment.comment_id, orgId);
    onDeleted(comment.comment_id);
  };

  return (
    <div style={{
      display: "flex", gap: 10,
      paddingLeft: isReply ? 28 : 0,
    }}>
      {isReply && (
        <CornerDownRight size={13} style={{ color: "#c8c4be", marginTop: 6, flexShrink: 0 }} />
      )}
      <Avatar name={comment.author_name} size={isReply ? 22 : 28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "#111010" }}>
            {comment.author_name}
          </span>
          {comment.column_name && (
            <span style={{
              fontSize: 10.5, padding: "1px 6px", borderRadius: 99,
              background: "rgba(144,96,248,0.1)", color: "#9060f8", fontWeight: 500,
              fontFamily: "ui-monospace, 'Cascadia Code', Menlo, monospace",
            }}>
              {comment.column_name}
            </span>
          )}
          <span style={{ fontSize: 11, color: "#c8c4be", marginLeft: "auto" }}>
            {timeAgo(comment.created_at)}
            {comment.edited_at && " · edited"}
          </span>
        </div>

        {editing ? (
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <input
              value={editVal}
              onChange={(e) => setEditVal(e.target.value)}
              style={{
                flex: 1, padding: "5px 8px", borderRadius: 8, fontSize: 12.5,
                border: "1px solid rgba(144,96,248,0.4)",
                background: "rgba(255,255,255,0.9)", outline: "none",
              }}
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") setEditing(false); }}
              autoFocus
            />
            <button onClick={handleSaveEdit} disabled={saving} style={iconBtnStyle("#9060f8")}>
              <Send size={13} />
            </button>
            <button onClick={() => setEditing(false)} style={iconBtnStyle("#9a9690")}>
              <X size={13} />
            </button>
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "#3a3835", margin: 0, lineHeight: 1.5, wordBreak: "break-word" }}>
            {comment.content}
          </p>
        )}

        {!editing && (
          <div style={{ display: "flex", gap: 10, marginTop: 5 }}>
            {onReply && (
              <button onClick={onReply} style={ghostBtnStyle}>Reply</button>
            )}
            <button onClick={() => { setEditing(true); setEditVal(comment.content); setConfirmDelete(false); }} style={ghostBtnStyle}>
              <Edit2 size={10} style={{ marginRight: 2 }} /> Edit
            </button>
            <button
              onClick={handleDelete}
              style={{ ...ghostBtnStyle, color: confirmDelete ? "#ef4444" : "#c8c4be" }}
            >
              <Trash2 size={10} style={{ marginRight: 2 }} />
              {confirmDelete ? "Confirm?" : "Delete"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const ghostBtnStyle: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer",
  fontSize: 11, color: "#c8c4be", display: "flex", alignItems: "center",
  padding: 0,
};
function iconBtnStyle(color: string): React.CSSProperties {
  return {
    background: `${color}18`, border: "none", cursor: "pointer",
    color, borderRadius: 6, padding: "4px 7px",
    display: "flex", alignItems: "center",
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  datasetId: string | null;
  orgId?: string;
  columns?: string[];
}

export function CommentsSection({ datasetId, orgId = "default", columns = [] }: Props) {
  const [threads, setThreads] = useState<CommentThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterCol, setFilterCol] = useState<string>("all");
  const [newContent, setNewContent] = useState("");
  const [newCol, setNewCol] = useState<string>("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [posting, setPosting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!datasetId) return;
    setLoading(true);
    try {
      const data = await listComments(datasetId, orgId);
      setThreads(data);
    } finally {
      setLoading(false);
    }
  }, [datasetId, orgId]);

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 30000); // poll every 30s
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  const handlePost = async () => {
    if (!datasetId || !newContent.trim()) return;
    setPosting(true);
    try {
      const comment = await createComment(
        datasetId,
        { content: newContent.trim(), column_name: newCol || undefined, author_name: "You" },
        orgId
      );
      setThreads((prev) => [...prev, comment]);
      setNewContent("");
      setNewCol("");
    } finally {
      setPosting(false);
    }
  };

  const handleReply = async (parentId: string) => {
    if (!datasetId || !replyContent.trim()) return;
    setPosting(true);
    try {
      await createComment(
        datasetId,
        { content: replyContent.trim(), parent_id: parentId, author_name: "You" },
        orgId
      );
      setReplyTo(null);
      setReplyContent("");
      await load();
    } finally {
      setPosting(false);
    }
  };

  const handleDeleted = (id: string) => {
    setThreads((prev) =>
      prev
        .filter((t) => t.comment_id !== id)
        .map((t) => ({ ...t, replies: t.replies.filter((r) => r.comment_id !== id) }))
    );
  };

  const handleEdited = (id: string, content: string) => {
    setThreads((prev) =>
      prev.map((t) => {
        if (t.comment_id === id) return { ...t, content };
        return { ...t, replies: t.replies.map((r) => r.comment_id === id ? { ...r, content } : r) };
      })
    );
  };

  const visible = filterCol === "all"
    ? threads
    : threads.filter((t) => t.column_name === (filterCol === "_dataset" ? null : filterCol));

  if (!datasetId) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#9a9690" }}>
        <MessageCircle size={32} style={{ opacity: 0.3, margin: "0 auto 12px" }} />
        <p style={{ fontSize: 14 }}>Open a dataset to view comments.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 0 }}>
      <style>{`@keyframes shimmer{0%{background-position:0% 0}100%{background-position:200% 0}}`}</style>

      {/* Header */}
      <div style={{
        padding: "0 0 16px",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["all", "_dataset", ...columns].map((c) => (
            <button
              key={c}
              onClick={() => setFilterCol(c)}
              style={{
                padding: "4px 10px", borderRadius: 99, fontSize: 11.5, fontWeight: 500,
                border: "1px solid",
                borderColor: filterCol === c ? "#9060f8" : "rgba(0,0,0,0.1)",
                background: filterCol === c ? "rgba(144,96,248,0.1)" : "transparent",
                color: filterCol === c ? "#9060f8" : "#6b6860",
                cursor: "pointer",
                fontFamily: c === "all" || c === "_dataset" ? "inherit" : "ui-monospace, 'Cascadia Code', Menlo, monospace",
              }}
            >
              {c === "all" ? "All" : c === "_dataset" ? "Dataset" : c}
            </button>
          ))}
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#9a9690", padding: 4 }}
        >
          <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
        </button>
      </div>

      {/* Thread list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 0", display: "flex", flexDirection: "column", gap: 20 }}>
        {visible.length === 0 && !loading && (
          <div style={{ textAlign: "center", color: "#c8c4be", paddingTop: 32 }}>
            <MessageCircle size={28} style={{ opacity: 0.4, margin: "0 auto 8px" }} />
            <p style={{ fontSize: 13 }}>No comments yet. Be the first!</p>
          </div>
        )}

        {visible.map((thread) => (
          <div
            key={thread.comment_id}
            style={{
              background: "rgba(255,255,255,0.72)",
              border: "1px solid rgba(0,0,0,0.06)",
              borderRadius: 14,
              padding: "14px 16px",
              display: "flex", flexDirection: "column", gap: 12,
            }}
          >
            {/* Iridescent stripe */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 2,
              background: "linear-gradient(90deg,#9060f8,#e840c8,#00d4e8,#9060f8)",
              backgroundSize: "200% 100%", animation: "shimmer 4s linear infinite",
              borderRadius: "14px 14px 0 0",
            }} />

            <div style={{ position: "relative" }}>
              <CommentCard
                comment={thread}
                orgId={orgId}
                onReply={() => setReplyTo(replyTo === thread.comment_id ? null : thread.comment_id)}
                onDeleted={handleDeleted}
                onEdited={handleEdited}
              />

              {/* Replies */}
              {thread.replies.map((reply) => (
                <div key={reply.comment_id} style={{ marginTop: 10 }}>
                  <CommentCard
                    comment={reply}
                    orgId={orgId}
                    onDeleted={handleDeleted}
                    onEdited={handleEdited}
                    isReply
                  />
                </div>
              ))}

              {/* Reply composer */}
              {replyTo === thread.comment_id && (
                <div style={{ display: "flex", gap: 8, marginTop: 10, paddingLeft: 36 }}>
                  <input
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="Write a reply…"
                    onKeyDown={(e) => { if (e.key === "Enter") handleReply(thread.comment_id); }}
                    style={{
                      flex: 1, padding: "6px 10px", borderRadius: 8, fontSize: 12.5,
                      border: "1px solid rgba(144,96,248,0.3)",
                      background: "rgba(255,255,255,0.9)", outline: "none",
                    }}
                    autoFocus
                  />
                  <button
                    onClick={() => handleReply(thread.comment_id)}
                    disabled={posting || !replyContent.trim()}
                    style={{
                      padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: "linear-gradient(135deg,#9060f8,#e840c8)",
                      color: "#fff", border: "none", cursor: "pointer",
                    }}
                  >
                    <Send size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* New comment composer */}
      <div style={{
        borderTop: "1px solid rgba(0,0,0,0.06)",
        paddingTop: 16,
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        {columns.length > 0 && (
          <select
            value={newCol}
            onChange={(e) => setNewCol(e.target.value)}
            style={{
              padding: "6px 10px", borderRadius: 8, fontSize: 12.5,
              border: "1px solid rgba(0,0,0,0.1)",
              background: "rgba(255,255,255,0.9)", outline: "none",
              color: newCol ? "#111010" : "#9a9690",
            }}
          >
            <option value="">Dataset-level comment</option>
            {columns.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Add a comment… (Enter to send)"
            rows={2}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handlePost(); } }}
            style={{
              flex: 1, padding: "8px 10px", borderRadius: 10, fontSize: 12.5,
              border: "1px solid rgba(144,96,248,0.3)",
              background: "rgba(255,255,255,0.9)", outline: "none",
              resize: "none", lineHeight: 1.5,
            }}
          />
          <button
            onClick={handlePost}
            disabled={posting || !newContent.trim()}
            style={{
              padding: "8px 14px", borderRadius: 10,
              background: posting || !newContent.trim()
                ? "rgba(0,0,0,0.07)"
                : "linear-gradient(135deg,#9060f8,#e840c8)",
              color: posting || !newContent.trim() ? "#9a9690" : "#fff",
              border: "none", cursor: posting || !newContent.trim() ? "default" : "pointer",
              display: "flex", alignItems: "center",
            }}
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
