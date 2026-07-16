-- Atlas's create_agent tool audits agent creation in file_access_log with
-- operation='agent_created'; the original CHECK only allowed read/write/search.
-- Fresh installs get the widened CHECK from 001_initial.sql. Safe to re-run.
ALTER TABLE file_access_log DROP CONSTRAINT IF EXISTS file_access_log_operation_check;
ALTER TABLE file_access_log ADD CONSTRAINT file_access_log_operation_check
    CHECK (operation IN ('read', 'write', 'search', 'agent_created'));
