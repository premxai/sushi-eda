# 🚀 Sushi Deployment Guide

Sushi has two services:

- **Backend** — FastAPI app in `backend/` (`uvicorn main:app`)
- **Frontend** — Next.js 14 app in `frontend/` (standalone build)

Everything runs with **zero configuration** in open demo mode (SQLite, local
file storage, no auth, AI off). Production deployments should set the
environment variables listed at the bottom.

---

## Option A — Docker Compose (single host)

```bash
cp .env.example .env        # required by compose; defaults = demo mode
docker compose up --build
```

This starts the backend, a Redis instance, Celery worker + beat, and the
frontend at `http://localhost:3000` (API proxied via `/api`). Fill in `.env`
to enable Postgres, Clerk auth, R2 storage, or AI features.

## Option B — Render (backend) + Vercel (frontend)

### Backend on Render

1. Connect the GitHub repo to Render and create a **Web Service**.
2. Render reads `render.yaml` automatically (root dir `backend`,
   `uvicorn main:app`, health check `/health`).
3. With no env vars the API runs in demo mode. For production set in the
   Render dashboard: `ENVIRONMENT=production`, `ALLOWED_ORIGINS=<your
   frontend origin>`, `CLERK_SECRET_KEY`, and optionally `DATABASE_URL`
   (Render Postgres), `REDIS_URL`, `ANTHROPIC_API_KEY`.

### Frontend on Vercel

1. Import the repo in Vercel and set **Root Directory = `frontend`**.
2. Environment variables (Settings → Environment Variables):
   - `NEXT_PUBLIC_API_URL` = `/api` (proxy through Next.js rewrites), and
     `BACKEND_URL` = your Render backend URL — **or** set
     `NEXT_PUBLIC_API_URL` directly to the backend URL.
   - Optional: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY`
     to enable auth (leave unset for demo mode).
   - Optional: `NEXT_PUBLIC_SITE_URL` = your frontend URL.
3. Deploy. Remember to add the Vercel domain to the backend's
   `ALLOWED_ORIGINS`.

## Option C — Railway (full stack)

See `railway.toml` for the three backend services (API, Celery worker, beat).
Add the Railway Postgres and Redis plugins (they inject `DATABASE_URL` /
`REDIS_URL`), set `CELERY_BROKER_URL=$REDIS_URL` and
`CELERY_RESULT_BACKEND=$REDIS_URL/1` on the worker/beat services, and deploy
the frontend on Vercel as in Option B.

---

## Environment variable matrix

All variables are optional in demo mode. For production:

| Variable | Service | Required in production? | Notes |
|---|---|---|---|
| `ENVIRONMENT` | backend | yes (`production`) | switches off permissive dev defaults |
| `ALLOWED_ORIGINS` | backend | **yes** | comma-separated frontend origins; without it all CORS is blocked in production |
| `CLERK_SECRET_KEY` | backend + frontend | strongly recommended | unset = open demo mode, anyone shares one workspace |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | frontend | strongly recommended | pairs with the secret key |
| `DATABASE_URL` | backend | recommended | Postgres; unset = SQLite in `/tmp` (single instance only) |
| `REDIS_URL` (+ `CELERY_*`) | backend | recommended | enables async analysis queue; unset = inline processing, single process |
| `R2_ACCOUNT_ID` / `R2_*` | backend | recommended | Cloudflare R2 storage; unset = local filesystem |
| `ANTHROPIC_API_KEY` | backend | optional | AI narrative/chat features |
| `NEXT_PUBLIC_API_URL` / `BACKEND_URL` | frontend | yes | where the browser / Next.js server reach the API |
| `STRIPE_*`, `SENTRY_*`, `SLACK_*`, `CONNECTOR_SECRET_KEY` | backend | optional | billing, observability, integrations |

## Post-deployment verification

```bash
# 1. Backend health
curl https://<backend>/health          # → {"status":"ok",...}

# 2. Upload + analysis (demo mode or with a Bearer token)
curl -X POST "https://<backend>/datasets/upload?org_id=default" \
  -F "file=@sample_data/sales_data.csv"

# 3. Frontend
curl -I https://<frontend>/            # → HTTP 200
```

Then in a browser: upload a CSV, walk the overview/columns/correlations/
visualizations tabs, export a report, and open a share link in a private
window.

## Troubleshooting

- **CORS errors** — set `ALLOWED_ORIGINS` on the backend to the exact
  frontend origin (scheme + host).
- **429 errors** — uploads are rate-limited to 10/minute per IP (`main.py`).
- **Upload fails** — files must be <100 MB and CSV/TSV/Excel/JSON/Parquet/SQLite.
- **"Database not configured"** — the SQLite fallback needs `aiosqlite`
  (in `backend/requirements.txt`) and a writable `/tmp`; or set `DATABASE_URL`.
- **Every page hangs** — a Clerk publishable key is set on the frontend but
  is invalid; fix the key or remove it to fall back to demo mode.
