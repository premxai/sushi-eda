"use client";

import React from "react";
import { motion } from "framer-motion";

const PLATE_COLORS = ["var(--salmon)", "var(--wasabi)", "var(--tuna)"];

interface ConveyorLoaderProps {
  /** 0-100 — fills the belt track, same value the caller already tracks. */
  progress: number;
  className?: string;
}

/**
 * Kaiten-zushi belt: plates loop past continuously (the dish always keeps
 * moving, independent of real progress) while a track underneath fills to
 * the actual upload/analysis percentage — the honest progress signal is
 * separate from the ambient "something is happening" motion.
 */
export function ConveyorLoader({ progress, className }: ConveyorLoaderProps) {
  return (
    <div className={className}>
      <svg viewBox="0 0 220 44" width="100%" height="44" role="img" aria-label="Processing">
        <line x1="6" y1="30" x2="214" y2="30" stroke="var(--line-2)" strokeWidth="2" strokeLinecap="round" />
        {PLATE_COLORS.map((color, i) => (
          <motion.g
            key={i}
            initial={{ x: -30 }}
            animate={{ x: 250 }}
            transition={{
              duration: 2.6,
              repeat: Infinity,
              ease: "linear",
              delay: i * (2.6 / PLATE_COLORS.length),
            }}
          >
            <rect x="0" y="14" width="26" height="26" rx="13" fill="var(--surface)" stroke={color} strokeWidth="2.5" />
            <circle cx="13" cy="27" r="6" fill={color} opacity="0.85" />
          </motion.g>
        ))}
      </svg>

      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-paper-2">
        <motion.div
          className="h-full rounded-full bg-[linear-gradient(90deg,var(--salmon),var(--tuna))]"
          animate={{ width: `${Math.max(6, progress)}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
