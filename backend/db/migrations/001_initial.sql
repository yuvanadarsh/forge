-- Forge initial schema — 13 tables.
-- Run against the `forge` database:  psql -d forge -f 001_initial.sql

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================ agents
CREATE TABLE agents (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    role          TEXT NOT NULL,
    specialty     TEXT NOT NULL DEFAULT '',
    avatar_color  TEXT NOT NULL DEFAULT '#6366f1',
    model         TEXT NOT NULL DEFAULT 'claude-sonnet-4-5',
    system_prompt TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'idle'
                  CHECK (status IN ('idle', 'working', 'error')),
    is_eternal    BOOLEAN NOT NULL DEFAULT false,  -- ships with Forge, cannot be deleted (Atlas)
    last_active   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- tokens_used / cost_usd shown in the UI are aggregated from token_usage,
-- not stored here, so the analytics table stays the single source of truth.

-- ============================================================ api_keys
CREATE TABLE api_keys (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider      TEXT NOT NULL,
    name          TEXT NOT NULL,
    base_url      TEXT,
    encrypted_key TEXT NOT NULL,           -- AES-256-GCM, base64(nonce || ciphertext)
    key_last4     TEXT NOT NULL,           -- lets list endpoints mask without decrypting
    is_default    BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================ settings (single row)
CREATE TABLE settings (
    id                 SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    terminal_execution TEXT NOT NULL DEFAULT 'request_review'
                       CHECK (terminal_execution IN ('always_proceed', 'request_review', 'agent_decides')),
    strict_mode        BOOLEAN NOT NULL DEFAULT false,
    allowed_commands   TEXT[] NOT NULL DEFAULT '{}',
    denied_commands    TEXT[] NOT NULL DEFAULT '{}',
    default_model      TEXT NOT NULL DEFAULT 'claude-sonnet-4-5',
    embedding_model    TEXT NOT NULL DEFAULT 'voyage-3',
    workspace_root     TEXT NOT NULL DEFAULT '~/forge-workspace',
    global_rules       TEXT NOT NULL DEFAULT '',   -- injected into every agent system prompt
    -- Cost protection: the executor stops agents once any ceiling is crossed
    max_run_cost       NUMERIC(8,2) NOT NULL DEFAULT 5.00,   -- max $ per pipeline run
    max_agent_cost     NUMERIC(8,2) NOT NULL DEFAULT 2.00,   -- max $ per agent per run
    max_daily_cost     NUMERIC(8,2) NOT NULL DEFAULT 20.00,  -- max $ across all runs per day
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================ pipelines
CREATE TABLE pipelines (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title          TEXT NOT NULL,
    description    TEXT NOT NULL DEFAULT '',
    status         TEXT NOT NULL DEFAULT 'pending_approval'
                   CHECK (status IN ('pending_approval', 'approved', 'running',
                                     'paused_for_approval', 'completed', 'failed', 'archived')),
    agent_sequence UUID[] NOT NULL DEFAULT '{}',   -- ordered agent ids
    created_by     UUID REFERENCES agents(id) ON DELETE SET NULL,  -- NULL = created by user
    plan_md        TEXT NOT NULL DEFAULT '',
    suggestion_reasoning TEXT,           -- CEO's reasoning when auto-suggested, else NULL
    workspace_path TEXT NOT NULL,
    approved_at    TIMESTAMPTZ,
    archived_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================ pipeline_runs
CREATE TABLE pipeline_runs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id         UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    status              TEXT NOT NULL DEFAULT 'running'
                        CHECK (status IN ('running', 'paused_for_approval', 'approved',
                                          'completed', 'failed', 'cancelled')),
    -- 'approved' is the transient resume signal: gate handlers flip
    -- paused_for_approval -> approved, the orchestrator flips it back to running.
    langgraph_thread_id TEXT NOT NULL,
    current_agent_id    UUID REFERENCES agents(id) ON DELETE SET NULL,
    current_agent_index INTEGER NOT NULL DEFAULT 0,
    error               TEXT,
    started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at        TIMESTAMPTZ
);

-- ============================================================ tasks
CREATE TABLE tasks (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title             TEXT NOT NULL,
    description       TEXT NOT NULL DEFAULT '',
    assigned_to       UUID REFERENCES agents(id) ON DELETE SET NULL,
    priority          TEXT NOT NULL DEFAULT 'med'
                      CHECK (priority IN ('low', 'med', 'high', 'urgent')),
    status            TEXT NOT NULL DEFAULT 'backlog'
                      CHECK (status IN ('backlog', 'in_progress', 'review', 'completed')),
    pipeline_id       UUID REFERENCES pipelines(id) ON DELETE SET NULL,
    created_from_chat BOOLEAN NOT NULL DEFAULT false,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================ conversations
CREATE TABLE conversations (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- NULL agent_id = pipeline-level conversation (shared by all participants)
    agent_id     UUID REFERENCES agents(id) ON DELETE CASCADE,
    task_id      UUID REFERENCES tasks(id) ON DELETE SET NULL,
    pipeline_id  UUID REFERENCES pipelines(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    last_message TEXT,
    last_active  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================ messages
CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    agent_id        UUID REFERENCES agents(id) ON DELETE SET NULL,  -- NULL for user messages
    role            TEXT NOT NULL
                    CHECK (role IN ('user', 'assistant', 'system', 'tool', 'tool_call', 'approval_gate')),
    content         TEXT NOT NULL DEFAULT '',
    sender_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,  -- agent-to-agent relay source
    gate_status     TEXT
                    CHECK (gate_status IN ('pending', 'approved', 'changes_requested')),
    image_data      TEXT,             -- optional attachment: raw base64, no data: prefix
    image_media_type VARCHAR(50),
    input_tokens    INTEGER,
    output_tokens   INTEGER,
    cost_usd        NUMERIC(12, 6),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================ message_images
-- Up to 4 images per message; messages.image_data/image_media_type above are
-- legacy single-image columns kept for backward compatibility (migration 009).
CREATE TABLE message_images (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id   UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    image_data   TEXT NOT NULL,
    media_type   VARCHAR(50) NOT NULL,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_message_images_message_id ON message_images(message_id);

-- ============================================================ token_usage (time series)
CREATE TABLE token_usage (
    id              BIGSERIAL PRIMARY KEY,
    agent_id        UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    pipeline_run_id UUID REFERENCES pipeline_runs(id) ON DELETE SET NULL,
    provider        TEXT NOT NULL DEFAULT 'anthropic',
    model           TEXT NOT NULL,
    input_tokens    INTEGER NOT NULL DEFAULT 0,
    output_tokens   INTEGER NOT NULL DEFAULT 0,
    cost_usd        NUMERIC(12, 6) NOT NULL DEFAULT 0,
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================ file_access_log
CREATE TABLE file_access_log (
    id              BIGSERIAL PRIMARY KEY,
    pipeline_run_id UUID REFERENCES pipeline_runs(id) ON DELETE CASCADE,
    agent_id        UUID REFERENCES agents(id) ON DELETE SET NULL,
    path            TEXT NOT NULL,
    operation       TEXT NOT NULL CHECK (operation IN ('read', 'write', 'search', 'agent_created')),
    bytes           INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================ command_log
CREATE TABLE command_log (
    id              BIGSERIAL PRIMARY KEY,
    pipeline_run_id UUID REFERENCES pipeline_runs(id) ON DELETE CASCADE,
    agent_id        UUID REFERENCES agents(id) ON DELETE SET NULL,
    command         TEXT NOT NULL,
    output          TEXT,
    exit_code       INTEGER,
    duration_ms     INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================ agent_memory
CREATE TABLE agent_memory (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id               UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    content                TEXT NOT NULL,
    embedding              VECTOR(1024),   -- voyage-3
    source_pipeline_run_id UUID REFERENCES pipeline_runs(id) ON DELETE SET NULL,
    source_task_id         UUID REFERENCES tasks(id) ON DELETE SET NULL,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- No ANN index yet: ivfflat/hnsw only pay off once row counts grow; exact
-- scan is correct and fast at this stage. Add in a later migration.

-- ============================================================ notifications
CREATE TABLE notifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type       TEXT NOT NULL DEFAULT 'info'
               CHECK (type IN ('pipeline_completed', 'pipeline_failed',
                               'approval_needed', 'agent_error', 'info')),
    title      TEXT NOT NULL,
    body       TEXT NOT NULL DEFAULT '',
    link       TEXT,                        -- frontend route to navigate to on click
    read       BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================ indexes
CREATE INDEX idx_token_usage_agent_recorded    ON token_usage (agent_id, recorded_at);
CREATE INDEX idx_token_usage_provider_model    ON token_usage (provider, model, recorded_at);
-- (conversation_id, created_at) serves both membership lookups and ordered pagination
CREATE INDEX idx_messages_conversation         ON messages (conversation_id, created_at);
CREATE INDEX idx_agent_memory_agent            ON agent_memory (agent_id);
CREATE INDEX idx_notifications_read_created    ON notifications (read, created_at);
CREATE INDEX idx_file_access_log_run           ON file_access_log (pipeline_run_id);
CREATE INDEX idx_command_log_run               ON command_log (pipeline_run_id);

-- FK / filter lookups used by list endpoints
CREATE INDEX idx_tasks_status                  ON tasks (status);
CREATE INDEX idx_tasks_assigned_to             ON tasks (assigned_to);
CREATE INDEX idx_tasks_pipeline                ON tasks (pipeline_id);
CREATE INDEX idx_conversations_agent           ON conversations (agent_id);
CREATE INDEX idx_conversations_pipeline        ON conversations (pipeline_id);
CREATE INDEX idx_pipeline_runs_pipeline        ON pipeline_runs (pipeline_id);

-- ============================================================ seed
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
