-- Per-pipeline execution mode override. NULL means "use global settings"
-- (Settings.terminal_execution / Settings.strict_mode). Fresh installs get
-- this column from 001_initial.sql. Safe to re-run.
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS execution_mode VARCHAR(20) DEFAULT NULL;
