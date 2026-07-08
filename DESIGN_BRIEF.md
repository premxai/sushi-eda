# Sushi — Design & UX Brief

Everything a designer (or design-minded dev) needs to plan the Sushi frontend from scratch, with zero guessing. The backend is built, tested, and stable — this brief exists so design work is grounded in what's actually real, not assumptions.

## 1. What Sushi is

**One-line pitch:** Drop in a data file → get a trustworthy, plain-English report you can share with your team — no code, no analyst required.

**Target user:** Product managers and non-technical operators who receive data exports (survey results, product-usage dumps, A/B test results, support-ticket exports, sales reports) and today either bug an analyst or fight Excel.

**The problem it solves:** "I have a CSV and no analyst. I need a report I can trust and show my team in the next 10 minutes."

**What makes it different from just opening Excel or asking an analyst:**
- A 0–100 **quality score** up front — the user knows whether to trust the numbers *before* they present them, not after.
- An **AI-written plain-English summary** (not a wall of charts) — what the data says, what to watch out for, what to ask next.
- **"Ask your data" chat** — natural language in, an answer out, with the exact query behind it shown for trust (not a black box).
- **One-click share** (public link) and **PDF export** so a non-technical teammate can consume the result without touching the tool.

## 2. Voice and tone (match this exactly in all UI copy)

Plain English, never statistical jargon in primary copy (jargon can exist behind a tooltip/disclosure, never as the first thing a user reads). Conversational but professional, confident without hype, always explains *why* the user should trust something rather than just asserting it.

Real examples already in use — match this register:
- *"This data looks clean and trustworthy — you can present numbers from it with confidence."* (quality grade A)
- *"Broadly trustworthy — skim the notes below before presenting exact totals."* (grade B)
- *"Treat conclusions from this data as rough estimates until the issues below are fixed."* (grade D/F)
- *"Every report opens with a 0 to 100 quality grade and a plain verdict, so you know whether to trust the numbers before you present them."*
- *"Not a wall of charts, just a short executive summary of what the data says, what changed, and what to watch out for."*
- *"Your file is deleted after 7 days."* (privacy — stated plainly, not buried in legalese)

Contractions are fine ("you're," "don't," "it's"). Never talk down to the user; they're a competent professional who just doesn't have a data background.

## 3. Explicit scope for this design pass

**In scope — design these, they are real and working today:**
- Landing/upload page
- The main analysis dashboard (all sections — see §5)
- Compare two datasets
- Dataset library ("My Datasets" — list/star/archive/rename)
- Public share page (read-only, no login)
- Docs, changelog, privacy pages
- Example/sample datasets gallery

**Out of scope — do not design these yet:**
- Sign-up / login / any auth flow. Auth is built into the backend but disabled (demo mode) until a later phase not yet scheduled. Designing this now risks wasted work if the account/pricing model changes.
- Any pricing, billing, or paywall screen — none exists, none is planned yet.
- Multi-user / team collaboration, comments, connectors, integrations, Slack bot, monitors/alerts, pipelines — all removed from the product, not coming back for the foreseeable future.

**Device scope:** Desktop-first, responsive down to tablet width. Mobile phone layouts are explicitly NOT required for this pass — this is a "sit down and analyze a file" tool, not a mobile-checking-on-the-go tool. Don't spend design budget on phone breakpoints.

## 4. Every screen that needs a design

| Screen | Route | Purpose |
|---|---|---|
| Landing / upload hub | `/` | Marketing hero + drag-and-drop file upload + "try a sample" — the only entry point. Same page also hosts the full report dashboard once a file is analyzed (state transition, not a separate route). |
| Report dashboard | `/` (post-upload state) | The core product — see §5 for its 11 sections |
| Compare | `/compare` | Upload two files, see schema differences, row/column count deltas, and two reports side by side |
| Dataset library | `/datasets` | List of previously-uploaded datasets: star, rename, archive/restore, reopen |
| Public share view | `/share/[token]` | Read-only version of a report, no login required — this is what people forward to teammates. Must stand alone and build trust without any other context. |
| Docs | `/docs` | Self-serve help: quick start, supported formats, how scoring works, SQL editor guide, AI features, sharing |
| Changelog | `/changelog` | Release notes list |
| Privacy | `/privacy` | Plain-English data handling policy (retention, no AI training on user data, etc.) |
| Examples gallery | `/examples` | Pre-analyzed sample datasets a visitor can open with one click, no upload needed |

## 5. The report dashboard in detail (the heart of the product)

Once a file finishes analyzing, the user lands in a dashboard with persistent navigation between these sections. This is where most user time is spent — give it the most design attention.

1. **AI Summary (the hero)** — Claude-written narrative: what this data is, 3–5 key findings, what to watch out for, suggested follow-up questions. This should be the FIRST thing a user reads after upload — it is the single most differentiating feature of the product and today's build under-emphasizes it; make it unmissable.
2. **Overview** — the 0–100 quality score + letter grade (A–F) with a plain-English verdict sentence, plus row/column counts, missing-value %, duplicate %, and a breakdown across 5 quality dimensions (missing data, duplicates, outliers, type consistency, uniqueness — weighted 30/20/20/15/15).
3. **Ask Your Data (chat)** — natural-language Q&A. User asks a question in plain English; gets an answer in plain English; the SQL query that produced it is available behind a "how was this computed?" disclosure (never shown by default — trust through transparency, not through jargon).
4. **Field Health (columns)** — one expandable card per column: data type, missing %, unique count, and either numeric stats (mean/median/std/min/max/quartiles) or top-10 values for categorical columns, plus an inline distribution chart.
5. **Compare & Validate (statistics)** — a guided picker for 11 statistical tests (t-test, Mann-Whitney U, chi-square, ANOVA, correlation, linear/logistic/polynomial regression, time-series decomposition, ARIMA forecast, cohort retention, A/B test significance). Needs a "guided" mode (pick two columns, get a plain result) and an "advanced" mode (full parameter control) — see §7 for what each test needs/returns.
6. **What Moves Together (correlations)** — a correlation heatmap across all numeric columns plus a ranked list of the strongest relationships in plain language ("X and Y move together strongly").
7. **Unusual Values (outliers)** — per-column outlier counts/percentages with severity indicators, plus a box-plot visualization showing where the unusual values sit relative to the typical range.
8. **Charts & Trends (visualizations)** — a chart builder: distribution histograms, box/violin plots, categorical bars, time-series trend lines, Pareto/80-20 charts, top-N rankings, waterfall/contribution charts, a full correlation heatmap, a missing-data matrix, a pairwise scatter matrix, and a 5-dimension quality radar. 13 chart types total; see §8.
9. **AI Notes (insights)** — automatically generated observations (high-missing columns, skewed distributions, constant columns, dataset size warnings) — a lighter-weight, rule-based companion to the AI Summary; this is what degrades gracefully if the AI budget for the day is exhausted (see §9).
10. **Advanced Queries (SQL editor)** — a real SQL editor (the dataset is queryable as a table named `df`) with schema browser, query history, EXPLAIN plan viewer, and paginated results. This is a power-user / technical-user surface — fine for it to look more "developer tool" than the rest of the plain-English product, similar to how GitHub's code view differs from its marketing pages.
11. **Reports** — a printable/exportable summary combining the quality score, key findings, top correlations, flagged outliers, and an editable analyst-notes field. Exports to PDF, Markdown, JSON, and Excel.

## 6. Data actually available to design around

Every analysis produces a report with these fields — design around exactly this, not more:

- **basic_info**: row count, column count, memory size, duplicate row count, total missing-cell count, list of column names, count of each data type present
- **column_analysis** (per column): name, data type, missing count/%, unique count, is-numeric flag, then EITHER numeric stats (mean, median, std dev, min, max, Q1, Q3, skewness) OR top-10 most frequent values with counts (for categorical/text columns)
- **quality_score**: overall 0–100 score, letter grade A–F, a breakdown across 5 weighted dimensions each with their own 0–100 sub-score and a plain-English detail string, plus 1–5 actionable recommendations
- **correlation_matrix**: full N×N correlation matrix across all numeric columns
- **outliers** (per numeric column): count, percentage, IQR bounds (lower/upper), Q1/Q3
- **type_suggestions**: for columns whose detected type might be wrong (e.g. a date stored as text), the suggested correct type with a confidence score and reason
- **50-row live preview** embedded in every report; up to 20,000 full rows fetchable on demand for custom client-side charting
- **AI narrative**: markdown text (see §5.1) — present only if generated successfully; must have a good "no narrative available" fallback state (e.g. AI budget exhausted, or no API key configured in a given deployment)

There is no user-account data, no historical trend across multiple analyses of different datasets, no team/collaboration data — design for a single dataset's single (or versioned) analysis at a time.

## 7. The 11 statistical tests (for the "Compare & Validate" section)

Each test needs a small, specific input (usually 1–2 column names, sometimes a numeric parameter) and returns a small, specific result. Design a consistent "pick a test → configure minimal inputs → see plain-English result + optional detail view" pattern rather than 11 bespoke screens.

| Test | Needs from user | Core result |
|---|---|---|
| T-test | 2 numeric columns | statistic, p-value, significant?, means/std/n for each |
| Mann-Whitney U | 2 numeric columns | u-statistic, p-value, significant?, medians |
| Chi-square | 2 categorical columns | chi² statistic, p-value, contingency table |
| ANOVA | 1 numeric + 1 grouping column | F-statistic, p-value, group names |
| Correlation | 2 numeric columns + method (Pearson/Spearman/Kendall) | coefficient, p-value, significant? |
| Linear regression | 2 numeric columns | slope, intercept, R², RMSE, equation |
| Logistic regression | 1 numeric + 1 binary column | accuracy, precision, recall, F1, ROC-AUC, odds ratios |
| Polynomial regression | 2 numeric columns + degree (2–6) | R², RMSE, coefficients |
| Time-series decomposition | date column + value column | trend/seasonal/residual series, chartable |
| ARIMA forecast | date + value column + forecast horizon | forecast values with confidence intervals, chartable |
| Cohort analysis | entity column + date column + period (day/week/month/quarter) | retention-rate grid by cohort × period |
| A/B test significance | conversions + totals for control and variant | lift %, p-value, significant?, winner |

All of these are plain HTTP calls returning JSON — no test takes more than ~1 second to compute for typical dataset sizes.

## 8. The 13 chart types available

Single-column: histogram/distribution, box plot, violin plot, categorical bar (top values).
Two-column/aggregation: Pareto (80/20), top-N ranking, waterfall/contribution bridge, time-series trend line (auto day/week/month/year granularity).
Multi-column: correlation heatmap, missing-data matrix, pairwise scatter matrix.
Composite: 5-dimension quality-score radar.

All charts are served as ready-to-render chart specs (currently Plotly JSON) from the backend — the frontend does not need to compute chart geometry itself, only render and style what's returned. If the new frontend uses a different charting library, the backend chart-generation code can be swapped without touching the rest of the API (flag this to your dev team as a possible follow-on task, not something the designer needs to solve).

## 9. AI features — what's automatic vs. on-demand, and how they degrade

- **AI narrative** generates automatically once per analysis (unless the daily AI budget is exhausted, or no AI key is configured in a given environment — plan a real, non-broken-looking empty state for this, e.g. "No AI summary available for this analysis — the data below is still fully available.")
- **AI chat** is on-demand, user-initiated, rate-limited per visitor (20 questions/day) and globally (500/day across all visitors) — plan for a clear, friendly rate-limit message, not a raw error.
- **AI cleaning suggestions** are on-demand — a list of prioritized (high/medium/low) suggested fixes with plain-English descriptions.
- None of these ever block the rest of the report from being usable — quality score, columns, charts, stats, and raw data all work with zero AI dependency.

## 10. Non-functional constraints that shape the design

- **25 MB max upload file size** — surface this clearly at the upload step, not as a surprise error after a long wait.
- **Supported formats**: CSV, TSV, Excel (XLSX), JSON, Parquet, SQLite — show format badges at upload to build confidence before the user even tries.
- **Analysis takes 5–30 seconds** typically — needs a real, informative progress state (not just a spinner); the backend reports discrete stages (queued → parsing → analyzing → writing summary) over a live connection, so the UI can show honest progress rather than a fake bar.
- **7-day data retention** — uploaded files and their reports are automatically deleted after 7 days. This is a trust/privacy feature, not a limitation to hide — say it plainly wherever relevant (upload screen, privacy page, maybe a "expires in N days" indicator in the dataset library).
- **No user accounts today** — anyone can use the tool; "My Datasets" currently just tracks what's been uploaded in this shared/demo environment, not a personal account library. Don't design it as if it were a personal, secured space.
- **Single-process backend** — there is no real-time multiplayer, no live-updating-while-someone-else-edits scenario. Every screen is single-user, single-session in its interaction model.
- **SQL editor is sandboxed**: read-only queries only, 20-second timeout, 10,000-row result cap, no file-system access. Fine to mention in the UI as "safe to experiment" reassurance for less technical users nervous about a SQL box.

## 11. Existing brand assets (available, not mandatory)

An AI-driven visual redesign was done earlier and has been archived to `_archive/frontend-ai-redesign-2026-07-08/` in this repo — the designer has full creative freedom to keep, adapt, or completely discard any of it. Provided for reference only:

- **Fonts already licensed and available in the archive**: Geist (sans, UI text) and Geist Mono (monospace, code/SQL), Instrument Serif (display/editorial headlines).
- **Existing logo mark**: a circular "data nigiri" icon — a dark ring around a light field divided into four colored quadrants plus a small ascending bar-chart glyph. Available in the archived frontend if useful as a starting point; not required to keep.
- **Previous palette** (for reference, not a constraint): a warm off-white base with near-black text, one orange-red brand accent, plus green/red used for positive/negative or good/bad data-quality signals.

The designer should feel free to propose an entirely new visual identity — nothing above is a constraint, only a record of what existed before.

## 12. What we need back from the designer

To evaluate the plan and hand it to development, please include:
1. A site map / information architecture covering every screen in §4.
2. Wireframes (low-fidelity is fine at first) for the report dashboard's 11 sections in §5, plus every other screen.
3. A design system: color palette, typography scale, spacing/grid system, component library basics (buttons, cards, form inputs, badges, tables), covering both a default and (ideally) a dark theme.
4. Explicit empty/loading/error states for at least: file upload in progress, AI summary unavailable, AI chat rate-limited, a dataset with zero outliers/zero correlations/zero AI narrative, and a 25MB-file-rejected error.
5. Responsive behavior specified down to tablet width (per §3 — phone not required).
6. A short rationale document: why key decisions were made (palette, typography, layout patterns) tied back to the target user in §1 and the voice in §2 — so it's a design *plan*, not just a mood board.

## 13. Technical reference (for whoever implements the design)

The full backend API surface (every endpoint, request/response shape, rate limits, error codes) and the exact data model definitions are documented separately and available on request — this brief intentionally keeps to what shapes *design* decisions. The backend is a stable, tested FastAPI service; the frontend can be built in any framework the designer/dev team prefers and will talk to the backend over a normal REST + Server-Sent-Events API.
