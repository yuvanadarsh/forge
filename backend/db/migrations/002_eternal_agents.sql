-- Eternal agents (Atlas): agents that ship with Forge and cannot be deleted.
-- Fresh installs get this column from 001_initial.sql; this migration upgrades
-- existing databases. Safe to re-run.
ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_eternal BOOLEAN NOT NULL DEFAULT false;
