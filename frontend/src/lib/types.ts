export interface ColumnStats {
  mean: number;
  median: number;
  std: number;
  min: number;
  max: number;
  q1: number;
  q3: number;
  skewness: number;
}

export interface TopValue {
  value: string;
  count: number;
}

export interface ColumnAnalysis {
  name: string;
  dtype: string;
  missing_count: number;
  missing_percent: number;
  unique_count: number;
  is_numeric: boolean;
  stats?: ColumnStats;
  top_values?: TopValue[];
}

export interface BasicInfo {
  rows: number;
  columns: number;
  memory_usage_bytes: number;
  memory_usage_mb: number;
  duplicate_rows: number;
  total_missing: number;
  column_names: string[];
  dtypes_summary: Record<string, number>;
}

export interface CorrelationMatrix {
  columns: string[];
  matrix: number[][];
}

export interface OutlierInfo {
  column: string;
  outlier_count: number;
  outlier_percent: number;
  lower_bound: number;
  upper_bound: number;
  q1: number;
  q3: number;
  iqr: number;
}

export interface QualityScoreBreakdown {
  score: number;
  weight: number;
  details: string;
}

export interface QualityScore {
  overall_score: number;
  grade: string;
  breakdown: {
    missing_data: QualityScoreBreakdown;
    duplicates: QualityScoreBreakdown;
    outliers: QualityScoreBreakdown;
    type_consistency: QualityScoreBreakdown;
    unique_ratios: QualityScoreBreakdown;
  };
  recommendations: string[];
}

export interface TypeSuggestion {
  column: string;
  current_type: string;
  suggested_type: string;
  reason: string;
  confidence?: number;
  unique_count?: number;
  unique_ratio?: number;
  memory_savings_mb?: number;
  values?: string[];
}

export interface TypeSuggestions {
  datetime_suggestions: TypeSuggestion[];
  categorical_suggestions: TypeSuggestion[];
  numeric_suggestions: TypeSuggestion[];
  boolean_suggestions: TypeSuggestion[];
}

export interface EDAReport {
  basic_info: BasicInfo;
  column_analysis: ColumnAnalysis[];
  correlation_matrix: CorrelationMatrix;
  outliers: OutlierInfo[];
  preview: Record<string, unknown>[];
  quality_score: QualityScore;
  type_suggestions: TypeSuggestions;
}

/** Flattened list of every type suggestion across the 4 categories, for
 * rendering "suggested type" hints on Field Health cards. */
export function flattenTypeSuggestions(s: TypeSuggestions | undefined): TypeSuggestion[] {
  if (!s) return [];
  return [
    ...(s.datetime_suggestions ?? []),
    ...(s.categorical_suggestions ?? []),
    ...(s.numeric_suggestions ?? []),
    ...(s.boolean_suggestions ?? []),
  ];
}
