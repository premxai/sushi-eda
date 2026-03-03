"use client";

import { useEffect, useState } from "react";
import { Zap, ArrowUpRight, Infinity } from "lucide-react";
import { getCreditStatus, CreditStatus } from "@/lib/api";

interface Props {
  orgId?: string;
  className?: string;
}

export default function CreditsUsageBar({ orgId = "default", className = "" }: Props) {
  const [status, setStatus] = useState<CreditStatus | null>(null);

  useEffect(() => {
    getCreditStatus(orgId).then(setStatus).catch(() => null);
  }, [orgId]);

  if (!status) return null;

  const unlimited = status.ai_credits_limit === -1;
  const pct = unlimited ? 0 : Math.min(status.percent_used, 100);

  const barColor =
    pct >= 90 ? "bg-red-500" :
    pct >= 70 ? "bg-amber-400" :
    "bg-violet-500";

  const planLabel =
    status.plan === "free" ? "Free" :
    status.plan === "pro"  ? "Pro"  :
    status.plan === "team" ? "Team" : status.plan;

  return (
    <div className={`rounded-xl border border-neutral-200 bg-white p-4 space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-semibold text-neutral-800">AI Credits</span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 font-medium">
          {planLabel}
        </span>
      </div>

      {/* Usage */}
      {unlimited ? (
        <div className="flex items-center gap-2 text-sm text-neutral-600">
          <Infinity className="h-4 w-4 text-violet-400" />
          <span>Unlimited credits</span>
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-neutral-500">
              <span>{status.ai_credits_used.toLocaleString()} used</span>
              <span>{status.ai_credits_limit.toLocaleString()} total</span>
            </div>
            <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Upgrade CTA */}
          {status.plan === "free" && pct >= 60 && (
            <a
              href="/pricing"
              className="flex items-center justify-between w-full text-xs px-3 py-2 rounded-lg
                         bg-violet-50 border border-violet-100 text-violet-700
                         hover:bg-violet-100 transition-colors"
            >
              <span className="font-medium">
                {pct >= 90 ? "Almost out of credits — upgrade now" : "Upgrade for more credits"}
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 flex-shrink-0" />
            </a>
          )}
        </>
      )}
    </div>
  );
}
