# Investor Demo Script

This script is the default live flow for the Sushi MVP pitch.

## Primary Story

Sushi helps a data analyst go from a raw dataset to a shareable, decision-ready report in minutes.

## Environment Checklist

- Frontend loads successfully
- Backend imports cleanly
- Clerk auth is working
- One primary demo dataset is ready: `sample_sales.csv`
- One backup dataset is available
- Public share flow is ready in a logged-out browser

## Live Flow

1. Start on the landing page.
2. Sign in and show the signed-in dashboard.
3. Upload `sample_sales.csv` or use the built-in sample flow.
4. Wait for the dataset to reach the analysis workspace.
5. Show:
   - overview
   - column analysis
   - one visualization
   - one statistics result
6. Export a report.
7. Open the dataset library and reopen the same dataset.
8. Compare two datasets.
9. Open a public share link in a logged-out browser.

## Expansion Story

Show only one of these live:

- connector import
- monitor run history
- pipeline run-now flow

Pick the one that is most stable after final smoke tests.

## Fallbacks

- If async upload is slow, use the sample-data path.
- If a statistics example fails, fall back to correlation or a known-good t-test.
- If expansion features are unstable, stop after the public share flow and position the rest as next-step platform capabilities.

## Key Talking Points

- Fast time-to-insight for analysts
- Shareable outputs instead of notebook-only results
- Clear path from one-off analysis to recurring workflows
- Platform expansion through connectors, monitoring, and pipelines
