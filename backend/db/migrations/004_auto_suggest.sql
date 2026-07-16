-- Auto-pipeline suggestion: the CEO's reasoning for the agent sequence it
-- picked, shown as an expandable section on the pipeline card. NULL for
-- manually assembled pipelines.
-- Fresh installs get this column from 001_initial.sql. Safe to re-run.
ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS suggestion_reasoning TEXT;
