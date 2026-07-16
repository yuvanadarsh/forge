-- Cost protection ceilings, checked by the agent executor before every LLM
-- call. Fresh installs get these columns from 001_initial.sql. Safe to re-run.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS max_run_cost   NUMERIC(8,2) NOT NULL DEFAULT 5.00;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS max_agent_cost NUMERIC(8,2) NOT NULL DEFAULT 2.00;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS max_daily_cost NUMERIC(8,2) NOT NULL DEFAULT 20.00;
