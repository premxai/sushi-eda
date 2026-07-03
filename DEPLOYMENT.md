# 🚀 Sushi Deployment Guide

Sushi has two services:

- **Backend** — single-process FastAPI app in `backend/` (`uvicorn main:app`);
  analysis runs in-process via BackgroundTasks (no Celery/Redis needed)
- **Frontend** — Next.js 14 app in `frontend/` (standalone build)

Everything runs with **zero configuration** in open demo mode (SQLite, local
file storage, no auth, AI off). Public deployments need the persistence and
hardening variables below because platform disks are ephemeral.

---

## Option A — Docker Compose (single host)

```bash
cp .env.example .env        # required by compose; defaults = demo mode
docker compose up --build
```

Starts the backend and the frontend at `http://localhost:3000` (API proxied
via `/api`). SQLite + uploads live in the `backend_data` volume, so data
survives restarts. Fill in `.env` to enable Postgres, R2, or AI features.

## Option B — Render (backend) + Vercel (frontend) — recommended

### 0. Provision the free-tier persistence first

Render's free disk is **ephemeral** — anything not stored externally is lost
on every deploy/restart:

1. **Neon** (or Supabase) free Postgres → copy the connection string for
   `DATABASE_URL` (datasets, analyses, share tokens, feedback).
2. **Cloudflare R2** free tier → create a bucket + API token for the `R2_*`
   variables (uploaded files).

### 1. Backend on Render

1. Connect the GitHub repo to Render and create a **Web Service**.
2. Render reads `render.yaml` automatically (root dir `backend`,
   `uvicorn main:app`, health check `/health`).
3. Set in the Render dashboard:
   - `ENVIRONMENT=production`
   - `ALLOWED_ORIGINS=https://<your-frontend>.vercel.app`
   - `DATABASE_URL` (from Neon)
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
   - `ANTHROPIC_API_KEY` (AI summary + chat)
   - Optional tuning: `AI_DAILY_LIMIT_PER_IP` (default 20),
     `AI_DAILY_BUDGET_CALLS` (default 500), `RETENTION_DAYS` (default 7),
     `SENTRY_DSN`
4. **Run one instance / one worker.** Job progress and SSE events are held
   in process memory; add `REDIS_URL` before scaling out.

### 2. Frontend on Vercel

1. Import the repo in Vercel and set **Root Directory = `frontend`**.
2. Environment variables (Settings → Environment Variables):
   - `NEXT_PUBLIC_API_URL` = `/api` and `BACKEND_URL` = your Render backend
     URL (proxies through Next.js rewrites — recommended), **or** set
     `NEXT_PUBLIC_API_URL` directly to the backend URL.
   - `NEXT_PUBLIC_SITE_URL` = your frontend URL (SEO/OG tags).
   - Leave the Clerk keys unset until Phase 4 (auth).
   - Optional: `NEXT_PUBLIC_SENTRY_DSN`.
3. Deploy, then add the Vercel domain to the backend's `ALLOWED_ORIGINS`.

---

## Environment variable matrix

All variables are optional in demo mode. For a public deployment:

| Variable | Service | Required in production? | Notes |
|---|---|---|---|
| `ENVIRONMENT` | backend | yes (`production`) | switches off permissive dev defaults |
| `ALLOWED_ORIGINS` | backend | **yes** | comma-separated frontend origins; without it all CORS is blocked in production |
| `DATABASE_URL` | backend | **yes** | Neon/Supabase Postgres; unset = SQLite in `/tmp` (wiped on restart) |
| `R2_ACCOUNT_ID` / `R2_*` | backend | **yes** | Cloudflare R2 storage; unset = local disk (wiped on restart) |
| `ANTHROPIC_API_KEY` | backend | for AI features | AI summary + "Ask Your Data" chat |
| `AI_DAILY_LIMIT_PER_IP` | backend | optional (20) | AI calls per IP per UTC day |
| `AI_DAILY_BUDGET_CALLS` | backend | optional (500) | global AI kill-switch per UTC day |
| `RETENTION_DAYS` | backend | optional (7) | auto-delete uploads + reports; 0 = keep forever |
| `NEXT_PUBLIC_API_URL` / `BACKEND_URL` | frontend | yes | where the browser / Next.js server reach the API |
| `REDIS_URL` | backend | only when scaling out | shared job state + SSE pub/sub across instances |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | both | recommended | error tracking |
| `CLERK_*`, `STRIPE_*` | both | Phase 4 | leave unset until auth/billing are re-enabled |

## Post-deployment verification

```bash
# 1. Backend health
curl https://<backend>/health          # → {"status":"ok",...}

# 2. Pre-analyzed example is seeded
curl https://<backend>/example         # → {"dataset_id": "...", ...}

# 3. Upload + analysis
curl -X POST "https://<backend>/datasets/upload?org_id=default" \
  -F "file=@sample_data/sales_data.csv"

# 4. Frontend
curl -I https://<frontend>/            # → HTTP 200
```

Then in a browser: click "try the sample" (should open instantly), upload a
CSV, check the AI summary card, ask a question in Ask Your Data, export the
PDF, and open a share link in a private window. Test from two devices at
once to confirm concurrent use.

## Troubleshooting

- **CORS errors** — set `ALLOWED_ORIGINS` on the backend to the exact
  frontend origin (scheme + host).
- **429 on AI features** — per-IP daily cap (`AI_DAILY_LIMIT_PER_IP`) or the
  global budget (`AI_DAILY_BUDGET_CALLS`) was hit; both reset at midnight UTC.
- **Upload fails** — files must be <25 MB and CSV/TSV/Excel/JSON/Parquet/SQLite.
- **Datasets vanish after a deploy** — `DATABASE_URL`/`R2_*` are not set, so
  data lived on the ephemeral disk.
- **Share links die after a deploy** — same cause as above; tokens live in
  the database-backed cache only when Postgres/Redis are configured.
- **Every page hangs** — a Clerk publishable key is set on the frontend but
  is invalid; fix the key or remove it to fall back to demo mode.
