# Forge ⚡

> Describe a project. Watch a team of AI agents build it.

Forge is a **local-first multi-agent AI orchestration platform**. You describe
what you want built, a team of specialized AI agents plans it, builds it, and
ships it — with you in the loop at every critical step.

---

## What makes Forge different

- **Human-in-the-loop by design** — you approve plans before agents touch code,
  and approval gates pause execution at phase boundaries and risky commands
- **Multi-agent pipelines** — CEO → Architect → Developer → Tester, coordinated
  by LangGraph with pause/resume checkpoints
- **Atlas** — the eternal agent that designs and creates new agents on demand
- **Local-first** — your code, database, and API keys never leave your machine
- **Real cost tracking** — see exactly what each agent costs per run, with hard
  per-run / per-agent / daily ceilings that stop runaways automatically
- **Encrypted multi-provider key vault** — Claude executes agents today;
  OpenAI-compatible and Voyage keys are stored (AES-256-GCM) and testable, with
  more execution providers on the roadmap

## Features

- [x] Dashboard with live agent grid, cost analytics, and operations kanban
- [x] Atlas, the eternal agent — creates new agents via chat (`create_agent` tool)
- [x] Single-agent task execution — the Run button on any task executes its
      assigned agent against a real workspace
- [x] Multi-agent pipelines with LangGraph orchestration and approval gates
- [x] CEO auto-generates execution plans on pipeline creation
- [x] Auto-pipeline suggestion — the CEO picks the team, Atlas creates missing agents
- [x] Pipeline archive and delete
- [x] Real-time WebSocket streaming of tokens, tool calls, and gates
- [x] Agent memory — pgvector similarity recall of past work (VoyageAI embeddings)
- [x] Command security model — allow/deny lists, strict mode, full audit logs
- [x] Cost protection — per-run, per-agent, and daily spending ceilings
- [x] Encrypted API key vault with one-click provider testing
- [x] Token usage and cost analytics per agent, provider, and time bucket
- [ ] Additional execution providers (OpenAI, Gemini, local models)
- [ ] Re-embedding of agent memory on model change

## Quick Start

**Prerequisites:** Docker Desktop, and PostgreSQL 15+ running on the host with
the [pgvector](https://github.com/pgvector/pgvector) extension
(`brew install postgresql@16 pgvector` on macOS).

```bash
# 1. Clone and create the database
git clone https://github.com/yuvanadarsh/forge.git && cd forge
createdb forge

# 2. Configure environment (edit DB_USER, DB_PASSWORD, DB_NAME, SECRET_KEY)
cp .env.example .env

# 3. Run the migrations, in order
for f in backend/db/migrations/*.sql; do psql -d forge -f "$f"; done

# 4. Start everything
docker compose up --build

# 5. Open http://localhost:3000, add your Anthropic API key in Settings,
#    then chat with Atlas to build your team
```

The backend seeds **Atlas** (the eternal agent) automatically on startup.
API health check: <http://localhost:8000/health> · API docs: <http://localhost:8000/docs>

**Port conflicts?** Set `BACKEND_PORT` / `FRONTEND_PORT` in `.env` and re-run
`docker compose up --build` — no code changes needed.

## How it works

```
┌──────────────────────────┐         ┌───────────────────────────────────────┐
│   frontend (Next.js 16)  │  HTTP   │          backend (FastAPI)            │
│   localhost:3000         │────────▶│          localhost:8000               │
│                          │         │                                       │
│   lib/api.ts ────────────┼──/api──▶│  routers: agents · pipelines · tasks  │
│   createPipelineSocket ──┼──/ws───▶│   conversations · settings · notifs   │
└──────────────────────────┘         │                  │                    │
                                     │                  ▼                    │
                                     │   orchestrator (LangGraph graph,      │
                                     │   interrupt() approval gates)         │
                                     │                  │                    │
                                     │                  ▼                    │
                                     │   agent_executor ──▶ Anthropic API    │
                                     │     │  ├─ cost ceilings (every call)  │
                                     │     │  ├─ tool_registry (read/write/  │
                                     │     │  │   run_command/search/        │
                                     │     │  │   create_agent — confined    │
                                     │     │  │   to the pipeline workspace) │
                                     │     │  └─ streaming_manager ──▶ WS    │
                                     │     └─ memory_service ──▶ VoyageAI    │
                                     └──────────────────┬────────────────────┘
                                                        │ asyncpg
                                                        ▼
                                     ┌───────────────────────────────────────┐
                                     │   PostgreSQL (host machine, :5432)    │
                                     │   pgvector + pgcrypto · 13 tables     │
                                     └───────────────────────────────────────┘
```

1. **Create a pipeline** — describe the project; the CEO agent drafts the
   execution plan, or picks the whole team for you with auto-suggest (Atlas
   creates any missing agents first).
2. **Approve it** — nothing runs until you say so.
3. **Agents execute in sequence** — each with memory recall, sandboxed file and
   command tools, and output streamed live into the pipeline chat.
4. **Gates pause execution** — phase boundaries and reviewable commands wait
   for your approval; cost ceilings stop runaways automatically.
5. **Everything is audited** — every file access, command, token, and dollar
   lands in Postgres, on your machine.

Prefer something smaller? Create a **task**, assign an agent, and hit **Run →**
for a single-agent execution — same tools, same audit trail, no pipeline.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript (strict), Tailwind CSS, Geist |
| Backend | FastAPI (Python 3.11), async SQLAlchemy 2.0, asyncpg |
| Orchestration | LangGraph (state graph, checkpointed interrupts) |
| LLM / Embeddings | Anthropic SDK · VoyageAI (voyage-3, 1024-dim) |
| Database | PostgreSQL on host with pgvector + pgcrypto |
| Security | AES-256-GCM key vault, workspace containment, command allow/deny lists |
| Ops | Docker Compose (backend + frontend; DB stays on host) |

## Screenshots

<!-- Add screenshots to docs/screenshots/ and update the paths below. -->

![Dashboard](docs/screenshots/dashboard.png)
![Pipeline chat with approval gate](docs/screenshots/pipeline-chat.png)
![Atlas creating an agent](docs/screenshots/atlas.png)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) — dev setup, branch conventions, commit
format, and how to add agent presets or LLM providers.

## License

[MIT](LICENSE)
