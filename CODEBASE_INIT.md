# Codebase Init

This file is a fast orientation pass for the repository. Read this before making changes so you know which service actually owns the product flow.

## What This Repo Is

Sushi is a multi-surface data analysis product built around one primary backend:

- `frontend/`: Next.js 14 web app
- `backend/`: FastAPI API, async workers, database models, storage, auth, and analysis logic
- `api/`: thin serverless adapter that re-exports the backend app
- `cli/`: Python CLI client for the hosted API
- `chrome-extension/`: browser capture-and-upload client

The core product path is:

1. Frontend uploads a dataset.
2. Backend stores the file in Cloudflare R2 and creates a dataset row in Postgres.
3. Celery worker analyzes the file.
4. Redis carries job state and pub/sub updates.
5. Frontend reloads analysis results and downstream features from backend routes.

## Start Here

If you only need the main app locally:

### Option 1: split services locally

Backend API:

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Worker:

```bash
cd backend
celery -A worker worker --loglevel=info --concurrency=2
```

Beat scheduler:

```bash
cd backend
celery -A worker beat --loglevel=info --schedule=/tmp/celerybeat-schedule
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

You also need Redis running and reachable through `REDIS_URL`.

### Option 2: docker compose

From the repo root:

```bash
docker compose up --build
```

`docker-compose.yml` starts:

- `redis`
- `backend`
- `worker`
- `beat`
- `frontend`

`docker-compose.override.yml` adds local-dev behavior like `uvicorn --reload` and a host-oriented frontend API URL.

## Runtime Ownership

### `backend/` is the real service

Key entrypoints:

- `backend/main.py`: main FastAPI app
- `backend/worker.py`: Celery app and background tasks
- `backend/db/models.py`: application schema
- `backend/auth.py`: Clerk JWT verification and org access checks
- `backend/storage.py`: Cloudflare R2 wrapper
- `backend/cache.py`: Redis cache, job status, and pub/sub
- `backend/routers/`: product feature routes

Important note:

- `api/index.py` is not a second API. It only adds `backend/` to `sys.path` and re-exports `main.app` for serverless deployment.

### `frontend/` is the main user surface

Key entrypoints:

- `frontend/src/app/layout.tsx`: global layout and `ClerkProvider`
- `frontend/src/app/page.tsx`: actual product shell
- `frontend/src/middleware.ts`: route protection
- `frontend/src/lib/api.ts`: browser API client
- `frontend/src/hooks/useJobStream.ts`: job progress updates

Important note:

- `frontend/src/app/dashboard/page.tsx` just redirects to `/`.
- The real dashboard UX lives on the root route and conditionally renders landing, signed-in dashboard, or full analysis workspace.

### `cli/` and `chrome-extension/` are optional clients

- `cli/` is a thin Python client for the backend API.
- `chrome-extension/` captures web tables or file links and sends them to the same backend.

They are not required to run the main product locally.

## How Data Moves

Main async SaaS flow:

1. Frontend calls `POST /datasets/upload`.
2. Backend validates the upload and writes bytes to R2 under `uploads/{org_id}/{dataset_id}/{filename}`.
3. Backend creates a `Dataset` record in Postgres.
4. Backend initializes job status in Redis.
5. Backend enqueues `analyze_dataset` in Celery.
6. Worker downloads the file from R2, parses it, runs analysis, stores the report in Postgres, and caches results in Redis.
7. Frontend consumes job state through `GET /jobs/{dataset_id}` or SSE at `GET /jobs/{dataset_id}/stream`.
8. Frontend loads analysis details, charts, SQL results, exports, comments, monitors, and related features from backend routes.

## Architecture Notes That Matter

- The backend has two shapes at once:
  - Older single-user, in-memory endpoints such as `/upload`, `/visualize`, and `/export/*`
  - Newer org-scoped, multi-tenant routes backed by Postgres, R2, Redis, and Celery
- Treat the router-based async flow as the current product architecture.
- Treat the older in-memory endpoints as dev or backward-compat paths unless you confirm otherwise.

## Key Environment Variables

Root `.env.example` is the broadest reference for the full stack. `backend/.env.example` and `frontend/.env.example` are narrower service-level references.

Most important values:

- Database: `DATABASE_URL`
- Redis: `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`
- Auth: `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- Frontend/backend wiring: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`
- Storage: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`
- AI: `ANTHROPIC_API_KEY`
- Billing: `STRIPE_*`
- Observability: `SENTRY_*`

## Directory Map

```text
api/                serverless adapter for backend/main.py
backend/            FastAPI app, Celery tasks, schema, analysis logic
backend/routers/    feature-specific API routes
backend/db/         SQLAlchemy connection, models, migrations
backend/connectors/ external source ingestion
cli/                Python CLI client for the API
chrome-extension/   browser ingestion client
frontend/           Next.js app
frontend/src/app/   routes and layout
frontend/src/lib/   API client and shared frontend helpers
frontend/src/components/dashboard/ analysis workspace UI
scripts/            repo scripts
sample_data/        example data and guides
```

## Known Caveats From Initial Scan

- `frontend/.env.local` exists in the repo and appears populated locally. Use `frontend/.env.example` as the source of truth for onboarding and treat checked-in real credentials as a cleanup issue.
- `cli/` looks lightweight but has no visible test coverage in this repo.
- `chrome-extension/` is plain JS with no build pipeline, and its popup upload path appears riskier for binary file formats than the background path.

## Suggested Reading Order

1. `README.md`
2. `docker-compose.yml`
3. `backend/main.py`
4. `backend/worker.py`
5. `backend/routers/datasets.py`
6. `frontend/src/app/page.tsx`
7. `frontend/src/lib/api.ts`

If you are changing backend behavior, start in `backend/`.
If you are changing product UX, start in `frontend/src/app/page.tsx` and `frontend/src/components/dashboard/`.
