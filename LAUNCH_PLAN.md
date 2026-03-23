# 🍣 Sushi EDA — SaaS Public Launch Fix Plan

> **Generated from full codebase audit — 76 issues across backend, frontend, CLI, and Chrome extension.**
> Each task has a unique ID, severity, file(s), estimated effort, and acceptance criteria.

---

## Table of Contents

- [Phase 0 — App Won't Start (Critical Import & Crash Fixes)](#phase-0--app-wont-start-critical-import--crash-fixes)
- [Phase 1 — Security Hardening](#phase-1--security-hardening)
- [Phase 2 — Core User Flow (Upload → Analyze → View)](#phase-2--core-user-flow-upload--analyze--view)
- [Phase 3 — Data Integrity & Backend Correctness](#phase-3--data-integrity--backend-correctness)
- [Phase 4 — Feature Completeness (SaaS Essentials)](#phase-4--feature-completeness-saas-essentials)
- [Phase 5 — Frontend Polish & UX](#phase-5--frontend-polish--ux)
- [Phase 6 — Integrations, CLI & Extension](#phase-6--integrations-cli--extension)
- [Phase 7 — Operational Readiness](#phase-7--operational-readiness)
- [Dependency Graph](#dependency-graph)
- [Estimated Total Effort](#estimated-total-effort)

---

## Phase 0 — App Won't Start (Critical Import & Crash Fixes)

> **Goal:** The backend starts, the frontend renders, and the core upload→analyze loop doesn't crash.
> **Estimated effort:** 2–3 hours
> **Parallelize:** All P0 tasks are independent — assign to multiple devs simultaneously.

### P0-01 · Add missing `Depends` import in `main.py`

| Field | Value |
|-------|-------|
| **Severity** | 🔴 Critical |
| **File** | `backend/main.py` L16 |
| **Issue** | `Depends` is used on L892-893 (`Depends(get_optional_user)`, `Depends(get_db)`) but never imported from `fastapi`. The `/datasets/upload` production endpoint crashes at module import time. |
| **Fix** | Add `Depends` to the existing import: `from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, Request` |
| **Effort** | 2 min |
| **Acceptance** | `python -c "from main import app"` succeeds; `/datasets/upload` returns 200 on valid file. |

### P0-02 · Add missing `DataCleaner` import in `main.py`

| Field | Value |
|-------|-------|
| **Severity** | 🔴 Critical |
| **File** | `backend/main.py` L730 |
| **Issue** | `/clean` endpoint calls `DataCleaner(df)` but the class is never imported. Raises `NameError` at runtime. |
| **Fix** | Add `from cleaner import DataCleaner, DataTransformer` near the top-level imports (covers P0-03 too). |
| **Effort** | 2 min |
| **Acceptance** | `POST /clean` with `{"drop_duplicates": true}` returns 200 after uploading a file. |

### P0-03 · Add missing `DataTransformer` import in `main.py`

| Field | Value |
|-------|-------|
| **Severity** | 🔴 Critical |
| **File** | `backend/main.py` L834 |
| **Issue** | `/transform` endpoint calls `DataTransformer(df)` but never imported. Raises `NameError`. |
| **Fix** | Covered by P0-02's import line. |
| **Effort** | 0 min (same fix as P0-02) |
| **Acceptance** | `POST /transform` with `{"normalize": ["col1"]}` returns 200. |

### P0-04 · Fix `validate_org_access` calls in `admin.py`

| Field | Value |
|-------|-------|
| **Severity** | 🔴 Critical |
| **File** | `backend/routers/admin.py` L69, 99, 125, 156, 186 |
| **Issue** | Arguments are swapped (`current_user, org_id` instead of `org_id, current_user`) and uses non-existent `min_role` kwarg instead of `allowed_roles`. Every admin endpoint crashes with `TypeError`. |
| **Fix** | Change all 5 call sites from `validate_org_access(current_user, org_id, db, min_role="admin")` → `validate_org_access(org_id, current_user, db, allowed_roles=("admin",))`. |
| **Effort** | 10 min |
| **Acceptance** | `GET /orgs/{org_id}/audit-logs` returns 200 for an admin user; returns 403 for a viewer. |

### P0-05 · Fix `validate_org_access` calls in `comments.py`

| Field | Value |
|-------|-------|
| **Severity** | 🔴 Critical |
| **File** | `backend/routers/comments.py` L85, 111, 139, 163, 168 |
| **Issue** | Same swapped-args + `min_role` bug as admin.py. All comment endpoints crash for non-default orgs. |
| **Fix** | Same pattern: swap positional args, replace `min_role="viewer"` with `allowed_roles=("viewer", "editor", "admin")`, `min_role="editor"` with `allowed_roles=("editor", "admin")`. |
| **Effort** | 10 min |
| **Acceptance** | `POST /datasets/{id}/comments` creates a comment; `DELETE` works for editors. |

### P0-06 · Fix `cache._client` → `cache.client` in `shares.py`

| Field | Value |
|-------|-------|
| **Severity** | 🔴 Critical |
| **File** | `backend/routers/shares.py` L141, 148, 155 |
| **Issue** | Directly accesses private `_client` attribute. If Redis hasn't been initialized via the `client` property, `_client` is `None` → `AttributeError`. |
| **Fix** | Replace `cache._client.setex(...)` → `cache.client.setex(...)` on L141, `cache._client.get(...)` → `cache.client.get(...)` on L148, `cache._client.delete(...)` → `cache.client.delete(...)` on L155. |
| **Effort** | 5 min |
| **Acceptance** | `POST /datasets/{id}/share` returns a share token; `GET /share/{token}` resolves the share. |

### P0-07 · Fix Fernet dev key length in `crypto.py`

| Field | Value |
|-------|-------|
| **Severity** | 🔴 Critical |
| **File** | `backend/connectors/crypto.py` L28-29 |
| **Issue** | Dev key `b"dev-key-do-not-use-in-production!!"` is 34 bytes; Fernet requires exactly 32. Crashes with `ValueError`. |
| **Fix** | Truncate to 32 bytes: `b"dev-key-do-not-use-in-prod!!!!"` (30 chars + `!!` = 32), or better: `os.urandom(32)` with a fixed seed for determinism, then base64-encode. Simplest: `b"dev_key_do_not_use_in_product!"` (32 bytes exact). |
| **Effort** | 5 min |
| **Acceptance** | `encrypt_credentials({"host":"x"})` and `decrypt_credentials(token)` round-trip without error. |

### P0-08 · Fix production key derivation in `crypto.py`

| Field | Value |
|-------|-------|
| **Severity** | 🔴 Critical |
| **File** | `backend/connectors/crypto.py` L22-25 |
| **Issue** | Code takes the raw UTF-8 bytes of the env var, truncates/pads to 32 bytes, then re-encodes as base64. A proper Fernet key (44 base64 chars) is truncated to 32 bytes and double-encoded, producing a different key. |
| **Fix** | If `_RAW_KEY` looks like a valid Fernet key (44 chars, base64), use it directly: `b64_key = _RAW_KEY.encode() if isinstance(_RAW_KEY, str) else _RAW_KEY`. Otherwise, derive with `hashlib.sha256(key).digest()` then base64-encode. Add a startup log warning if the key doesn't look like a proper Fernet key. |
| **Effort** | 15 min |
| **Acceptance** | Set `CONNECTOR_SECRET_KEY` to a `Fernet.generate_key()` output → encrypt/decrypt round-trips. |

### P0-09 · Fix `DatasetComment.replies` self-referential relationship

| Field | Value |
|-------|-------|
| **Severity** | 🔴 Critical |
| **File** | `backend/db/models.py` L393 |
| **Issue** | Missing `remote_side=[id]` on the `replies` relationship. SQLAlchemy raises `AmbiguousForeignKeysError` when loading comments with replies. |
| **Fix** | Change to: `replies: Mapped[list["DatasetComment"]] = relationship("DatasetComment", foreign_keys="[DatasetComment.parent_id]", remote_side="DatasetComment.id", cascade="all, delete-orphan")` |
| **Effort** | 5 min |
| **Acceptance** | Creating a reply to a comment succeeds; loading a comment with replies doesn't crash. |

### P0-10 · Export `DataConnector` and `DatasetComment` from `db/__init__.py`

| Field | Value |
|-------|-------|
| **Severity** | 🔴 Critical |
| **File** | `backend/db/__init__.py` |
| **Issue** | Both models are defined in `models.py` but not exported. Any `from db import DataConnector` raises `ImportError`. |
| **Fix** | Add `DataConnector, DatasetComment` to the import list in `__init__.py`. |
| **Effort** | 2 min |
| **Acceptance** | `from db import DataConnector, DatasetComment` succeeds. |

### P0-11 · Fix markdown export `KeyError` in `export_utils.py`

| Field | Value |
|-------|-------|
| **Severity** | 🔴 Critical |
| **File** | `backend/export_utils.py` L93 |
| **Issue** | References `quality['component_scores']` but the actual key from `QualityScorer` is `quality['breakdown']`. Guaranteed `KeyError` crash. |
| **Fix** | Change `quality['component_scores']` → `quality.get('breakdown', {})`. Also guard the loop: `for component, data in quality.get('breakdown', {}).items():` and access `data['score']`, `data['details']` instead of bare iteration. |
| **Effort** | 10 min |
| **Acceptance** | `GET /export/markdown` returns a valid markdown file without errors. |

### P0-12 · Fix hardcoded `localhost:8000` in compare page

| Field | Value |
|-------|-------|
| **Severity** | 🔴 Critical |
| **File** | `frontend/src/app/compare/page.tsx` L45 |
| **Issue** | `fetch("http://localhost:8000/compare", ...)` — hardcoded URL. Compare feature completely fails in production. |
| **Fix** | Import and use the shared `client` from `@/lib/api`, or at minimum use `process.env.NEXT_PUBLIC_API_URL`. Also add the Clerk auth token via the interceptor. |
| **Effort** | 15 min |
| **Acceptance** | Compare page works in production (Vercel) by uploading two files and seeing results. |

### P0-13 · Fix CLI `pyproject.toml` invalid build backend

| Field | Value |
|-------|-------|
| **Severity** | 🔴 Critical |
| **File** | `cli/pyproject.toml` L3 |
| **Issue** | `build-backend = "setuptools.backends.legacy:build"` doesn't exist. `pip install .` fails. |
| **Fix** | Change to `build-backend = "setuptools.build_meta"`. |
| **Effort** | 2 min |
| **Acceptance** | `cd cli && pip install -e .` succeeds. |

### P0-14 · Add missing `contextMenus` permission to Chrome extension

| Field | Value |
|-------|-------|
| **Severity** | 🔴 Critical |
| **File** | `chrome-extension/manifest.json` L7-11 |
| **Issue** | `background.js` uses `chrome.contextMenus.create()` but the permission isn't declared. Extension crashes on install. |
| **Fix** | Add `"contextMenus"` to the permissions array. |
| **Effort** | 2 min |
| **Acceptance** | Extension installs without errors; right-click context menu appears on CSV links. |

---

## Phase 1 — Security Hardening

> **Goal:** Close all security holes before any public traffic hits the app.
> **Estimated effort:** 4–6 hours
> **Depends on:** Phase 0 complete (app must start).

### P1-01 · Enforce Stripe webhook signature verification in production

| Field | Value |
|-------|-------|
| **Severity** | 🟠 High |
| **File** | `backend/routers/billing.py` L171-178 |
| **Issue** | If `STRIPE_WEBHOOK_SECRET` is unset, webhook verification is silently skipped. Anyone can forge events to upgrade plans. |
| **Fix** | In the `else` branch, check `ENVIRONMENT != "development"`. If production and secret is missing, return 500 with log alert. Never silently skip in production. |
| **Effort** | 15 min |
| **Acceptance** | Sending a forged webhook in production returns 500; works normally with correct secret. |

### P1-02 · Enforce GitHub webhook signature verification in production

| Field | Value |
|-------|-------|
| **Severity** | 🟠 High |
| **File** | `backend/routers/integrations.py` L49-52 |
| **Issue** | Missing `GITHUB_WEBHOOK_SECRET` silently accepts all webhook requests. |
| **Fix** | Same pattern as P1-01: return `False` (reject) in production when secret is missing. |
| **Effort** | 10 min |
| **Acceptance** | Unsigned GitHub webhook POST returns 400 in production. |

### P1-03 · Enforce Slack signing secret verification in production

| Field | Value |
|-------|-------|
| **Severity** | 🟠 High |
| **File** | `backend/routers/slack_bot.py` L42-44 |
| **Issue** | Missing `SLACK_SIGNING_SECRET` silently accepts all requests. |
| **Fix** | Return `False` in production when secret is missing. Add environment check. |
| **Effort** | 10 min |
| **Acceptance** | Unsigned Slack event POST returns 401 in production. |

### P1-04 · Sanitize AI narrative in share page (XSS fix)

| Field | Value |
|-------|-------|
| **Severity** | 🟠 High |
| **File** | `frontend/src/app/share/[token]/page.tsx` L139-146 |
| **Issue** | `dangerouslySetInnerHTML` renders AI narrative without sanitization. If column names or filenames contain `<script>`, it's XSS. |
| **Fix** | Install `dompurify` (`npm i dompurify @types/dompurify`). Sanitize before rendering: `__html: DOMPurify.sanitize(formatted)`. |
| **Effort** | 15 min |
| **Acceptance** | A share page with `<script>alert(1)</script>` in the narrative renders it as text, not executable. |

### P1-05 · Fix SQL injection in SQLite table name

| Field | Value |
|-------|-------|
| **Severity** | 🟠 High |
| **File** | `backend/main.py` L286 |
| **Issue** | `f"SELECT * FROM {table_name}"` — table name from user-uploaded SQLite file is unescaped. |
| **Fix** | Quote the table name: `f'SELECT * FROM "{table_name}"'`. Also validate it against a simple regex `^[a-zA-Z_][a-zA-Z0-9_]*$`. |
| **Effort** | 10 min |
| **Acceptance** | Upload a SQLite file with a table named `"; DROP TABLE x; --"` → either rejected or safely quoted. |

### P1-06 · Sandbox `DataFrame.eval()` in pipeline worker

| Field | Value |
|-------|-------|
| **Severity** | 🟠 High |
| **File** | `backend/worker.py` L740 |
| **Issue** | `working.eval(str(expression))` allows arbitrary code injection via pipeline graph expressions. |
| **Fix** | Use `pd.eval(expression, engine='numexpr', local_dict={'df': working})` which restricts to arithmetic/comparison operations. Alternatively, whitelist allowed operations and validate expressions against an AST. |
| **Effort** | 30 min |
| **Acceptance** | A pipeline with expression `__import__('os').system('echo pwned')` is rejected. Valid arithmetic expressions still work. |

### P1-07 · Add authentication to SSE/job streaming endpoints

| Field | Value |
|-------|-------|
| **Severity** | 🟠 High |
| **File** | `backend/routers/jobs.py` L92-96 |
| **Issue** | No auth on `GET /{dataset_id}/stream` or `GET /{dataset_id}` — anyone who guesses a dataset ID can stream job status. |
| **Fix** | Add `current_user: User = Depends(get_current_user)` and `db: AsyncSession = Depends(get_db)` deps. Validate org access for the dataset. For SSE (where EventSource can't send headers), accept a `token` query param — see P2-02 for the frontend counterpart. |
| **Effort** | 30 min |
| **Acceptance** | Unauthenticated `GET /jobs/{id}` returns 401. Authenticated request returns job status. |

### P1-08 · Gate `DEV_ORG` bypass behind environment check

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **File** | `backend/routers/admin.py` L29, 62-67 |
| **Issue** | `DEV_ORG = "default"` bypasses all access control. No production guard. |
| **Fix** | Read from env: `DEV_ORG = os.getenv("DEV_ORG", "") if os.getenv("ENVIRONMENT") == "development" else ""`. In production, `DEV_ORG` is always empty, so the bypass never triggers. |
| **Effort** | 10 min |
| **Acceptance** | In production, accessing admin endpoints with `org_id=default` requires proper auth. |

### P1-09 · Fix Slack token stored in `localStorage`

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **File** | `frontend/src/app/integrations/page.tsx` L169-176 |
| **Issue** | Slack bot token (`xoxb-...`) stored in `localStorage` — XSS-exploitable, persists indefinitely. |
| **Fix** | Remove `localStorage` storage entirely. Instead, POST the token to a backend endpoint that stores it encrypted in the DB (using the connector crypto module). On page load, fetch the masked token from the backend. |
| **Effort** | 45 min |
| **Acceptance** | Slack token is never in `localStorage`. Inspecting storage shows no `sushi_slack_*` keys. |

### P1-10 · Fix `stripe.error` import path for modern SDK

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Low |
| **File** | `backend/routers/billing.py` L173 |
| **Issue** | `stripe.error.SignatureVerificationError` may not exist in `stripe >= 5.0`. |
| **Fix** | Change to `stripe.SignatureVerificationError` (works in both old and new SDK versions), or add a try/except import fallback. |
| **Effort** | 5 min |
| **Acceptance** | Invalid webhook signature returns 400 (not 500). |

---

## Phase 2 — Core User Flow (Upload → Analyze → View)

> **Goal:** A user can sign up, upload a file, watch progress, and view results — the main value loop.
> **Estimated effort:** 6–8 hours
> **Depends on:** Phase 0, Phase 1 (P1-07).

### P2-01 · Fix SSE EventSource auth (frontend)

| Field | Value |
|-------|-------|
| **Severity** | 🔴 Critical |
| **File** | `frontend/src/hooks/useJobStream.ts` L66 |
| **Issue** | `EventSource` cannot send `Authorization` headers. All authenticated job streams fail with 401. |
| **Fix** | Replace `EventSource` with `fetch()` using `ReadableStream` + the authenticated axios `client` from `api.ts`. Pattern: `const response = await client.get(url, { responseType: 'stream' })` and manually parse SSE. Alternatively, pass a short-lived JWT as a `?token=` query param (coordinate with P1-07 backend). |
| **Effort** | 1 hour |
| **Acceptance** | Upload a file → progress bar animates from 0%→100% → report appears. No 401 errors in console. |

### P2-02 · Fix polling fallback auth in `useJobStream`

| Field | Value |
|-------|-------|
| **Severity** | 🔴 Critical |
| **File** | `frontend/src/hooks/useJobStream.ts` L131 |
| **Issue** | Polling fallback uses raw `fetch()` without auth token. |
| **Fix** | Replace with the shared `client` from `api.ts` which has the Clerk interceptor. |
| **Effort** | 15 min |
| **Acceptance** | When SSE fails, polling still shows job progress for authenticated users. |

### P2-03 · Add `_sanitize()` to `/upload` response

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **File** | `backend/main.py` L353-357 |
| **Issue** | `/upload` returns the report dict without `_sanitize()`. NaN/Inf values in stats will crash JSON serialization. |
| **Fix** | Wrap: `return _sanitize(report)`. |
| **Effort** | 5 min |
| **Acceptance** | Upload a file with NaN/Inf values → response is valid JSON (NaN replaced with `null`). |

### P2-04 · Fix `getClerkToken` fragility in `api.ts`

| Field | Value |
|-------|-------|
| **Severity** | 🟠 High |
| **File** | `frontend/src/lib/api.ts` L24-34 |
| **Issue** | Relies on `window.Clerk.session.getToken()` which may not be available when the interceptor fires (async load). |
| **Fix** | Use `@clerk/nextjs`'s `auth()` for server components or expose a `getToken` function from a React context wrapper that the API module can call. Simplest approach: export a `setTokenGetter(fn)` from `api.ts` and call it from a client component that has access to `useAuth().getToken`. |
| **Effort** | 30 min |
| **Acceptance** | API calls include valid `Authorization: Bearer` header on first request after page load (no race condition). |

### P2-05 · Deduplicate `API_BASE` definition

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Low |
| **File** | `frontend/src/hooks/useJobStream.ts` L19-20, `frontend/src/lib/api.ts` L5 |
| **Issue** | `API_BASE` is defined in both files. If they diverge, SSE and API calls point to different backends. |
| **Fix** | Export `API_BASE` from `api.ts` and import it in `useJobStream.ts`. |
| **Effort** | 5 min |
| **Acceptance** | Only one `API_BASE` definition exists in the codebase. |

### P2-06 · Add `/pricing` to public routes in middleware

| Field | Value |
|-------|-------|
| **Severity** | 🟠 High |
| **File** | `frontend/src/middleware.ts` L4-10 |
| **Issue** | `/pricing` is blocked by Clerk auth middleware. Unauthenticated visitors can't see pricing — kills the conversion funnel. |
| **Fix** | Add `"/pricing"`, `"/docs(.*)"`, `"/changelog(.*)"`, and `"/catalog(.*)"` to the `isPublicRoute` matcher. |
| **Effort** | 5 min |
| **Acceptance** | Opening `/pricing` in an incognito window shows the pricing page without redirect to sign-in. |

### P2-07 · Add `@keyframes spin` to `globals.css`

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **File** | `frontend/src/app/globals.css` |
| **Issue** | Multiple pages use `animation: "spin 1s linear infinite"` in inline styles but `@keyframes spin` is never defined globally. Loading spinners don't animate. |
| **Fix** | Add to `globals.css`: `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }` |
| **Effort** | 2 min |
| **Acceptance** | All Loader2 spinners across the app animate on pages: main, datasets, connectors. |

---

## Phase 3 — Data Integrity & Backend Correctness

> **Goal:** No data corruption, no wrong results, no silent failures.
> **Estimated effort:** 8–10 hours
> **Depends on:** Phase 0 complete.

### P3-01 · Fix `org_id="default"` UUID crash in all routers

| Field | Value |
|-------|-------|
| **Severity** | 🟠 High |
| **Files** | `backend/routers/connectors.py` L94, `monitors.py` L96, `pipelines.py` L82, `integrations.py` L143 |
| **Issue** | String `"default"` is passed directly to UUID columns in ORM models. DB rejects it. Every create endpoint crashes when using the default org. |
| **Fix** | Use `defaults.resolve_org_id(org_id)` (already exists!) everywhere an `org_id` is written to a model. Ensure `_ensure_default_org()` runs at startup to populate the real UUID. Also add `from defaults import resolve_org_id` to each affected router and wrap: `org_uuid = resolve_org_id(org_id)` before DB writes. |
| **Effort** | 30 min |
| **Acceptance** | `POST /connectors` with `org_id=default` creates a connector with the real default org UUID in the DB. |

### P3-02 · Fix `created_by` set to `org_id` in GitHub webhook

| Field | Value |
|-------|-------|
| **Severity** | 🟠 High |
| **File** | `backend/routers/integrations.py` L143-144 |
| **Issue** | The raw SQL insert sets `created_by = org_id` — a FK violation since `created_by` references `users.id`. |
| **Fix** | Resolve the org_id to find a system user or the webhook-triggering user. Use `defaults.DEFAULT_USER_ID` as fallback: `(dataset_id, resolve_org_id(org_id), DEFAULT_USER_ID, ...)`. |
| **Effort** | 15 min |
| **Acceptance** | A GitHub push webhook successfully creates a dataset row without FK violation. |

### P3-03 · Fix `cleaner.py` `strip_whitespace` NaN corruption

| Field | Value |
|-------|-------|
| **Severity** | 🟠 High |
| **File** | `backend/cleaner.py` L180-184 |
| **Issue** | `.astype(str)` converts NaN to literal string `"nan"`. Data corruption. |
| **Fix** | Replace `self.df[col] = self.df[col].astype(str).str.strip()` with: `mask = self.df[col].notna(); self.df.loc[mask, col] = self.df.loc[mask, col].astype(str).str.strip()` |
| **Effort** | 10 min |
| **Acceptance** | After `strip_whitespace()`, NaN values remain as NaN (not string `"nan"`). |

### P3-04 · Fix `cleaner.py` `new_columns` always returning `[]`

| Field | Value |
|-------|-------|
| **Severity** | 🟠 High |
| **File** | `backend/cleaner.py` L401 |
| **Issue** | Compares `self.df.columns` against itself. Always empty. |
| **Fix** | Save original columns in `__init__`: `self._original_columns = list(df.columns)`. Then: `"new_columns": [c for c in self.df.columns if c not in self._original_columns]`. Apply the same fix to `DataCleaner.result()` (L222 area). |
| **Effort** | 15 min |
| **Acceptance** | After `one_hot_encode(["category"])`, `result()["new_columns"]` includes the new dummy columns. |

### P3-05 · Fix `ai_narrative.py` format crash on missing rows

| Field | Value |
|-------|-------|
| **Severity** | 🟠 High |
| **File** | `backend/ai_narrative.py` L73 |
| **Issue** | `{basic.get('rows', '?'):,}` crashes with `ValueError` when `rows` is missing (the `'?'` string can't be `,`-formatted). |
| **Fix** | Use a helper: `rows = basic.get('rows', 0)` then `f"- Rows: {rows:,}" if isinstance(rows, (int, float)) else f"- Rows: {rows}"`. Or simpler: just default to `0` instead of `'?'`. |
| **Effort** | 10 min |
| **Acceptance** | `generate_narrative({})` returns `None` gracefully (no crash). |

### P3-06 · Fix `ai_cleaning.py` format crash on missing rows

| Field | Value |
|-------|-------|
| **Severity** | 🟠 High |
| **File** | `backend/ai_cleaning.py` L88 |
| **Issue** | Same `:,` format spec crash as ai_narrative. |
| **Fix** | Same approach: default to `0` or guard with `isinstance` check. |
| **Effort** | 5 min |
| **Acceptance** | `generate_cleaning_suggestions({})` returns empty list (no crash). |

### P3-07 · Fix `ai_cleaning.py` rule-based suggestion keys

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **File** | `backend/ai_cleaning.py` L149-159 |
| **Issue** | Suggestions produce `impute_categorical` key that doesn't map to any `DataCleaner` method. |
| **Fix** | Map to actual cleaner methods. For numeric: `{"impute_mean_columns": [col_name]}`. For categorical: `{"impute_mode_columns": [col_name]}`. Match the actual parameter names in `DataCleaner`. |
| **Effort** | 15 min |
| **Acceptance** | Generated suggestion bodies can be POST-ed to `/clean` without errors. |

### P3-08 · Fix `ai_cleaning.py` premature suggestion cap

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **File** | `backend/ai_cleaning.py` L160-161 |
| **Issue** | `len(suggestions) >= 3` break counts all suggestion types together, suppressing outlier/type-cast suggestions. |
| **Fix** | Move the `break` to only apply within the missing-data loop. Or use separate counters per suggestion category. |
| **Effort** | 10 min |
| **Acceptance** | A dataset with duplicates, missing values, outliers, and type suggestions returns all 4 types. |

### P3-09 · Fix `export_utils.py` `None` stat formatting crash

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **File** | `backend/export_utils.py` L101-104 |
| **Issue** | `:.4f` on `None` values raises `TypeError`. |
| **Fix** | Guard each stat: `f"- Mean: {stats['mean']:.4f}" if stats.get('mean') is not None else "- Mean: N/A"`. Or use a helper: `def fmt(v): return f"{v:.4f}" if v is not None else "N/A"`. |
| **Effort** | 10 min |
| **Acceptance** | A dataset where one column is all-null exports to markdown without errors. |

### P3-10 · Fix `ColumnComparison` correlation on misaligned arrays

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **File** | `frontend/src/components/ColumnComparison.tsx` L29-44 |
| **Issue** | Each column's nulls are dropped independently, producing misaligned pairs. Correlation result is incorrect. |
| **Fix** | Filter both columns together: only include rows where both values are non-null. Before computing correlation, create paired arrays from the same row indices. |
| **Effort** | 20 min |
| **Acceptance** | Comparing two columns with different null patterns produces the same correlation as pandas `.corr()`. |

### P3-11 · Fix `ColumnComparison` division by zero

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **File** | `frontend/src/components/ColumnComparison.tsx` L44 |
| **Issue** | When all values are identical, `Math.sqrt(den1 * den2)` = 0, producing NaN. |
| **Fix** | Guard: `if (den1 === 0 || den2 === 0) correlation = 0;` (constant values have no linear relationship). |
| **Effort** | 5 min |
| **Acceptance** | Comparing two constant-value columns shows correlation = 0 (not NaN). |

### P3-12 · Fix billing credits reset on every subscription update

| Field | Value |
|-------|-------|
| **Severity** | 🟠 High |
| **File** | `backend/routers/billing.py` L217-226 |
| **Issue** | `ai_credits_used` reset to 0 on every `subscription.updated` event (payment changes, renewals). Infinite free credits. |
| **Fix** | Only reset credits on plan *changes* (compare `org.plan` vs new `plan`). On same-plan updates, skip the reset: `if org.plan != plan: values["ai_credits_used"] = 0`. |
| **Effort** | 15 min |
| **Acceptance** | Updating a payment method doesn't reset AI credits. Upgrading from free→pro does reset them. |

### P3-13 · Fix Clerk webhook role mapping

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **File** | `backend/routers/webhooks.py` L95 |
| **Issue** | Clerk sends roles like `org:admin`; app expects `admin`. |
| **Fix** | Add a mapping function: `CLERK_ROLE_MAP = {"org:admin": "admin", "org:member": "editor", "admin": "admin", "basic_member": "viewer"}`. Use: `role = CLERK_ROLE_MAP.get(data.get("role", ""), "viewer")`. |
| **Effort** | 10 min |
| **Acceptance** | A Clerk webhook with `role: "org:admin"` creates an `OrgMember` with `role="admin"`. |

### P3-14 · Add idempotency check to membership webhook

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **File** | `backend/routers/webhooks.py` L97-103 |
| **Issue** | Replayed `organizationMembership.created` webhook crashes with `IntegrityError` (duplicate unique constraint). |
| **Fix** | Before inserting, check if membership exists: `existing = await db.execute(select(OrgMember).where(OrgMember.org_id == org.id, OrgMember.user_id == user.id))`. If exists, update role instead of inserting. |
| **Effort** | 15 min |
| **Acceptance** | Replaying the same membership webhook twice doesn't crash — second time updates the role. |

### P3-15 · Fix user deletion FK constraint

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **File** | `backend/routers/webhooks.py` L76, `backend/db/models.py` L132 |
| **Issue** | `Dataset.created_by` FK has no `ondelete` clause. Hard-deleting a user with datasets fails. |
| **Fix** | Add `ondelete="SET NULL"` to the FK and make it nullable: `created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)`. Generate an Alembic migration. |
| **Effort** | 20 min |
| **Acceptance** | Deleting a user via webhook succeeds; their datasets show `created_by=NULL`. |

### P3-16 · Add R2 download caching in datasets router

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **File** | `backend/routers/datasets.py` L98-109 |
| **Issue** | Every API call (visualize, stats, query, export, chat) re-downloads the full dataset from R2. Massive performance hit and egress cost. |
| **Fix** | Add an in-process LRU cache: `from functools import lru_cache` + `@lru_cache(maxsize=32)` on `_load_polars_from_r2(file_key, file_format)`. Since file_key is immutable (tied to dataset version), caching is safe. For memory control, use a size-aware cache that evicts when total bytes exceeds a threshold. |
| **Effort** | 45 min |
| **Acceptance** | Second call to `GET /datasets/{id}/visualize/col` is 10x+ faster than first call. |

---

## Phase 4 — Feature Completeness (SaaS Essentials)

> **Goal:** Billing works, multi-tenancy works, all advertised features function.
> **Estimated effort:** 12–16 hours
> **Depends on:** Phase 0–3.

### P4-01 · Implement `invoice.payment_failed` handler

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **File** | `backend/routers/billing.py` L197-199 |
| **Issue** | Stub — failed payments never downgrade plans. Revenue leak. |
| **Fix** | On payment failure: set `org.plan_status = "past_due"` (add column to model). After 7 days of past-due, downgrade to free. Add a Celery beat task that checks for past-due orgs daily. |
| **Effort** | 1.5 hours |
| **Acceptance** | After a simulated `invoice.payment_failed` event, the org is marked past-due. After grace period, plan reverts to free. |

### P4-02 · Make Stripe API calls async

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **File** | `backend/routers/billing.py` L120-131, 143-148 |
| **Issue** | Synchronous `stripe.Customer.create`, `stripe.checkout.Session.create` block the async event loop. |
| **Fix** | Run in thread executor: `await asyncio.to_thread(stripe.Customer.create, ...)` or use `stripe`'s async client if available in the installed version. |
| **Effort** | 30 min |
| **Acceptance** | Under load testing (10 concurrent checkout requests), no request timeout. |

### P4-03 · Implement real multi-tenancy on frontend

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **Files** | `frontend/src/app/settings/page.tsx` L423, `frontend/src/components/UserDashboard.tsx` L499, multiple pages |
| **Issue** | `orgId = "default"` is hardcoded everywhere. All users share one org. |
| **Fix** | Use Clerk's `useOrganization()` hook to get the active org ID. Create a React context `OrgProvider` that exposes `orgId`. Replace all hardcoded `"default"` with the context value. Fallback to `"default"` only when no org is active. |
| **Effort** | 2 hours |
| **Acceptance** | Switching Clerk orgs shows different datasets for each org. |

### P4-04 · Wire up dataset-scoped cleaning & transform endpoints

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **Files** | `frontend/src/lib/api.ts` L117-125, `frontend/src/components/dashboard/CleaningSection.tsx`, `TransformSection.tsx` |
| **Issue** | `cleanDataset` and `transformColumn` use legacy `/clean` and `/transform` endpoints. No dataset-scoped versions exist for cloud-stored datasets. |
| **Fix** | **Backend:** Add `POST /datasets/{dataset_id}/clean` and `POST /datasets/{dataset_id}/transform` to `routers/datasets.py` (download from R2, apply operations, re-upload, re-analyze). **Frontend:** Update `cleanDataset(datasetId, orgId, operations)` and `transformColumn(datasetId, orgId, params)` in `api.ts`. Pass `datasetId`/`orgId` props into `CleaningSection` and `TransformSection`. |
| **Effort** | 2 hours |
| **Acceptance** | In the authenticated dashboard, cleaning a cloud-stored dataset returns updated results. |

### P4-05 · Wire up dataset-scoped column visualization

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **Files** | `frontend/src/lib/api.ts` L106-115, `frontend/src/components/dashboard/ColumnCard.tsx` L63 |
| **Issue** | `fetchColumnVisualization` has no `datasetId` param — only works for in-memory legacy mode. |
| **Fix** | Add `datasetId` and `orgId` params to the function. Route to `/datasets/${datasetId}/visualize/${columnName}?org_id=${orgId}` when `datasetId` is present; fall back to legacy `/visualize/${columnName}` when not. Pass `datasetId` prop into `ColumnCard`. |
| **Effort** | 30 min |
| **Acceptance** | In the authenticated dashboard, clicking "Show Chart" on a column card shows a Plotly chart for cloud datasets. |

### P4-06 · Implement team invitations

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **File** | `frontend/src/app/settings/page.tsx` L183-193 |
| **Issue** | Invite member input is permanently `disabled`. No actual invite flow. |
| **Fix** | Use Clerk's `useOrganization().organization.inviteMember()` API to send invitations. Enable the input. Add a "Pending Invitations" list from Clerk's `organization.getInvitations()`. |
| **Effort** | 1 hour |
| **Acceptance** | Typing an email and clicking "Invite" sends a Clerk invitation email. The invitee appears in the team list after accepting. |

### P4-07 · Make connectors async (Google Sheets, S3, REST API)

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **Files** | `backend/connectors/google_sheets.py`, `s3_connector.py`, `rest_api.py` |
| **Issue** | All functions are synchronous — they block the async event loop in FastAPI. |
| **Fix** | Wrap each sync call with `await asyncio.to_thread(sync_function, ...)` in the router layer, OR convert the connectors to use `httpx.AsyncClient` (for Sheets/REST) and `aioboto3` (for S3). |
| **Effort** | 2 hours |
| **Acceptance** | Under concurrent requests, connector operations don't block other API calls. |

### P4-08 · Fix `integrations.py` — use async ORM instead of raw psycopg2

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **File** | `backend/routers/integrations.py` L133-149 |
| **Issue** | Uses blocking `psycopg2` inside an async handler. Blocks event loop and bypasses ORM. |
| **Fix** | Accept `db: AsyncSession = Depends(get_db)` as a dependency. Use the ORM `Dataset` model to create the row: `dataset = Dataset(id=dataset_id, org_id=resolve_org_id(org_id), created_by=DEFAULT_USER_ID, ...)`. |
| **Effort** | 30 min |
| **Acceptance** | GitHub webhook creates a dataset using the async ORM session. |

### P4-09 · Add Pydantic request models to routers

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **Files** | All routers using `body: dict = Body(...)` |
| **Issue** | No schema validation on request bodies. Missing fields produce `KeyError` 500s instead of 422. No OpenAPI docs for request shapes. |
| **Fix** | Create Pydantic `BaseModel` classes for each endpoint's body (e.g., `CreateConnectorRequest`, `CreateMonitorRequest`, `CreatePipelineRequest`, `WriteAuditLogRequest`). Replace `body: dict = Body(...)` with typed params. |
| **Effort** | 2 hours |
| **Acceptance** | `/docs` Swagger page shows full request schemas. Invalid requests return 422 with field-level errors. |

### P4-10 · Add cron expression validation to monitors and pipelines

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **Files** | `backend/routers/monitors.py` L102, `pipelines.py` L92 |
| **Issue** | Invalid cron strings are silently saved and silently skipped at runtime. |
| **Fix** | Validate with `croniter.is_valid(schedule)` before saving. Return 400 if invalid. |
| **Effort** | 15 min |
| **Acceptance** | `POST /monitors` with `schedule: "not a cron"` returns 400 with clear error message. |

### P4-11 · Add column name validation to monitor creation

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **File** | `backend/routers/monitors.py` L83-102, `frontend/src/components/MonitorCreateModal.tsx` L55 |
| **Issue** | `null_rate` and `column_drift` monitors can be created without a `column_name`. |
| **Fix** | **Backend:** If `check_type in ("null_rate", "column_drift")` and `column_name` is empty, return 400. **Frontend:** Add `if (needsColumn && !columnName.trim()) return;` to the validation in `MonitorCreateModal`. |
| **Effort** | 15 min |
| **Acceptance** | Creating a `null_rate` monitor without a column returns 400 on backend and is blocked on frontend. |

### P4-12 · Fix pipeline version increment race condition

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **File** | `backend/routers/pipelines.py` L139-140 |
| **Issue** | Concurrent updates read the same version, both increment to the same value → `IntegrityError`. |
| **Fix** | Use `UPDATE ... SET version = version + 1 RETURNING version` via raw SQL, or lock the row with `with_for_update()` on the select. |
| **Effort** | 20 min |
| **Acceptance** | Two simultaneous PATCH requests to the same pipeline both succeed with different version numbers. |

### P4-13 · Fix `AIChatPanel` stale chat history

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **File** | `frontend/src/components/AIChatPanel.tsx` L46-49 |
| **Issue** | The `history` array doesn't include the just-added user message (React state batching). |
| **Fix** | Build history inside `send()` by appending the new user message manually: `const fullHistory = [...history, { role: "user", content: input }]`. Pass `fullHistory` to `askDataset()`. |
| **Effort** | 10 min |
| **Acceptance** | In a multi-turn chat, the AI's response correctly references the previous message. |

### P4-14 · Fix streaming chat credit consumption on failure

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **File** | `backend/routers/datasets.py` L427-428 |
| **Issue** | Credits consumed upfront for streaming; no refund if stream fails. |
| **Fix** | Wrap in try/catch: if the stream generator raises before completing, refund the credits: `await refund_credits(org_id, cost=CREDIT_COSTS["chat"], db=db)`. Add a `refund_credits` helper to `ai_credits.py`. |
| **Effort** | 20 min |
| **Acceptance** | If the AI stream errors out, the user's credit balance is restored. |

---

## Phase 5 — Frontend Polish & UX

> **Goal:** Consistent design, working dark mode, responsive layouts, correct behaviors.
> **Estimated effort:** 8–10 hours
> **Can be parallelized heavily. No backend dependencies.**

### P5-01 · Add dark mode support across all components

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **Files** | `UserDashboard.tsx`, `LoadingSkeleton.tsx`, `ErrorBoundary.tsx`, `KeyboardShortcuts.tsx`, `Navbar.tsx`, `plotly-theme.ts`, all inline-styled pages |
| **Issue** | ThemeToggle exists but almost no `dark:` classes or theme-aware inline styles. Dark mode is visually broken. |
| **Fix** | **Approach 1 (quick):** Use CSS variables defined in `globals.css` `:root` / `.dark` blocks. Replace all hardcoded colors in inline styles with `var(--color-surface)`, `var(--color-text)`, etc. **Approach 2 (thorough):** Convert inline styles to Tailwind classes with `dark:` variants. For Plotly charts, make `plotly-theme.ts` export a function that reads the current theme and returns the appropriate layout. |
| **Effort** | 3 hours |
| **Acceptance** | Toggle dark mode → all pages render correctly with dark backgrounds and light text. No white flashes or invisible text. |

### P5-02 · Fix `?` keyboard shortcut firing in inputs

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **File** | `frontend/src/components/KeyboardShortcuts.tsx` L12-14 |
| **Issue** | `?` shortcut prevents character typing inside inputs/textareas. |
| **Fix** | Add guard: `if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) return;` |
| **Effort** | 5 min |
| **Acceptance** | Typing `?` in the SQL editor or search box works normally. Pressing `?` outside inputs opens the help modal. |

### P5-03 · Fix CommandPalette: Export PDF no-op + missing sections

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **File** | `frontend/src/components/CommandPalette.tsx` L71-104 |
| **Issue** | "Export PDF" selector `[aria-label*="Export"]` never matches. Only 6 of 14 sections are accessible. |
| **Fix** | **Export:** Add `aria-label="Export PDF"` to the `ExportButton` component's `<Button>`. **Sections:** Add command entries for all 14 sections: `statistics`, `sql`, `cleaning`, `transforms`, `monitors`, `report`, `comments`, `visualizations`. |
| **Effort** | 20 min |
| **Acceptance** | ⌘K → "Export" triggers PDF export. All 14 sections are searchable/navigable. |

### P5-04 · Fix CommentsSection author hardcoding

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **File** | `frontend/src/components/dashboard/CommentsSection.tsx` L232, 249 |
| **Issue** | Author name hardcoded as `"You"` instead of real Clerk user name. |
| **Fix** | Accept `userName` prop (from `useUser().user?.fullName`). Pass it in: `{ author_name: userName || "Anonymous" }`. |
| **Effort** | 10 min |
| **Acceptance** | New comments show the user's actual name. Other users see the commenter's name, not "You". |

### P5-05 · Fix CommentsSection edit/delete authorization

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **File** | `frontend/src/components/dashboard/CommentsSection.tsx` |
| **Issue** | Any user can edit/delete any comment. No ownership check. |
| **Fix** | Accept `currentUserId` prop. Only show edit/delete buttons when `comment.user_id === currentUserId`. |
| **Effort** | 15 min |
| **Acceptance** | Edit/delete buttons only appear on your own comments. |

### P5-06 · Fix ConnectorModal: leak on test failure + duplicate on save

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **File** | `frontend/src/components/ConnectorModal.tsx` L131-161 |
| **Issue** | Connector leaked on test failure (deleteConnector not called). Test+Save creates a duplicate. |
| **Fix** | Track `createdId` in state. In `handleTest`, store the created ID. In `handleSave`, skip `createConnector` if `createdId` is already set. In the catch block, always attempt cleanup: `if (createdId) await deleteConnector(createdId, orgId)`. |
| **Effort** | 20 min |
| **Acceptance** | Test connection failure → no orphaned connector in DB. Test → Save → only one connector created. |

### P5-07 · Fix MonitoringSection: refresh runs after trigger

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **File** | `frontend/src/components/dashboard/MonitoringSection.tsx` L128-133 |
| **Issue** | After triggering a run, the run history doesn't refresh. |
| **Fix** | Add `await loadRuns()` in the `finally` block of `handleRun`. |
| **Effort** | 5 min |
| **Acceptance** | After clicking "Run Now", the new run appears in the history list. |

### P5-08 · Add `og-image.png` to public directory

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **File** | `frontend/public/og-image.png` (missing) |
| **Issue** | Referenced in `layout.tsx` OpenGraph metadata but doesn't exist. Social sharing previews broken. |
| **Fix** | Design and add a 1200×630 OG image. Can be a simple branded card with the Sushi logo and tagline. |
| **Effort** | 30 min |
| **Acceptance** | Sharing a page link on Twitter/LinkedIn shows the correct preview image. |

### P5-09 · Fix compare page design system mismatch

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Low |
| **File** | `frontend/src/app/compare/page.tsx` |
| **Issue** | Uses `bg-slate-50`, `text-slate-900` — completely different from the warm beige/neutral palette of the rest of the app. |
| **Fix** | Replace Tailwind slate classes with the app's design tokens (`bg-[#f0eee9]`, `text-[#111010]`, etc.) or CSS variables. |
| **Effort** | 30 min |
| **Acceptance** | Compare page visually matches the main dashboard's color scheme. |

### P5-10 · Make UserDashboard responsive and fix fake onboarding

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Low |
| **Files** | `frontend/src/components/UserDashboard.tsx` L368-377, L753 |
| **Issue** | Grid hardcoded to 3 columns (no responsive). Getting Started widget never progresses. |
| **Fix** | **Grid:** Use `gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))"`. **Onboarding:** Track completed steps in `localStorage` (keyed by user ID). Mark steps done when the user actually performs them (upload, open stats, run SQL, etc.). Expose an `onStepComplete(stepId)` callback. |
| **Effort** | 1 hour |
| **Acceptance** | Dashboard grid adapts on mobile. Completing a step marks it green permanently. |

### P5-11 · Fix LandingPage footer dead links

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Low |
| **File** | `frontend/src/components/LandingPage.tsx` L152-155 |
| **Issue** | Privacy, Terms, Docs links all go to `#`. |
| **Fix** | Link to actual pages: `/docs`, `/docs/privacy`, `/docs/terms`. Create minimal placeholder pages or link to external URLs. |
| **Effort** | 20 min |
| **Acceptance** | All footer links navigate to real pages (not `#`). |

### P5-12 · Fix `UpgradeModal` and `CreditsUsageBar` navigation

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Low |
| **Files** | `frontend/src/components/UpgradeModal.tsx` L58-63, `CreditsUsageBar.tsx` L43-51 |
| **Issue** | Uses `<a href="/pricing">` instead of Next.js `<Link>` — causes full page reload. |
| **Fix** | Import `Link` from `next/link` and replace `<a>` tags. |
| **Effort** | 5 min |
| **Acceptance** | Clicking "Upgrade" navigates without a full page reload. |

### P5-13 · Fix CommandPalette platform-specific shortcut label

| Field | Value |
|-------|-------|
| **Severity** | 🟢 Low |
| **File** | `frontend/src/components/CommandPalette.tsx` L109 |
| **Issue** | Always shows `⌘K` even on Windows/Linux. |
| **Fix** | Detect platform: `const isMac = navigator.platform.includes('Mac')`. Show `⌘K` on Mac, `Ctrl+K` otherwise. |
| **Effort** | 5 min |
| **Acceptance** | On Windows, the hint shows `Ctrl+K`. On Mac, `⌘K`. |

### P5-14 · Fix `OnboardingChecklist` potential infinite loop

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Low |
| **File** | `frontend/src/components/OnboardingChecklist.tsx` L74-84 |
| **Issue** | `done` is both a dependency and mutated in the same `useEffect`. |
| **Fix** | Use a ref to track the previous `done` set and only call `setDone` if there's an actual change. Or use `useRef` for `done` and only sync to state on real changes. |
| **Effort** | 15 min |
| **Acceptance** | React DevTools shows no excessive re-renders on the dashboard page. |

### P5-15 · Fix `SQLQuerySection` history dependency causing re-renders

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Low |
| **File** | `frontend/src/components/dashboard/SQLQuerySection.tsx` L142-166 |
| **Issue** | `history` in `useCallback` deps causes new `handleRun` ref on every history change. |
| **Fix** | Use functional state update: `setHistory(prev => [entry, ...prev.filter(h => h.sql !== sql.trim())])` — then remove `history` from the dependency array. |
| **Effort** | 10 min |
| **Acceptance** | Running a query doesn't cause unnecessary re-renders in the query section. |

---

## Phase 6 — Integrations, CLI & Extension

> **Goal:** All advertised integrations actually work.
> **Estimated effort:** 6–8 hours
> **Can be parallelized — each integration is independent.**

### P6-01 · Fix Slack bot: async calls + org resolution

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **Files** | `backend/routers/slack_bot.py` |
| **Issue** | Synchronous `httpx` blocks event loop. `org_id` hardcoded to `"default"`. |
| **Fix** | Convert to `httpx.AsyncClient`. Add a Slack workspace → org_id mapping table (or use the `DataConnector` model with `connector_type="slack"`). Look up org from `team_id` in the event/command payload. |
| **Effort** | 1.5 hours |
| **Acceptance** | `/sushi analyze` in Slack returns the latest analysis for the correct org. No event loop blocking under load. |

### P6-02 · Fix integrations page: webhook URL + "Notify me" button

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **File** | `frontend/src/app/integrations/page.tsx` L158-160, L416-425 |
| **Issue** | Webhook URL hardcodes `:8000` port (wrong in prod). "Notify me" button has no handler. |
| **Fix** | Use `NEXT_PUBLIC_API_URL` for webhook URL display. For "Notify me": either add a simple `POST /api/waitlist` endpoint that stores the email, or remove the button if the Chrome extension isn't launching yet. |
| **Effort** | 30 min |
| **Acceptance** | Displayed webhook URLs match the production API domain. |

### P6-03 · Fix Chrome extension popup CORS issue

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Medium |
| **File** | `chrome-extension/popup.js` L79 |
| **Issue** | `fetch()` from popup context may be blocked by CORS. Should use background service worker. |
| **Fix** | Move the download logic to `background.js` via `chrome.runtime.sendMessage()`. The service worker has broader host permissions for cross-origin fetches. |
| **Effort** | 30 min |
| **Acceptance** | Clicking "Analyze" on a CSV link in the popup downloads the file and uploads it to the backend without CORS errors. |

### P6-04 · Remove dead CLI reference from integrations page

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Low |
| **File** | `frontend/src/app/integrations/page.tsx` L308-310 |
| **Issue** | References `sushi-eda-cli` package that doesn't exist on PyPI. |
| **Fix** | Either publish the CLI package to PyPI (the code exists in `cli/`), or change the instructions to `pip install -e ./cli` for local development, or mark the section as "Coming Soon". |
| **Effort** | 15 min (if marking as coming soon) / 2 hours (if publishing to PyPI) |
| **Acceptance** | CLI installation instructions point to a real, installable package. |

### P6-05 · Fix `background.js` no-op URL replace

| Field | Value |
|-------|-------|
| **Severity** | 🟢 Low |
| **File** | `chrome-extension/background.js` L62 |
| **Issue** | `.replace("api.", "")` is a no-op since `APP_URL` doesn't contain `"api."`. |
| **Fix** | Remove the replace call, or use a dedicated `DASHBOARD_URL` constant. |
| **Effort** | 5 min |
| **Acceptance** | After uploading from the extension, the tab opens the correct dashboard URL. |

### P6-06 · Remove dead `tableToRows` function from popup.js

| Field | Value |
|-------|-------|
| **Severity** | 🟢 Low |
| **File** | `chrome-extension/popup.js` L93-103 |
| **Issue** | Dead code — function defined but never called. |
| **Fix** | Delete the function. |
| **Effort** | 2 min |
| **Acceptance** | Extension still works. No dead code in popup.js. |

---

## Phase 7 — Operational Readiness

> **Goal:** Logging, monitoring, documentation, and infra are production-grade.
> **Estimated effort:** 4–6 hours

### P7-01 · Add audit log IP address capture

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Low |
| **File** | `backend/routers/admin.py` L102-112 |
| **Issue** | `ip_address` never captured in audit logs — always `None`. |
| **Fix** | Accept `Request` as a FastAPI dependency and extract IP: `ip = request.client.host if request.client else None`. Pass to `AuditLog(ip_address=ip, ...)`. |
| **Effort** | 10 min |
| **Acceptance** | Audit log entries show the client's IP address. |

### P7-02 · Add self-demotion and last-admin guard

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Low |
| **File** | `backend/routers/admin.py` L145-198 |
| **Issue** | Admin can demote/remove themselves, potentially locking the entire org out. |
| **Fix** | Before role change/removal, count remaining admins: `admin_count = await db.execute(select(func.count()).where(OrgMember.org_id == org_id, OrgMember.role == "admin"))`. If count <= 1 and target is the current user with role change away from admin, return 400. |
| **Effort** | 20 min |
| **Acceptance** | Last admin trying to demote themselves gets a clear error message. |

### P7-03 · Fix `AuditLog.extra` column/attribute name mismatch

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Low |
| **File** | `backend/db/models.py` L416 |
| **Issue** | `key="metadata"` swaps the Python attribute name. Code accessing `audit_log.extra` gets `AttributeError`. |
| **Fix** | Remove `key="metadata"` and rename the column to `metadata` directly: `metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)`. Or if the DB column must stay `extra`: keep the assignment name as `extra` and remove the `key=` param. Generate an Alembic migration if renaming the column. |
| **Effort** | 15 min |
| **Acceptance** | `audit_log.extra` (or `audit_log.metadata`) returns the JSONB data correctly. |

### P7-04 · Add pagination to list endpoints

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Low |
| **Files** | `backend/routers/connectors.py`, `monitors.py`, `pipelines.py` |
| **Issue** | List endpoints return all records with no limit. |
| **Fix** | Add `limit: int = Query(default=50, le=200)` and `offset: int = Query(default=0, ge=0)` to each list endpoint. Apply `.limit(limit).offset(offset)` to queries. Return `{"items": [...], "total": count, "limit": limit, "offset": offset}`. |
| **Effort** | 30 min |
| **Acceptance** | `GET /connectors?limit=10&offset=0` returns at most 10 items with a total count. |

### P7-05 · Add unbounded `_analysis_cache` eviction

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Low |
| **File** | `backend/main.py` L188 |
| **Issue** | In-memory cache grows forever — memory leak in production. |
| **Fix** | Use `functools.lru_cache` or a custom dict with max size (e.g., 100 entries). Alternatively, since Redis caching exists, remove the in-memory cache for the legacy endpoints entirely and rely on Redis. |
| **Effort** | 15 min |
| **Acceptance** | After 150 unique uploads, the oldest entries are evicted. Memory usage stays bounded. |

### P7-06 · Fix `jobs.py` synchronous Redis in async generator

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Low |
| **File** | `backend/routers/jobs.py` L73-76, L57, L82 |
| **Issue** | Synchronous Redis `pubsub.get_message()` and `cache.get_job_status()` block the async event loop. |
| **Fix** | Run in executor: `message = await asyncio.to_thread(pubsub.get_message, timeout=0.1)` and `current = await asyncio.to_thread(cache.get_job_status, dataset_id)`. |
| **Effort** | 20 min |
| **Acceptance** | Under 50 concurrent SSE streams, the event loop remains responsive (other endpoints respond in <100ms). |

### P7-07 · Fix N+1 query in `comments.py` `list_comments`

| Field | Value |
|-------|-------|
| **Severity** | 🟡 Low |
| **File** | `backend/routers/comments.py` L123-129 |
| **Issue** | Each top-level comment fires a separate DB query for replies. 100 comments = 101 queries. |
| **Fix** | Fetch all comments in one query (including replies), then structure in Python: `all_comments = await db.execute(select(DatasetComment).where(...).order_by(...))`. Group by `parent_id` in a dict. |
| **Effort** | 20 min |
| **Acceptance** | Loading 100 comments with replies generates ≤ 2 DB queries (not 101). |

### P7-08 · Clean up temporary `tmpclaude-*` files

| Field | Value |
|-------|-------|
| **Severity** | 🟢 Low |
| **File** | Root directory, `frontend/` |
| **Issue** | ~30 `tmpclaude-*` files in the repo root and `frontend/` — leftover Claude temp files. |
| **Fix** | Delete all `tmpclaude-*` files. Add `tmpclaude-*` to `.gitignore`. |
| **Effort** | 5 min |
| **Acceptance** | No `tmpclaude-*` files in the repo. Pattern is in `.gitignore`. |

### P7-09 · Remove unused `INET` import from models.py

| Field | Value |
|-------|-------|
| **Severity** | 🟢 Trivial |
| **File** | `backend/db/models.py` L33 |
| **Issue** | `INET` imported but never used. |
| **Fix** | Remove `INET` from the import line. |
| **Effort** | 1 min |
| **Acceptance** | No linter warnings for unused imports. |

---

## Dependency Graph

```
Phase 0 (App Starts)
  ├── all 14 tasks (independent, parallelizable)
  │
  ▼
Phase 1 (Security)          Phase 2 (Core Flow)
  ├── P1-01..P1-10           ├── P2-01 (depends on P1-07)
  │   (independent)          ├── P2-02..P2-07 (independent)
  │                          │
  ▼                          ▼
Phase 3 (Data Integrity)
  ├── P3-01..P3-16 (mostly independent)
  │   P3-01 depends on defaults.py _ensure_default_org
  │   P3-15 requires Alembic migration
  │
  ▼
Phase 4 (Feature Complete)        Phase 5 (Polish)
  ├── P4-01..P4-14                ├── P5-01..P5-15
  │   P4-03 enables P4-04,05     │   (all independent,
  │   P4-04 depends on P0-02     │    parallelizable)
  │   P4-09 is cross-cutting     │
  │                               │
  ▼                               ▼
Phase 6 (Integrations)       Phase 7 (Ops)
  ├── P6-01..P6-06              ├── P7-01..P7-09
  │   (all independent)         │   (all independent)
```

---

## Estimated Total Effort

| Phase | Tasks | Effort | Can Parallelize? |
|-------|-------|--------|------------------|
| **Phase 0** — App Starts | 14 | 2–3 hrs | ✅ Fully |
| **Phase 1** — Security | 10 | 4–6 hrs | ✅ Mostly |
| **Phase 2** — Core Flow | 7 | 6–8 hrs | ⚠️ P2-01 depends on P1-07 |
| **Phase 3** — Data Integrity | 16 | 8–10 hrs | ✅ Mostly |
| **Phase 4** — Feature Complete | 14 | 12–16 hrs | ⚠️ Some deps |
| **Phase 5** — Polish | 15 | 8–10 hrs | ✅ Fully |
| **Phase 6** — Integrations | 6 | 6–8 hrs | ✅ Fully |
| **Phase 7** — Ops | 9 | 4–6 hrs | ✅ Fully |
| **Total** | **91 tasks** | **50–67 hrs** | |

### With a 2-person team:
- **Week 1:** Phase 0 + Phase 1 + Phase 2 (critical path)
- **Week 2:** Phase 3 + Phase 4 (core fixes + features)
- **Week 3:** Phase 5 + Phase 6 + Phase 7 (polish + integrations + ops)
- **Buffer:** 1 week for testing, edge cases, and deployment

### With a solo developer:
- **Week 1–2:** Phase 0 + 1 + 2
- **Week 3–4:** Phase 3 + 4
- **Week 5–6:** Phase 5 + 6 + 7
- **Buffer:** 1 week

---

## Pre-Launch Checklist

After all phases are complete:

- [ ] Run `python -c "from main import app"` — no import errors
- [ ] Run `pytest` (add basic test suite if none exists)
- [ ] Run `npm run build` in `frontend/` — no TS errors
- [ ] Run `docker-compose up --build` — all 5 services start
- [ ] Test full flow: sign up → upload CSV → watch progress → view report → export
- [ ] Test billing: Stripe test mode checkout → webhook → plan upgrade
- [ ] Test sharing: create share link → open in incognito → report loads
- [ ] Test connectors: Postgres → preview → import → analyze
- [ ] Test monitors: create → trigger → check runs
- [ ] Test AI chat: ask a question → get SQL + answer
- [ ] Lighthouse audit: performance ≥ 80, accessibility ≥ 90
- [ ] Security scan: `npm audit`, `pip-audit`, OWASP ZAP quick scan
- [ ] Set all production env vars (see README)
- [ ] Verify Sentry captures errors
- [ ] Verify Redis is reachable and caching works
- [ ] Verify R2 upload/download works
- [ ] DNS + SSL configured for custom domain
- [ ] Social preview: share URL on Twitter → og-image appears

---

*Plan generated from full codebase audit. Each task ID (P0-01, P1-01, etc.) can be used as a branch name or ticket ID.*