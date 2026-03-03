"use client";

import React, { useEffect, useState } from "react";
import { X, Upload, Sparkles, Share2, ChevronRight } from "lucide-react";

const TOUR_KEY = "sushi_tour_v1_done";

const STEPS = [
  {
    icon: Upload,
    color: "bg-indigo-100 text-indigo-600",
    title: "Drop your data, get instant insights",
    description:
      "Upload CSV, Excel, JSON, Parquet, or SQLite — up to 100 MB. Sushi runs a full exploratory analysis in seconds. No code, no setup.",
  },
  {
    icon: Sparkles,
    color: "bg-violet-100 text-violet-600",
    title: "AI that reads your data for you",
    description:
      "Get quality scores, outlier detection, column stats, and a plain-English narrative. Ask questions in natural language — Sushi writes and runs the SQL.",
  },
  {
    icon: Share2,
    color: "bg-emerald-100 text-emerald-600",
    title: "Share reports with one link",
    description:
      "Generate a shareable link anyone can view — no login required. Perfect for sending analysis to clients or teammates instantly.",
  },
];

interface ProductTourProps {
  onDismiss?: () => void;
}

export function ProductTour({ onDismiss }: ProductTourProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem(TOUR_KEY)) {
      // Small delay so page renders first
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(TOUR_KEY, "1");
    setVisible(false);
    onDismiss?.();
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  };

  if (!visible) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={dismiss}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:bg-neutral-900 dark:border-neutral-800">
        {/* Close */}
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 rounded-lg p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6 pt-5">
          {/* Step dots */}
          <div className="mb-5 flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === step
                    ? "w-6 bg-indigo-500"
                    : i < step
                      ? "w-2 bg-indigo-200"
                      : "w-2 bg-neutral-200 dark:bg-neutral-700"
                }`}
              />
            ))}
          </div>

          {/* Icon */}
          <div className={`mb-4 inline-flex rounded-xl p-3 ${current.color}`}>
            <Icon className="h-6 w-6" />
          </div>

          {/* Content */}
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {current.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
            {current.description}
          </p>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={dismiss}
              className="text-xs text-neutral-400 transition-colors hover:text-neutral-600 dark:hover:text-neutral-300"
            >
              Skip tour
            </button>

            <button
              onClick={next}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            >
              {isLast ? "Get started" : "Next"}
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
