"use client";

import React, { useEffect, useState } from "react";
import { X, Keyboard } from "lucide-react";

export function KeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      )
        return;

      // ? key to toggle help
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      // Escape to close
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition-transform hover:scale-110 hover:bg-indigo-700"
        title="Keyboard shortcuts (?)"
      >
        <Keyboard className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <ShortcutRow keys={["?"]} description="Toggle this help menu" />
          <ShortcutRow keys={["Esc"]} description="Close modals" />
          <ShortcutRow
            keys={["Ctrl", "/"]}
            description="Focus search (coming soon)"
          />
          <ShortcutRow
            keys={["1-6"]}
            description="Navigate sections (coming soon)"
          />
        </div>

        <div className="mt-6 rounded-md bg-slate-50 p-3">
          <p className="text-xs text-slate-600">
            <strong>Tip:</strong> Press{" "}
            <kbd className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold shadow-sm">
              ?
            </kbd>{" "}
            anytime to see shortcuts
          </p>
        </div>
      </div>
    </div>
  );
}

function ShortcutRow({
  keys,
  description,
}: {
  keys: string[];
  description: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-700">{description}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-xs text-slate-400">+</span>}
            <kbd className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm">
              {key}
            </kbd>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
