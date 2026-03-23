# Sushi Launch Smoke Test Report

Date: 2026-03-23

Scope: route-by-route smoke pass for the MVP launch surfaces defined in the launch matrix.

## Environment

- Frontend build: `npm run build` passed
- Frontend lint: `npm run lint` passed
- Backend syntax checks: passed
- Local backend runtime: reachable on `127.0.0.1:8000`
- Local frontend runtime: `next start` binds to `127.0.0.1:3000`, but HTTP requests stall locally before any response bytes are returned

## Route Results

| Surface | Route / Endpoint | Result | Evidence | Notes |
|---|---|---|---|---|
| Frontend | `/` | blocked locally | `next start` ready, but `curl` timed out after 15s with 0 bytes | Likely runtime dependency in middleware/auth path, not a build failure |
| Frontend | `/sign-in` | blocked locally | same runtime limitation | Build includes route |
| Frontend | `/sign-up` | blocked locally | same runtime limitation | Build includes route |
| Frontend | `/datasets` | blocked locally | same runtime limitation | Build includes route |
| Frontend | `/compare` | blocked locally | same runtime limitation | Build includes route |
| Frontend | `/pricing` | blocked locally | same runtime limitation | Build includes route |
| Frontend | `/docs` | blocked locally | same runtime limitation | Build includes route |
| Frontend | `/share/[token]` | blocked locally | same runtime limitation | Build includes route |
| Frontend | `/connectors` | blocked locally | same runtime limitation | Build includes route |
| Frontend | `/pipelines` | blocked locally | same runtime limitation | Build includes route |
| Frontend | `/settings` | blocked locally | same runtime limitation | Build includes route |
| Frontend | `/integrations` | blocked locally | same runtime limitation | Build includes route |
| Backend | `GET /health` | pass | `200 OK` with JSON response | App boots without `DATABASE_URL`, Redis unavailable as expected |
| Backend | `GET /jobs/not-a-real-job` | blocked by missing infra | `503` | Fails before route-specific `404` because `DATABASE_URL` is missing |
| Backend | `POST /datasets/upload?org_id=default` | blocked by missing infra | `503` | Upload flow cannot run locally without `DATABASE_URL`; storage/queue stack is also not configured |

## Backend Evidence

`GET /health` returned:

```json
{"status":"ok","version":"1.0.0","cache_size":-1,"redis_ok":false,"current_df_loaded":false}
```

`GET /jobs/not-a-real-job` returned:

```json
{"detail":"Database not configured (DATABASE_URL missing)"}
```

`POST /datasets/upload?org_id=default` with `sample_data/sales_data.csv` returned:

```json
{"detail":"Database not configured (DATABASE_URL missing)"}
```

## Interpretation

- The backend can boot and serve public health checks.
- Launch-critical backend flows are not smoke-testable in this environment until `DATABASE_URL` is present.
- The frontend is buildable, but local HTTP smoke validation is blocked because the Next runtime never returns a response under `next start` in this sandboxed environment.
- The most likely frontend blocker is middleware/auth runtime behavior rather than route compilation, because the production build emitted all app routes successfully.

## Launch Recommendation

- Treat backend end-to-end smoke testing as blocked until a real launch-like environment is available with:
  - `DATABASE_URL`
  - Clerk network access
  - storage credentials
  - queue/worker support if async upload is being demonstrated
- For tomorrow's investor demo, rely on the built app plus the launch matrix and demo script, and run one final browser check in the real environment where Clerk and database access are available.
