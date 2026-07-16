# Contributing to Forge

Thanks for helping build Forge! This guide covers local setup, conventions,
and the two most common extension points.

## Dev environment

1. Follow the [Quick Start](README.md#quick-start): host Postgres with
   pgvector, `.env` from `.env.example`, migrations in order, then
   `docker compose up --build`.
2. Hot reload is on for both services — edit files on your machine and the
   containers pick them up (backend via uvicorn `--reload`, frontend via the
   Next.js dev server).
3. Working outside Docker? The backend runs with
   `cd backend && python -m venv .venv && .venv/bin/pip install -r requirements.txt`
   then `.venv/bin/uvicorn main:app --reload` (needs `backend/.env` with
   `DATABASE_URL` and `SECRET_KEY`). The frontend runs with
   `cd frontend && npm ci && npm run dev` (needs `frontend/.env.local` with
   `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL`).
4. Type checks: `cd frontend && npx tsc --noEmit`. The database schema's
   source of truth is `backend/db/migrations/` — `db/models.py` mirrors it.

### Docker notes (Apple Silicon)

The frontend uses **named volumes** for `node_modules` and `.next` — required
for VirtioFS compatibility. If the frontend breaks after a Docker Desktop
update: `docker compose down -v && docker compose up --build`. Don't switch
back to anonymous volumes.

## Branch naming

Branch from `main`, never commit to it directly:

```
feature/short-description
fix/short-description
```

## Commit format

Conventional commits, one logical unit of work per commit:

```
feat: add pipeline archive endpoint
fix: stop notification bell dropdown clipping under the plan panel
docs: document cost protection defaults
chore: bump anthropic sdk
refactor: extract PipelineCard from the pipelines page
```

## Adding a new agent preset

Role presets live in `frontend/components/CreateAgentModal.tsx` in the
`ROLE_PRESETS` record. Add an entry with `role`, `specialty`, and
`system_prompt` — the modal lists it automatically and every field stays
editable after selection. Keep system prompts focused: one clear job,
concrete outputs, no filler.

## Adding a new LLM provider

Provider support has three layers — add what your provider needs:

1. **Key vault + testing** — `_probe_provider()` in
   `backend/routers/settings.py` decides how "Test" verifies a key. Providers
   with an OpenAI-compatible `/models` endpoint work already via `base_url`;
   add an explicit branch for anything bespoke.
2. **Pricing** — the `PRICING` table in `backend/services/agent_executor.py`
   maps model-id prefixes to USD per million tokens (longest prefix wins).
   Unknown models fall back to Sonnet-tier pricing.
3. **Execution** — `_anthropic_client()` in `agent_executor.py` is where
   completions are created today (Anthropic only). A new execution provider
   means teaching the executor to pick a client per `agent.model` — open an
   issue first so we can agree on the shape.
4. **Model dropdown** — the Create Agent modal groups a per-provider model
   list by which providers have keys configured; add your models there.

## PR checklist

- [ ] Branched from latest `main`, named `feature/…` or `fix/…`
- [ ] Conventional commit messages
- [ ] `npx tsc --noEmit` passes in `frontend/`
- [ ] Backend changes compile and run against migrations applied in order
      (new schema changes: numbered migration **and** `001_initial.sql` updated
      for fresh installs)
- [ ] New endpoints have a typed client function in `frontend/lib/api.ts`
- [ ] UI follows the design system (colors/z-index conventions in `CLAUDE.md`)
- [ ] PR description says what changed, why, and how you verified it
