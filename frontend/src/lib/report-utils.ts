import { CorrelationMatrix, OutlierInfo, QualityScore } from "./types";

/** One-line plain-English verdict for a quality grade — matches the exact
 * copy established in the design brief; do not rephrase. */
export function gradeVerdict(grade: string): string {
  switch (grade) {
    case "A":
      return "This data looks clean and trustworthy — you can present numbers from it with confidence.";
    case "B":
      return "Broadly trustworthy — skim the notes below before presenting exact totals.";
    case "C":
      return "Usable with care — several issues below could shift totals and averages.";
    case "D":
      return "Treat conclusions from this data as rough estimates until the issues below are fixed.";
    default:
      return "This data has serious quality problems — clean it up before trusting any numbers from it.";
  }
}

export type QualityTone = "good" | "caution" | "bad";

export function qualityTone(score: number): QualityTone {
  if (score >= 80) return "good";
  if (score >= 60) return "caution";
  return "bad";
}

export function graphFromScore(score: number): string {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

const DIMENSION_LABELS: Record<string, string> = {
  missing_data: "Missing data",
  duplicates: "Duplicates",
  outliers: "Outliers",
  type_consistency: "Type consistency",
  unique_ratios: "Uniqueness",
};

export function dimensionLabel(key: string): string {
  return DIMENSION_LABELS[key] ?? key.replace(/_/g, " ");
}

export interface CorrelationPair {
  col1: string;
  col2: string;
  r: number;
}

/** Ranks all numeric-column pairs by |r|, strongest first. */
export function rankCorrelations(matrix: CorrelationMatrix, minAbs = 0): CorrelationPair[] {
  const pairs: CorrelationPair[] = [];
  const { columns, matrix: values } = matrix;
  for (let i = 0; i < columns.length; i++) {
    for (let j = i + 1; j < columns.length; j++) {
      const r = values[i]?.[j];
      if (typeof r === "number" && !Number.isNaN(r) && Math.abs(r) >= minAbs) {
        pairs.push({ col1: columns[i], col2: columns[j], r });
      }
    }
  }
  return pairs.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
}

/** "Revenue and active users move together strongly." */
export function describeCorrelation(pair: CorrelationPair): string {
  const abs = Math.abs(pair.r);
  const strength = abs >= 0.8 ? "very strongly" : abs >= 0.6 ? "strongly" : abs >= 0.4 ? "moderately" : "weakly";
  const direction = pair.r >= 0 ? "move together" : "move in opposite directions";
  return `${pair.col1} and ${pair.col2} ${direction} ${strength}.`;
}

export type OutlierSeverity = "none" | "low" | "moderate" | "high";

export function outlierSeverity(pct: number): OutlierSeverity {
  if (pct === 0) return "none";
  if (pct < 2) return "low";
  if (pct < 5) return "moderate";
  return "high";
}

export function outlierSeverityLabel(severity: OutlierSeverity): string {
  switch (severity) {
    case "none":
      return "All values look typical";
    case "low":
      return "A few unusual values";
    case "moderate":
      return "Some unusual values";
    case "high":
      return "Many unusual values";
  }
}

export function totalOutliers(outliers: OutlierInfo[]): number {
  return outliers.reduce((sum, o) => sum + o.outlier_count, 0);
}

export function columnsWithOutliers(outliers: OutlierInfo[]): number {
  return outliers.filter((o) => o.outlier_count > 0).length;
}

/** Maps backend job stage identifiers to the exact staged-progress copy the
 * brief calls for (queued -> parsing -> analyzing -> writing summary). */
const STAGE_LABELS: Record<string, string> = {
  queued: "Queued",
  parsing: "Reading your file",
  analysis: "Analyzing your data",
  analyzing: "Analyzing your data",
  narrative: "Writing your summary",
  complete: "Done",
};

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? "Working on it";
}

export function qualityScoreSummary(qs: QualityScore | undefined): { score: number; grade: string; verdict: string } {
  if (!qs) return { score: 0, grade: "—", verdict: "Quality score is not available for this analysis." };
  return { score: qs.overall_score, grade: qs.grade, verdict: gradeVerdict(qs.grade) };
}
