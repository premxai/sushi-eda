"use client";

import React from "react";
import { motion } from "framer-motion";

const GRAIN_COLORS = ["var(--salmon)", "var(--tuna)", "var(--wasabi)", "var(--ink)"];

/** Deterministic PRNG so server and client render the same "random" scatter
 * (Math.random() at render time would mismatch on hydration). */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Grain {
  scatterX: number;
  scatterY: number;
  scatterRotate: number;
  gridX: number;
  gridY: number;
  color: string;
}

function buildGrains(count: number, cols: number, cell: number, seed: number): Grain[] {
  const rng = mulberry32(seed);
  return Array.from({ length: count }, (_, i) => ({
    scatterX: (rng() - 0.5) * cell * cols * 0.9,
    scatterY: (rng() - 0.5) * cell * Math.ceil(count / cols) * 1.4,
    scatterRotate: (rng() - 0.5) * 140,
    gridX: (i % cols) * cell,
    gridY: Math.floor(i / cols) * cell,
    color: GRAIN_COLORS[i % GRAIN_COLORS.length],
  }));
}

interface DataGrainProps {
  count?: number;
  cols?: number;
  cell?: number;
  grainSize?: number;
  className?: string;
  /** Seed varies the scatter pattern per instance without changing code. */
  seed?: number;
}

/**
 * The core "hidden meaning" motif: messy, rotated data grains that snap
 * into a clean aligned grid once scrolled into view — raw ingredients
 * becoming a refined, orderly report. Pure SVG rects animated via
 * framer-motion, not a canvas/particle system, so it stays crisp and cheap.
 */
export function DataGrain({ count = 16, cols = 4, cell = 15, grainSize = 9, className, seed = 7 }: DataGrainProps) {
  const grains = React.useMemo(() => buildGrains(count, cols, cell, seed), [count, cols, cell, seed]);
  const width = cols * cell;
  const height = Math.ceil(count / cols) * cell;

  return (
    <svg
      viewBox={`${-width * 0.4} ${-height * 0.5} ${width * 1.8} ${height * 2}`}
      width={width * 1.8}
      height={height * 2}
      className={className}
      aria-hidden="true"
    >
      {grains.map((g, i) => (
        <motion.rect
          key={i}
          width={grainSize}
          height={grainSize}
          rx={2}
          fill={g.color}
          initial={{
            x: g.scatterX,
            y: g.scatterY,
            rotate: g.scatterRotate,
            opacity: 0.35,
          }}
          whileInView={{
            x: g.gridX,
            y: g.gridY,
            rotate: 0,
            opacity: 1,
          }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.7, delay: i * 0.025, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}
    </svg>
  );
}
