-- 011: local embeddings (all-MiniLM-L6-v2, 384 dims) + workspace-scoped RAG.
--
-- DESTRUCTIVE ON PURPOSE: existing agent_memory rows are VoyageAI 1024-dim
-- vectors — test data with no functional value, and incompatible with the
-- new 384-dim column type (pgvector cannot cast between dimensions). They
-- are wiped, not migrated. agent_memory had no ANN index (001 deliberately
-- deferred ivfflat/hnsw), so there is no vector index to drop/recreate.
TRUNCATE TABLE agent_memory;

ALTER TABLE agent_memory ALTER COLUMN embedding TYPE vector(384);

-- Workspace-level codebase chunks have no owning agent (agent_id NULL).
ALTER TABLE agent_memory ALTER COLUMN agent_id DROP NOT NULL;

-- 'agent' = per-agent memory (auto-recalled before LLM calls);
-- 'codebase_chunk' = workspace RAG rows (reachable ONLY via the
-- search_codebase tool, excluded from automatic recall).
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS memory_type TEXT NOT NULL DEFAULT 'agent';

-- Codebase chunks are keyed by workspace_path (not pipeline) so an index
-- built by one pipeline stays searchable by later pipelines on the same
-- folder. source_file + file_hash let re-indexing skip unchanged files.
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS workspace_path TEXT;
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS source_file TEXT;
ALTER TABLE agent_memory ADD COLUMN IF NOT EXISTS file_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_agent_memory_workspace
    ON agent_memory (workspace_path, memory_type);

-- The large-file tools (append_file, read_file_section, replace_in_file)
-- audit with new operation values; widen the CHECK like 003 did. Safe to re-run.
ALTER TABLE file_access_log DROP CONSTRAINT IF EXISTS file_access_log_operation_check;
ALTER TABLE file_access_log ADD CONSTRAINT file_access_log_operation_check
    CHECK (operation IN ('read', 'write', 'search', 'agent_created',
                         'append', 'read_section', 'replace'));

-- Settings reflect the local model; the old VoyageAI values are obsolete.
UPDATE settings SET embedding_model = 'all-MiniLM-L6-v2'
    WHERE embedding_model IN ('voyage-3', 'voyage-3-lite');
ALTER TABLE settings ALTER COLUMN embedding_model SET DEFAULT 'all-MiniLM-L6-v2';
