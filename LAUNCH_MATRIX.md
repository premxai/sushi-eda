# Sushi Launch Matrix

This file tracks what stays visible for the MVP launch and investor demo.

## Demo Datasets

- Primary: `sample_sales.csv`
- Primary backup: a medium-size CSV already known to analyze cleanly
- Backup path: the built-in sample-data flow on the home page

## Feature Decisions

| Feature | Owner | Priority | Decision | Current Goal | Notes |
|---|---|---:|---|---|---|
| Landing + auth | Coordinator / Agent 1 | must | ship | Clean first-time path into upload | Keep messaging aligned with actual product state |
| Upload + async analysis | Agent 1 | must | ship | Stable upload -> ready flow | Core investor demo path |
| Overview / columns / visuals | Agent 1 | must | ship | Render reliably for demo datasets | No raw backend errors in UI |
| Statistics core subset | Agent 1 | must | ship | Correlation, t-test, linear regression, ANOVA, A/B test | Gate unsupported combinations |
| Report / export | Agent 1 | must | ship | Stable markdown/json/pdf path | Must match on-screen summary |
| Dataset library reopen flow | Agent 2 | must | ship | Reopen a ready dataset back into `/` | Session restore is part of this |
| Compare | Agent 2 | must | ship | Compare two files without local-only assumptions | Production-safe API usage |
| Public share page | Agent 2 | must | ship | Safe logged-out report rendering | Sanitize any rich text/narrative |
| Comments | Agent 2 | nice | ship-if-stable | Basic create/list/edit/delete | Hide if still unstable after fixes |
| Cleaning | Agent 1 | nice | ship-if-stable | One convincing action works | Do not block launch on it |
| Transforms | Agent 1 | nice | ship-if-stable | One simple transform works | Do not block launch on it |
| SQL editor | Agent 1 | nice | ship-if-stable | One known query path works | Hide if flaky |
| Connectors | Agent 3 | demo | demo-only | One believable source import path | Prefer PostgreSQL or S3, not both |
| Monitors | Agent 3 | demo | demo-only | One create + run history flow | Keep out of primary pitch unless stable |
| Pipelines | Agent 3 | demo | demo-only | One save + run-now path | Hide scheduling if unsafe |
| Settings / team / audit | Agent 3 | demo | hide-if-unstable | Must not crash for admin | Not part of primary demo |
| Pricing | Coordinator / Agent 3 | must | ship | Match visible features to reality | Remove untrue claims |
| Integrations page | Agent 3 | demo | demo-only | Reframe as guided setup if needed | Never present as fully live unless proven |

## Demo Script

1. Open landing page and sign in.
2. Upload `sample_sales.csv` or use the sample-data path.
3. Wait for the dataset to reach the main workspace.
4. Show overview, columns, visualizations, and one statistics result.
5. Export a report.
6. Reopen the dataset from the dataset library.
7. Compare two datasets.
8. Open a public share link in a logged-out browser.
9. If time allows, show one expansion feature: connector or monitor or pipeline.

## Hide Rules

- Hide any route that still crashes, leaks raw backend errors, or depends on local-only configuration.
- Hide any feature whose marketing copy overpromises against current behavior.
- Keep only one expansion feature in the live demo unless two are clearly stable.
