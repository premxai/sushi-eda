"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart2,
  CheckCircle2,
  FlaskConical,
  GitCompareArrows,
  Loader2,
  Sigma,
  TrendingUp,
  XCircle,
} from "lucide-react";
import {
  fetchAdvancedStats,
  runABTestSignificance,
  runANOVA,
  runArimaForecast,
  runChiSquare,
  runCohortAnalysis,
  runCorrelation,
  runLogisticRegression,
  runMannWhitney,
  runPolynomialRegression,
  runRegression,
  runTTest,
  runTimeSeriesDecomposition,
} from "@/lib/api";
import { EDAReport } from "@/lib/types";

interface Props {
  report: EDAReport;
  datasetId?: string | null;
  orgId?: string;
}

type TestType =
  | "ttest"
  | "mann_whitney"
  | "chi_square"
  | "anova"
  | "correlation"
  | "linear_regression"
  | "logistic_regression"
  | "polynomial_regression"
  | "decomposition"
  | "arima"
  | "cohort"
  | "ab_test";

function pLabel(p?: number): string {
  if (p === undefined || Number.isNaN(p)) return "N/A";
  if (p < 0.001) return "< 0.001";
  return p.toFixed(4);
}

function ResultBadge({ significant }: { significant: boolean | null }) {
  if (significant === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
        No significance flag
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
        significant
          ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border border-zinc-300 bg-zinc-100 text-zinc-600"
      }`}
    >
      {significant ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {significant ? "Significant" : "Not significant"}
    </span>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ResultCard({ result }: { result: Record<string, any> }) {
  if (result.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {result.error}
      </div>
    );
  }

  const significant =
    typeof result.significant === "boolean"
      ? result.significant
      : typeof result.p_value === "number"
        ? result.p_value < 0.05
        : null;

  const metricPairs: Array<{ label: string; value: string }> = [];
  const maybePush = (label: string, value: unknown, formatter?: (v: unknown) => string) => {
    if (value === undefined || value === null) return;
    metricPairs.push({ label, value: formatter ? formatter(value) : String(value) });
  };

  maybePush("Test", result.test ?? result.model_type);
  maybePush("p-value", result.p_value, (v) => pLabel(Number(v)));
  maybePush("N", result.n ?? result.n_samples, (v) => Number(v).toLocaleString());
  maybePush("R-squared", result.r_squared, (v) => Number(v).toFixed(4));
  maybePush("RMSE", result.rmse, (v) => Number(v).toFixed(4));
  maybePush("AUC", result.roc_auc, (v) => Number(v).toFixed(4));
  maybePush("F1", result.f1_score, (v) => Number(v).toFixed(4));
  maybePush("AIC", result.aic, (v) => Number(v).toFixed(2));
  maybePush("BIC", result.bic, (v) => Number(v).toFixed(2));
  maybePush("Lift %", result.lift_relative_percent, (v) => `${Number(v).toFixed(2)}%`);
  maybePush("Winner", result.winner);
  maybePush("Frequency", result.frequency);
  maybePush("Model", result.model_type);

  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-zinc-900">{result.test ?? "Result"}</p>
        <ResultBadge significant={significant} />
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {metricPairs.map((m) => (
          <div key={m.label} className="rounded-lg border border-zinc-200 bg-zinc-50 p-2">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500">{m.label}</p>
            <p className="text-sm font-semibold text-zinc-800">{m.value}</p>
          </div>
        ))}
      </div>

      {Array.isArray(result.coefficient_table) && result.coefficient_table.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-600">Coefficient Table</p>
          <div className="overflow-x-auto rounded-lg border border-zinc-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-100 text-zinc-600">
                <tr>
                  <th className="px-2 py-1">Term</th>
                  <th className="px-2 py-1">Coefficient</th>
                  <th className="px-2 py-1">Odds Ratio</th>
                </tr>
              </thead>
              <tbody>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {result.coefficient_table.map((row: Record<string, any>, idx: number) => (
                  <tr key={`${row.term ?? "term"}-${idx}`} className="border-t border-zinc-200">
                    <td className="px-2 py-1">{row.term ?? "-"}</td>
                    <td className="px-2 py-1">{typeof row.coefficient === "number" ? row.coefficient.toFixed(6) : "-"}</td>
                    <td className="px-2 py-1">{typeof row.odds_ratio === "number" ? row.odds_ratio.toFixed(6) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {Array.isArray(result.forecast) && result.forecast.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-600">Forecast Preview</p>
          <div className="overflow-x-auto rounded-lg border border-zinc-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-100 text-zinc-600">
                <tr>
                  <th className="px-2 py-1">Date</th>
                  <th className="px-2 py-1">Forecast</th>
                  <th className="px-2 py-1">Lower</th>
                  <th className="px-2 py-1">Upper</th>
                </tr>
              </thead>
              <tbody>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {result.forecast.slice(0, 8).map((row: Record<string, any>, idx: number) => (
                  <tr key={`${row.date ?? idx}`} className="border-t border-zinc-200">
                    <td className="px-2 py-1">{row.date ?? "-"}</td>
                    <td className="px-2 py-1">{typeof row.forecast === "number" ? row.forecast.toFixed(4) : "-"}</td>
                    <td className="px-2 py-1">{typeof row.lower_ci === "number" ? row.lower_ci.toFixed(4) : "-"}</td>
                    <td className="px-2 py-1">{typeof row.upper_ci === "number" ? row.upper_ci.toFixed(4) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {Array.isArray(result.cohorts) && result.cohorts.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs text-zinc-700">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {result.cohorts.slice(0, 4).map((cohort: Record<string, any>, idx: number) => (
            <p key={`${cohort.cohort ?? idx}-summary`}>
              Cohort {cohort.cohort}: size {cohort.cohort_size}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

const TEST_DEFS: Array<{ type: TestType; label: string; icon: React.ElementType; desc: string }> = [
  { type: "ttest", label: "T-Test", icon: FlaskConical, desc: "Compare means across two numeric samples" },
  { type: "mann_whitney", label: "Mann-Whitney", icon: Sigma, desc: "Non-parametric test for two numeric samples" },
  { type: "chi_square", label: "Chi-Square", icon: GitCompareArrows, desc: "Independence test for categorical variables" },
  { type: "anova", label: "ANOVA", icon: BarChart2, desc: "Mean differences across multiple groups" },
  { type: "correlation", label: "Correlation", icon: Activity, desc: "Pearson, Spearman, or Kendall association" },
  { type: "linear_regression", label: "Linear Reg", icon: TrendingUp, desc: "Linear regression with coefficient table" },
  { type: "logistic_regression", label: "Logistic Reg", icon: TrendingUp, desc: "Binary logistic regression with metrics" },
  { type: "polynomial_regression", label: "Polynomial Reg", icon: TrendingUp, desc: "Polynomial regression (degree 2-6)" },
  { type: "decomposition", label: "Decompose", icon: BarChart2, desc: "Trend + seasonality decomposition" },
  { type: "arima", label: "ARIMA", icon: Activity, desc: "ARIMA forecasting with confidence intervals" },
  { type: "cohort", label: "Cohort", icon: GitCompareArrows, desc: "Retention matrix by first-seen cohort" },
  { type: "ab_test", label: "A/B Test", icon: FlaskConical, desc: "Two-proportion significance calculator" },
];

export function StatisticsSection({ report, datasetId, orgId = "default" }: Props) {
  const numericCols = report.column_analysis.filter((c) => c.is_numeric).map((c) => c.name);
  const nonNumericCols = report.column_analysis.filter((c) => !c.is_numeric).map((c) => c.name);
  const allCols = report.column_analysis.map((c) => c.name);

  const binaryCols = useMemo(() => {
    return allCols.filter((name) => {
      const values = new Set<string>();
      for (const row of report.preview) {
        const val = row[name];
        if (val === null || val === undefined || String(val).trim() === "") continue;
        values.add(String(val));
        if (values.size > 2) return false;
      }
      return values.size === 2;
    });
  }, [allCols, report.preview]);

  const [activeTest, setActiveTest] = useState<TestType>("ttest");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [autoStats, setAutoStats] = useState<Record<string, any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<Record<string, any> | null>(null);
  const [autoLoading, setAutoLoading] = useState(false);
  const [running, setRunning] = useState(false);

  const [col1, setCol1] = useState(numericCols[0] ?? "");
  const [col2, setCol2] = useState(numericCols[1] ?? numericCols[0] ?? "");
  const [catCol1, setCatCol1] = useState(nonNumericCols[0] ?? allCols[0] ?? "");
  const [catCol2, setCatCol2] = useState(nonNumericCols[1] ?? nonNumericCols[0] ?? allCols[0] ?? "");
  const [groupCol, setGroupCol] = useState(nonNumericCols[0] ?? allCols[0] ?? "");
  const [corrMethod, setCorrMethod] = useState<"pearson" | "spearman" | "kendall">("pearson");
  const [mwAlternative, setMwAlternative] = useState<"two-sided" | "less" | "greater">("two-sided");
  const [polyDegree, setPolyDegree] = useState(2);

  const [tsDateCol, setTsDateCol] = useState(allCols[0] ?? "");
  const [tsValueCol, setTsValueCol] = useState(numericCols[0] ?? "");
  const [tsPeriod, setTsPeriod] = useState("");
  const [tsModel, setTsModel] = useState<"additive" | "multiplicative">("additive");

  const [arimaPeriods, setArimaPeriods] = useState(12);
  const [arimaP, setArimaP] = useState(1);
  const [arimaD, setArimaD] = useState(1);
  const [arimaQ, setArimaQ] = useState(1);
  const [arimaAlpha, setArimaAlpha] = useState(0.05);

  const [cohortEntityCol, setCohortEntityCol] = useState(allCols[0] ?? "");
  const [cohortDateCol, setCohortDateCol] = useState(allCols[0] ?? "");
  const [cohortFreq, setCohortFreq] = useState<"D" | "W" | "M" | "Q">("M");

  const [logisticTarget, setLogisticTarget] = useState(binaryCols[0] ?? nonNumericCols[0] ?? allCols[0] ?? "");
  const [positiveClass, setPositiveClass] = useState("");

  const [controlConversions, setControlConversions] = useState(100);
  const [controlTotal, setControlTotal] = useState(1000);
  const [variantConversions, setVariantConversions] = useState(120);
  const [variantTotal, setVariantTotal] = useState(1000);

  const logisticClasses = useMemo(() => {
    if (!logisticTarget) return [];
    const values = new Set<string>();
    for (const row of report.preview) {
      const value = row[logisticTarget];
      if (value === null || value === undefined || String(value).trim() === "") continue;
      values.add(String(value));
      if (values.size > 10) break;
    }
    return Array.from(values);
  }, [logisticTarget, report.preview]);

  useEffect(() => {
    if (!positiveClass && logisticClasses.length > 0) {
      setPositiveClass(logisticClasses[logisticClasses.length - 1]);
    }
  }, [logisticClasses, positiveClass]);

  useEffect(() => {
    if (!datasetId) return;
    setAutoLoading(true);
    fetchAdvancedStats(datasetId, orgId)
      .then(setAutoStats)
      .catch(() => setAutoStats(null))
      .finally(() => setAutoLoading(false));
  }, [datasetId, orgId]);

  async function handleRun() {
    if (!datasetId) return;
    setRunning(true);
    setResult(null);

    try {
      let res;
      if (activeTest === "ttest") {
        res = await runTTest(datasetId, col1, col2, orgId);
      } else if (activeTest === "mann_whitney") {
        res = await runMannWhitney(datasetId, col1, col2, mwAlternative, orgId);
      } else if (activeTest === "chi_square") {
        res = await runChiSquare(datasetId, catCol1, catCol2, orgId);
      } else if (activeTest === "anova") {
        res = await runANOVA(datasetId, col1, groupCol, orgId);
      } else if (activeTest === "correlation") {
        res = await runCorrelation(datasetId, col1, col2, corrMethod, orgId);
      } else if (activeTest === "linear_regression") {
        res = await runRegression(datasetId, col1, col2, orgId);
      } else if (activeTest === "logistic_regression") {
        res = await runLogisticRegression(datasetId, col1, logisticTarget, positiveClass || undefined, orgId);
      } else if (activeTest === "polynomial_regression") {
        res = await runPolynomialRegression(datasetId, col1, col2, polyDegree, orgId);
      } else if (activeTest === "decomposition") {
        res = await runTimeSeriesDecomposition(
          datasetId,
          tsDateCol,
          tsValueCol,
          tsPeriod ? Number(tsPeriod) : undefined,
          tsModel,
          orgId
        );
      } else if (activeTest === "arima") {
        res = await runArimaForecast(
          datasetId,
          tsDateCol,
          tsValueCol,
          { periods: arimaPeriods, p: arimaP, d: arimaD, q: arimaQ, alpha: arimaAlpha },
          orgId
        );
      } else if (activeTest === "cohort") {
        res = await runCohortAnalysis(datasetId, cohortEntityCol, cohortDateCol, cohortFreq, orgId);
      } else {
        res = await runABTestSignificance(
          datasetId,
          controlConversions,
          controlTotal,
          variantConversions,
          variantTotal,
          0.05,
          orgId
        );
      }
      setResult(res ?? null);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string };
      setResult({ error: e.response?.data?.detail ?? e.message ?? "Test failed" });
    } finally {
      setRunning(false);
    }
  }

  const selectClass =
    "min-w-[180px] rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800 focus:border-zinc-500 focus:outline-none";
  const inputClass =
    "w-[130px] rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800 focus:border-zinc-500 focus:outline-none";

  const isLocal = datasetId === "local";
  const noDataset = !datasetId;
  const availableCategoryLikeCols = [...nonNumericCols, ...numericCols];

  const runBlocker = useMemo(() => {
    if (noDataset) return "Upload a dataset to run statistical tests.";

    if (
      activeTest === "ttest" ||
      activeTest === "mann_whitney" ||
      activeTest === "correlation" ||
      activeTest === "linear_regression" ||
      activeTest === "polynomial_regression"
    ) {
      if (numericCols.length < 2) {
        return "This test needs at least two numeric columns.";
      }
      if (!col1 || !col2) {
        return "Select two numeric columns.";
      }
      if (col1 === col2) {
        return "Choose two different numeric columns.";
      }
      return null;
    }

    if (activeTest === "chi_square") {
      if (availableCategoryLikeCols.length < 2) {
        return "This test needs two columns with categorical-like values.";
      }
      if (!catCol1 || !catCol2) {
        return "Select two columns to compare.";
      }
      if (catCol1 === catCol2) {
        return "Choose two different columns.";
      }
      return null;
    }

    if (activeTest === "anova") {
      if (numericCols.length < 1 || allCols.length < 2) {
        return "ANOVA needs one numeric column and one grouping column.";
      }
      if (!col1 || !groupCol) {
        return "Select a numeric column and a grouping column.";
      }
      if (col1 === groupCol) {
        return "Grouping column must be different from the numeric column.";
      }
      return null;
    }

    if (activeTest === "logistic_regression") {
      if (numericCols.length < 1) {
        return "Logistic regression needs a numeric predictor column.";
      }
      if (!logisticTarget) {
        return "Select a binary target column.";
      }
      if (logisticClasses.length !== 2) {
        return "Target column must have exactly two classes in the loaded dataset.";
      }
      return null;
    }

    if (activeTest === "decomposition" || activeTest === "arima") {
      if (numericCols.length < 1 || allCols.length < 2) {
        return "Time-series analysis needs one date-like column and one numeric column.";
      }
      if (!tsDateCol || !tsValueCol) {
        return "Select a date column and a numeric value column.";
      }
      if (tsDateCol === tsValueCol) {
        return "Date and value columns must be different.";
      }
      return null;
    }

    if (activeTest === "cohort") {
      if (allCols.length < 2) {
        return "Cohort analysis needs an entity column and a date column.";
      }
      if (!cohortEntityCol || !cohortDateCol) {
        return "Select an entity column and a date column.";
      }
      if (cohortEntityCol === cohortDateCol) {
        return "Entity and date columns must be different.";
      }
      return null;
    }

    if (activeTest === "ab_test") {
      if (controlTotal < 1 || variantTotal < 1) {
        return "Control and variant totals must be at least 1.";
      }
      if (controlConversions > controlTotal || variantConversions > variantTotal) {
        return "Conversions cannot exceed totals.";
      }
      return null;
    }

    return null;
  }, [
    activeTest,
    allCols.length,
    availableCategoryLikeCols.length,
    catCol1,
    catCol2,
    cohortDateCol,
    cohortEntityCol,
    col1,
    col2,
    controlConversions,
    controlTotal,
    groupCol,
    logisticClasses.length,
    logisticTarget,
    noDataset,
    numericCols.length,
    tsDateCol,
    tsValueCol,
    variantConversions,
    variantTotal,
  ]);
  const canRun = !running && !runBlocker;

  return (
    <div className="space-y-4">
      {noDataset && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠️ Upload a dataset to run statistical tests.
        </div>
      )}
      {isLocal && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          ℹ️ Tests run against your in-session upload. Results will be lost on page refresh. Use async upload (backend configured) for persistent datasets.
        </div>
      )}
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-600">Auto Analysis</p>
        {autoLoading ? (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Running normality and correlation tests...
          </div>
        ) : !autoStats ? (
          <p className="text-sm text-zinc-500">
            {isLocal ? "Auto stats unavailable — select a test below and click Run." : "Could not load auto stats."}
          </p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs uppercase tracking-wider text-zinc-600">Normality tests</p>
              <p className="mt-1 text-sm text-zinc-800">
                {Array.isArray(autoStats.normality_tests) ? autoStats.normality_tests.length : 0} columns tested
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs uppercase tracking-wider text-zinc-600">Correlation significance</p>
              <p className="mt-1 text-sm text-zinc-800">
                {Array.isArray(autoStats.correlations_with_significance)
                  ? autoStats.correlations_with_significance.length
                  : 0}{" "}
                pairs tested
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-600">Statistical Analysis Suite</p>

        <div className="mb-3 flex flex-wrap gap-2">
          {TEST_DEFS.map(({ type, label, icon: Icon }) => {
            const active = activeTest === type;
            return (
              <button
                key={type}
                onClick={() => {
                  setActiveTest(type);
                  setResult(null);
                }}
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition ${
                  active
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
                }`}
                type="button"
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            );
          })}
        </div>

        <p className="mb-3 text-sm text-zinc-500">{TEST_DEFS.find((t) => t.type === activeTest)?.desc}</p>

        <div className="mb-3 flex flex-wrap items-end gap-2">
          {(activeTest === "ttest" || activeTest === "mann_whitney" || activeTest === "correlation" || activeTest === "linear_regression" || activeTest === "polynomial_regression" || activeTest === "logistic_regression") && (
            <>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Numeric column 1</label>
                <select className={selectClass} value={col1} onChange={(e) => setCol1(e.target.value)}>
                  {numericCols.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {(activeTest === "ttest" || activeTest === "mann_whitney" || activeTest === "correlation" || activeTest === "linear_regression" || activeTest === "polynomial_regression") && (
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Numeric column 2</label>
              <select className={selectClass} value={col2} onChange={(e) => setCol2(e.target.value)}>
                {numericCols.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeTest === "mann_whitney" && (
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Alternative</label>
              <select className={selectClass} value={mwAlternative} onChange={(e) => setMwAlternative(e.target.value as "two-sided" | "less" | "greater")}>
                <option value="two-sided">Two-sided</option>
                <option value="less">Less</option>
                <option value="greater">Greater</option>
              </select>
            </div>
          )}

          {activeTest === "correlation" && (
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Method</label>
              <select className={selectClass} value={corrMethod} onChange={(e) => setCorrMethod(e.target.value as "pearson" | "spearman" | "kendall")}>
                <option value="pearson">Pearson</option>
                <option value="spearman">Spearman</option>
                <option value="kendall">Kendall</option>
              </select>
            </div>
          )}

          {activeTest === "chi_square" && (
            <>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Categorical column 1</label>
                <select className={selectClass} value={catCol1} onChange={(e) => setCatCol1(e.target.value)}>
                  {[...nonNumericCols, ...numericCols].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Categorical column 2</label>
                <select className={selectClass} value={catCol2} onChange={(e) => setCatCol2(e.target.value)}>
                  {[...nonNumericCols, ...numericCols].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {activeTest === "anova" && (
            <>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Numeric column</label>
                <select className={selectClass} value={col1} onChange={(e) => setCol1(e.target.value)}>
                  {numericCols.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Group column</label>
                <select className={selectClass} value={groupCol} onChange={(e) => setGroupCol(e.target.value)}>
                  {allCols.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {activeTest === "logistic_regression" && (
            <>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Target column (binary)</label>
                <select className={selectClass} value={logisticTarget} onChange={(e) => setLogisticTarget(e.target.value)}>
                  {[...binaryCols, ...nonNumericCols, ...numericCols].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Positive class (optional)</label>
                <select className={selectClass} value={positiveClass} onChange={(e) => setPositiveClass(e.target.value)}>
                  <option value="">Auto</option>
                  {logisticClasses.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {activeTest === "polynomial_regression" && (
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Degree</label>
              <input
                className={inputClass}
                type="number"
                min={2}
                max={6}
                value={polyDegree}
                onChange={(e) => setPolyDegree(Number(e.target.value || 2))}
              />
            </div>
          )}

          {(activeTest === "decomposition" || activeTest === "arima") && (
            <>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Date column</label>
                <select className={selectClass} value={tsDateCol} onChange={(e) => setTsDateCol(e.target.value)}>
                  {allCols.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Value column</label>
                <select className={selectClass} value={tsValueCol} onChange={(e) => setTsValueCol(e.target.value)}>
                  {numericCols.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {activeTest === "decomposition" && (
            <>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Period (optional)</label>
                <input className={inputClass} value={tsPeriod} onChange={(e) => setTsPeriod(e.target.value)} placeholder="e.g. 12" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Model</label>
                <select className={selectClass} value={tsModel} onChange={(e) => setTsModel(e.target.value as "additive" | "multiplicative")}>
                  <option value="additive">Additive</option>
                  <option value="multiplicative">Multiplicative</option>
                </select>
              </div>
            </>
          )}

          {activeTest === "arima" && (
            <>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Periods</label>
                <input className={inputClass} type="number" min={1} value={arimaPeriods} onChange={(e) => setArimaPeriods(Number(e.target.value || 1))} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">p</label>
                <input className={inputClass} type="number" min={0} value={arimaP} onChange={(e) => setArimaP(Number(e.target.value || 0))} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">d</label>
                <input className={inputClass} type="number" min={0} value={arimaD} onChange={(e) => setArimaD(Number(e.target.value || 0))} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">q</label>
                <input className={inputClass} type="number" min={0} value={arimaQ} onChange={(e) => setArimaQ(Number(e.target.value || 0))} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Alpha</label>
                <input
                  className={inputClass}
                  type="number"
                  min={0.001}
                  max={0.99}
                  step={0.01}
                  value={arimaAlpha}
                  onChange={(e) => setArimaAlpha(Number(e.target.value || 0.05))}
                />
              </div>
            </>
          )}

          {activeTest === "cohort" && (
            <>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Entity/User column</label>
                <select className={selectClass} value={cohortEntityCol} onChange={(e) => setCohortEntityCol(e.target.value)}>
                  {allCols.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Date column</label>
                <select className={selectClass} value={cohortDateCol} onChange={(e) => setCohortDateCol(e.target.value)}>
                  {allCols.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Frequency</label>
                <select className={selectClass} value={cohortFreq} onChange={(e) => setCohortFreq(e.target.value as "D" | "W" | "M" | "Q")}>
                  <option value="D">Daily</option>
                  <option value="W">Weekly</option>
                  <option value="M">Monthly</option>
                  <option value="Q">Quarterly</option>
                </select>
              </div>
            </>
          )}

          {activeTest === "ab_test" && (
            <>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Control conversions</label>
                <input className={inputClass} type="number" min={0} value={controlConversions} onChange={(e) => setControlConversions(Number(e.target.value || 0))} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Control total</label>
                <input className={inputClass} type="number" min={1} value={controlTotal} onChange={(e) => setControlTotal(Number(e.target.value || 1))} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Variant conversions</label>
                <input className={inputClass} type="number" min={0} value={variantConversions} onChange={(e) => setVariantConversions(Number(e.target.value || 0))} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Variant total</label>
                <input className={inputClass} type="number" min={1} value={variantTotal} onChange={(e) => setVariantTotal(Number(e.target.value || 1))} />
              </div>
            </>
          )}

          <button
            type="button"
            onClick={handleRun}
            disabled={!canRun}
            className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />} Run
          </button>
        </div>

        {runBlocker && (
          <p className="mb-3 text-sm text-amber-700">
            {runBlocker}
          </p>
        )}

        {result && <ResultCard result={result} />}
      </div>
    </div>
  );
}
