-- Pipeline archive: soft-hide finished pipelines without deleting history.
-- Fresh installs get both changes from 001_initial.sql. Safe to re-run.
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE pipelines DROP CONSTRAINT IF EXISTS pipelines_status_check;
ALTER TABLE pipelines ADD CONSTRAINT pipelines_status_check
    CHECK (status IN ('pending_approval', 'approved', 'running',
                      'paused_for_approval', 'completed', 'failed', 'archived'));
