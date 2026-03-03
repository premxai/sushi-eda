-- ============================================================
-- Sushi EDA — Supabase PostgreSQL Schema
-- Run this in the Supabase SQL Editor to bootstrap the DB.
-- ============================================================

-- Enable UUID extension (enabled by default on Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── organizations ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    slug            TEXT UNIQUE NOT NULL,
    plan            TEXT NOT NULL DEFAULT 'free',       -- free | pro | team | enterprise
    stripe_customer_id      TEXT,
    stripe_subscription_id  TEXT,
    ai_credits_used  INTEGER NOT NULL DEFAULT 0,
    ai_credits_limit INTEGER NOT NULL DEFAULT 10,       -- free tier: 10 AI calls/month
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_id    TEXT UNIQUE NOT NULL,                   -- Clerk user ID (e.g. user_2xyz)
    email       TEXT NOT NULL,
    name        TEXT,
    avatar_url  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── org_members ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL DEFAULT 'viewer',         -- admin | editor | viewer
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, user_id)
);

-- ── datasets ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS datasets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by          UUID NOT NULL REFERENCES users(id),
    name                TEXT NOT NULL,
    original_filename   TEXT NOT NULL,
    file_key            TEXT NOT NULL,                  -- R2/S3 object key
    file_size_bytes     BIGINT NOT NULL,
    file_format         TEXT NOT NULL,                  -- csv | tsv | xlsx | json | parquet | sqlite
    row_count           INTEGER,
    column_count        INTEGER,
    status              TEXT NOT NULL DEFAULT 'pending',-- pending | processing | ready | failed
    error_message       TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_datasets_org_id ON datasets(org_id);
CREATE INDEX IF NOT EXISTS ix_datasets_created_by ON datasets(created_by);

-- ── analyses ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analyses (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id       UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    org_id           UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    version          INTEGER NOT NULL DEFAULT 1,
    report           JSONB NOT NULL,                    -- full EDAReport JSON
    ai_narrative     TEXT,                              -- Claude-generated narrative
    job_id           TEXT,                              -- Celery job ID
    duration_seconds FLOAT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(dataset_id, version)
);

CREATE INDEX IF NOT EXISTS ix_analyses_dataset_id ON analyses(dataset_id);
CREATE INDEX IF NOT EXISTS ix_analyses_org_id ON analyses(org_id);

-- ── monitors ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monitors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id      UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by      UUID NOT NULL REFERENCES users(id),
    name            TEXT NOT NULL,
    check_type      TEXT NOT NULL,          -- row_count | null_rate | quality_score | column_drift
    column_name     TEXT,                   -- null = dataset-level check
    condition       TEXT NOT NULL,          -- lt | gt | eq | change_pct
    threshold       FLOAT NOT NULL,
    schedule        TEXT NOT NULL DEFAULT '0 * * * *',  -- cron expression
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_checked_at TIMESTAMPTZ,
    last_status     TEXT,                   -- ok | triggered | error
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_monitors_org_id ON monitors(org_id);
CREATE INDEX IF NOT EXISTS ix_monitors_dataset_id ON monitors(dataset_id);

-- ── monitor_runs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monitor_runs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitor_id   UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    status       TEXT NOT NULL,             -- ok | triggered | error
    actual_value FLOAT,
    message      TEXT,
    ran_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_monitor_runs_monitor_id ON monitor_runs(monitor_id);

-- ── pipeline_recipes ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_recipes (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id             UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by         UUID NOT NULL REFERENCES users(id),
    source_dataset_id  UUID REFERENCES datasets(id) ON DELETE SET NULL,
    name               TEXT NOT NULL,
    description        TEXT,
    graph              JSONB NOT NULL DEFAULT '{}'::jsonb,  -- nodes + edges
    destination_type   TEXT NOT NULL DEFAULT 'dataset',
    destination_config JSONB,
    schedule           TEXT NOT NULL DEFAULT '0 * * * *',
    is_active          BOOLEAN NOT NULL DEFAULT TRUE,
    version            INTEGER NOT NULL DEFAULT 1,
    last_run_at        TIMESTAMPTZ,
    last_run_status    TEXT,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_pipeline_recipes_org_id ON pipeline_recipes(org_id);
CREATE INDEX IF NOT EXISTS ix_pipeline_recipes_source_dataset_id ON pipeline_recipes(source_dataset_id);

-- ── pipeline_recipe_versions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_recipe_versions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES pipeline_recipes(id) ON DELETE CASCADE,
    version     INTEGER NOT NULL,
    graph       JSONB NOT NULL DEFAULT '{}'::jsonb,
    description TEXT,
    created_by  UUID REFERENCES users(id),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pipeline_id, version)
);

CREATE INDEX IF NOT EXISTS ix_pipeline_recipe_versions_pipeline_id ON pipeline_recipe_versions(pipeline_id);

-- ── pipeline_runs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_runs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id       UUID NOT NULL REFERENCES pipeline_recipes(id) ON DELETE CASCADE,
    org_id            UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    triggered_by      UUID REFERENCES users(id),
    recipe_version    INTEGER NOT NULL,
    trigger_type      TEXT NOT NULL DEFAULT 'manual',      -- manual | schedule
    status            TEXT NOT NULL DEFAULT 'pending',     -- pending | running | success | failed
    logs              TEXT,
    metrics           JSONB,
    output_dataset_id UUID REFERENCES datasets(id) ON DELETE SET NULL,
    started_at        TIMESTAMPTZ,
    finished_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_pipeline_runs_org_id ON pipeline_runs(org_id);
CREATE INDEX IF NOT EXISTS ix_pipeline_runs_pipeline_id ON pipeline_runs(pipeline_id);
CREATE INDEX IF NOT EXISTS ix_pipeline_runs_started_at ON pipeline_runs(started_at);

-- ── audit_logs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id       UUID REFERENCES users(id),
    action        TEXT NOT NULL,            -- upload | analyze | export | delete | invite | query
    resource_type TEXT,                     -- dataset | analysis | monitor | pipeline
    resource_id   UUID,
    metadata      JSONB,
    ip_address    TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_audit_logs_org_id ON audit_logs(org_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at ON audit_logs(created_at);

-- ── Row Level Security (RLS) ──────────────────────────────────────────────────
-- Enable RLS on all tables so that Supabase's auth can enforce org isolation
-- at the DB level, even without app-level filtering.

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitor_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_recipe_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Service-role (backend) bypasses RLS — all policies below are for anon/user JWT access.
-- The FastAPI backend uses the service role key and enforces org_id in code.

-- Allow users to read their own record
CREATE POLICY "users_read_own" ON users
    FOR SELECT USING (clerk_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Datasets: members of the same org can read
CREATE POLICY "datasets_org_read" ON datasets
    FOR SELECT USING (
        org_id IN (
            SELECT om.org_id FROM org_members om
            JOIN users u ON u.id = om.user_id
            WHERE u.clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
        )
    );

-- Analyses: same org restriction
CREATE POLICY "analyses_org_read" ON analyses
    FOR SELECT USING (
        org_id IN (
            SELECT om.org_id FROM org_members om
            JOIN users u ON u.id = om.user_id
            WHERE u.clerk_id = current_setting('request.jwt.claims', true)::json->>'sub'
        )
    );
