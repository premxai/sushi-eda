# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Sushi is a data-analysis (EDA) SaaS being remodeled for a **Product Manager audience**: upload a data file (CSV/TSV/Excel/JSON/Parquet/SQLite) → get a quality score, plain-English AI insights, interactive charts, and a shareable report. The master plan lives at the user's plans directory (phases: 0 strip ✅ → 1 PM experience → 2 launch readiness → 3 deploy → 4 auth+billing). Auth (Clerk) and billing (Stripe) are intentionally **disabled/removed until Phase 4** — the app runs in open demo mode.

Monorepo: `backend/` (FastAPI, single-process), `frontend/` (Next.js 14 App Router), `cli/` (Click), `chrome-extension/` (both untouched in the remodel).

## Commands

### Backend (Python 3.11+; local venv at backend/.venv)
```bash
cd backend
pip install -r requirements.txt pytest pytest-asyncio
uvicorn main:app --reload --port 8000   # SINGLE worker only — job state is in-process
python -m pytest tests -q               # 20 tests: engines + end-to-end API flow
```

### Frontend
```bash
cd frontend
npm install
npm run dev     # http://localhost:3000 (proxies /api → localhost:8000)
npm run build   # includes type-check; run before committing frontend changes
npm run lint
```

### Full stack
```bash
cp .env.example .env      # compose requires the file; blank values = demo mode
docker-compose up --build # backend + frontend only (no Redis/Celery anymore)
```

## Architecture (post-remodel)

### Single-process job flow — the core path
`POST /datasets/upload` (main.py) → file to `storage.py` (R2 or local FS fallback) → `Dataset` row → **FastAPI `BackgroundTasks`** schedules `analysis_runner.run_analysis` → parses (polars_loader) → `EDAAnalyzer.generate_full_report()` → AI narrative (`ai_narrative.py`, None without `ANTHROPIC_API_KEY`) → `Analysis` row → job status via `cache.py` → frontend receives it over SSE (`routers/jobs.py`, `useJobStream` hook has polling fallback).

**Celery/Redis are gone.** `analysis_runner.py` replaced `worker.py`. `cache.py` still speaks Redis if `REDIS_URL` is set but falls back to in-process dicts — which is why the backend must run with **one worker** until Redis is reintroduced.

### Everything optional (demo mode)
Unset env vars degrade gracefully: no `DATABASE_URL` → SQLite at `/tmp/sushi/sushi.db` (schema via `create_all` at startup); no `R2_*` → local file storage; no `CLERK_SECRET_KEY` → every request is the shared `system` user in the `default` org (`auth.py` `AUTH_ENABLED=False`, kept for Phase 4 re-enablement); no `ANTHROPIC_API_KEY` → AI narrative/chat return None/disabled. `defaults.py` holds the resolved demo org/user IDs populated by the startup hook in `main.py`.

### Backend layout
- `main.py`: app setup, CORS (`ALLOWED_ORIGINS` required when `ENVIRONMENT=production`), slowapi rate limits, `POST /datasets/upload` (25 MB cap), stateless `POST /compare`, `POST /feedback`, `GET /example` (pre-analyzed sample seeded at startup from `backend/seed/`), `/health`.
- `ai_limits.py`: per-IP daily AI cap (`AI_DAILY_LIMIT_PER_IP`, default 20) + global daily budget (`AI_DAILY_BUDGET_CALLS`, default 500) as a FastAPI dependency on all AI endpoints; `analysis_runner` skips the auto-narrative when the budget is exhausted. Redis-or-in-process counters, fail-open.
- `retention.py`: deletes datasets/analyses/files older than `RETENTION_DAYS` (default 7, 0 disables) every 6h; the seeded example is exempt. This backs the "deleted after 7 days" promise on `/privacy`.
- `routers/datasets.py`: dataset CRUD, analysis retrieval, AI chat/cleaning endpoints, per-dataset stats/SQL/visualize/export. `routers/jobs.py`: SSE + poll. `routers/shares.py`: public share tokens (cache-backed).
- Analysis engines (pure, framework-free): `analyzer.py`, `quality_score.py`, `type_detector.py`, `visualizer.py`, `advanced_stats.py`, `cleaner.py`, `duckdb_query.py` (per-query DuckDB connection, registers frames via Arrow), `polars_loader.py`.
- `db/models.py`: only `Organization`, `User`, `OrgMember`, `Dataset`, `Analysis`. Old migrations were deleted; a fresh Alembic baseline is a Phase 3 task.
- JSON responses with NaN/Inf must pass through `analysis_runner.sanitize_json`.
- Deleted in Phase 0 (recover from git history when needed): billing, admin, pipelines, monitors, integrations, slack_bot, comments, connectors routers; `ai_credits.py`; `worker.py`; legacy global-DataFrame endpoints (`/upload`, `/visualize`, `/stats/*`, `/clean`, `/transform`).

### Frontend layout
- `src/app/page.tsx` is the hub: upload → SSE progress → report rendered by `src/components/dashboard/*` sections (Sidebar defines the `NavSection` type — keep it in sync with page.tsx renders).
- Live pages: `/` `/compare` `/datasets` `/docs` `/changelog` `/share/[token]`. Deleted: connectors, pipelines, integrations, settings, pricing, catalog, sign-in/up, dashboard.
- `src/lib/api.ts` mirrors the backend surface — update both together. `src/lib/types.ts` mirrors report shapes.
- **`ai_narrative` is fetched but only displayed on the share page — surfacing it in the main dashboard is the core Phase 1 task.** `AIChatPanel.tsx` exists but is wired nowhere yet.
- `lib/auth.tsx` + `middleware.ts` are Clerk shims that no-op without keys — leave them for Phase 4.
- Sign-in/up links in `LandingPage.tsx`/`Navbar.tsx`/`LockedPreview` are inert in demo mode (those components only render when Clerk is enabled) — cleaned up properly in Phase 2.

### Version pins that matter
- `httpx>=0.26,<0.28` — newer httpx breaks starlette's TestClient under fastapi 0.104.
- Backend Dockerfile runs `--workers 1` deliberately (see job flow above).

## Testing

`backend/tests/` (pytest): `conftest.py` sets env vars (temp SQLite, local storage, no AI) **before** app imports — keep that ordering. `test_engines.py` runs the full report over every `sample_data/` file. `test_api.py` covers upload → job → analysis → share → compare → SQL with AI mocked; TestClient executes BackgroundTasks synchronously, so no sleeping/polling is needed.

There are no frontend tests; `npm run build` is the type-check gate.
