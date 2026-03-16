"use client";

import Link from "next/link";
import { X, Zap, Check } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  creditsUsed?: number;
  creditsLimit?: number;
}

const PRO_FEATURES = [
  "2,000 AI credits / month",
  "Unlimited datasets",
  "Dataset monitors + Slack alerts",
  "Data connectors (PostgreSQL, S3)",
  "Priority support",
];

export default function UpgradeModal({
  open,
  onClose,
  creditsUsed,
  creditsLimit,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 space-y-5">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon + headline */}
        <div className="space-y-2">
          <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
            <Zap className="h-5 w-5 text-violet-600" />
          </div>
          <h2 className="text-lg font-bold text-neutral-900">
            You&apos;ve hit your AI credit limit
          </h2>
          {creditsUsed !== undefined && creditsLimit !== undefined && (
            <p className="text-sm text-neutral-500">
              {creditsUsed.toLocaleString()} / {creditsLimit.toLocaleString()}{" "}
              credits used this period.
            </p>
          )}
        </div>

        {/* Feature list */}
        <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4 space-y-2">
          <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-3">
            Pro Plan — $29/mo
          </p>
          {PRO_FEATURES.map((f) => (
            <div
              key={f}
              className="flex items-center gap-2 text-sm text-neutral-700"
            >
              <Check className="h-4 w-4 text-violet-500 flex-shrink-0" />
              {f}
            </div>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/pricing"
          className="block w-full text-center py-2.5 rounded-xl bg-neutral-900 text-white
                     text-sm font-semibold hover:bg-neutral-700 transition-colors"
        >
          Upgrade to Pro
        </Link>

        <p className="text-center text-xs text-neutral-400">
          Cancel anytime · No long-term contract
        </p>
      </div>
    </div>
  );
}
