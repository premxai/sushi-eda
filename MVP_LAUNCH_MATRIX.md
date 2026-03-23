# Sushi MVP Launch Matrix

Last updated: 2026-03-22

This is the coordinator board for the investor-demo launch pass. Every visible website feature must have an owner and a launch decision.

Smoke-test status:
- See `SMOKE_TEST_REPORT.md` for the latest local validation pass.
- Backend public health check passed locally.
- Frontend production build passed, but local `next start` route requests stalled in the sandboxed smoke environment.

Decision legend:

- `ship`: visible in nav and included in the MVP story
- `demo-only`: keep available for the pitch, but do not rely on it for broad public traffic
- `hide`: remove from primary navigation and investor live path unless fixed

## Demo Datasets

- Primary dataset A: `sample_data/sales_data.csv`
- Primary dataset B: `sample_data/customer_data.csv`
- Backup dataset: `sample_data/test_complete.csv`

## Core Demo Path

1. Land on `/`
2. Upload `sample_data/sales_data.csv`
3. Wait for async analysis completion
4. Show overview, columns, correlations, visualizations, outliers
5. Run one statistics flow:
   - correlation
   - t-test or ANOVA
   - linear regression
6. Export a report
7. Open `/datasets`, reopen the dataset
8. Compare two datasets
9. Open a public share link in a logged-out browser
10. Optional platform proof:
   - one connector import
   - or one monitor run
   - or one pipeline run

## Feature Matrix

| Feature | Surface | Owner | Wave | Current target | Decision | Notes |
|---|---|---|---|---|---|---|
| Landing page | `/` signed-out | Coordinator + Agent 1 | 1 | Clear analyst story, one CTA, no dead ends | `ship` | Keep focused on upload and value proof |
| Auth flow | `sign-in`, `sign-up`, redirects | Agent 1 | 1 | Predictable access to main workspace | `ship` | Needed for every logged-in path |
| Upload + job status | `/`, `/jobs/*` | Agent 1 | 1 | Async upload works with progress and no crash | `ship` | Highest priority |
| Overview | workspace | Agent 1 | 1 | Trustworthy quality score and summary | `ship` | Demo anchor |
| Columns | workspace | Agent 1 | 1 | Per-column stats and type hints stable | `ship` | Demo anchor |
| Visualizations | workspace | Agent 1 | 1 | Charts load and export cleanly | `ship` | Demo anchor |
| Correlations | workspace | Agent 1 | 1 | Strong pairs and heatmap reliable | `ship` | Demo anchor |
| Outliers | workspace | Agent 1 | 1 | Outlier counts and visuals stable | `ship` | Demo anchor |
| Statistics | workspace | Agent 1 | 2 | Core tests investor-safe | `ship` | Prioritize correlation, t-test, ANOVA, regression, A/B |
| Report + export | workspace | Agent 1 | 1 | Markdown/JSON/PDF consistent and downloadable | `ship` | Needed for pitch payoff |
| AI narrative/chat/cleaning suggestions | workspace | Agent 1 | 2 | Keep only if stable and fast | `demo-only` | Hide if flaky or credit logic unstable |
| Cleaning | workspace | Agent 1 | 2 | One or two safe workflows | `demo-only` | Hide if state sync is weak |
| Transforms | workspace | Agent 1 | 2 | One derived-column flow works | `demo-only` | Hide if report refresh is inconsistent |
| SQL editor | workspace | Agent 1 | 2 | One query path works end to end | `demo-only` | Hide if schema/query path is unstable |
| Dataset library | `/datasets` | Agent 2 | 1 | List, reopen, star, archive basics | `ship` | Needed for the return-to-work story |
| Compare | `/compare` | Agent 2 | 1 | Two-file comparison works in prod config | `ship` | Demo anchor |
| Public share page | `/share/[token]` | Agent 2 | 1 | Logged-out report opens safely | `ship` | Demo anchor |
| Comments | workspace comments | Agent 2 | 2 | Create/list/edit/delete stable | `hide` | Improved backend safety, but keep out of the public launch path pending one real auth smoke test |
| Connectors | `/connectors` | Agent 3 | 2 | One believable source import path | `demo-only` | Prefer PostgreSQL or S3 only |
| Monitors | workspace + monitor modal | Agent 3 | 2 | One monitor create/run/history path | `demo-only` | Use as expansion proof |
| Pipelines | `/pipelines` | Agent 3 | 2 | One save + manual run path | `demo-only` | Hide scheduling if risky |
| Settings / team / audit | `/settings` | Agent 3 | 2 | No crashes, limited admin proof | `hide` | Upgrade to demo-only only if fixed |
| Pricing | `/pricing` | Agent 3 | 1 | Claims match live capability | `ship` | Required for investor credibility |
| Integrations page | `/integrations` | Agent 3 | 2 | Reframe as guided setup if needed | `hide` | Upgrade to demo-only only if secure and accurate |
| Docs | `/docs` | Coordinator | 3 | Match actual MVP surface | `ship` | Trim overclaims if needed |

## Wave Gates

### End of Wave 1

- `/` upload flow works repeatedly
- `/datasets` loads and reopen works
- `/compare` works without localhost assumptions
- `/share/[token]` works logged out
- `/pricing` copy is defensible
- No visible nav route crashes

### End of Wave 2

- Every visible feature is explicitly marked `ship`, `demo-only`, or `hide`
- All `ship` features have passed one end-to-end manual test
- Weak features are removed from nav or relabeled

### End of Wave 3

- Demo path runs start to finish in a clean browser
- Backup dataset path is prepared
- Final investor notes and fallback script are ready

## Navigation Visibility Rules

- Keep in primary investor path:
  - `/`
  - `/datasets`
  - `/compare`
  - `/pricing`
- Keep visible only if fixed:
  - `/connectors`
  - `/pipelines`
  - `/settings`
  - `/integrations`
- Workspace sections to keep by default:
  - Overview
  - Columns
  - Statistics
  - Correlations
  - Outliers
  - Visualizations
  - Report
- Workspace sections to hide if not stable by end of Wave 2:
  - AI chat / AI cleaning
  - Cleaning
  - Transforms
  - SQL Editor
  - Monitors
  - Comments

## Release Rule

If a feature is not stable by end of Wave 2, hide it rather than explaining around it in the live demo.
