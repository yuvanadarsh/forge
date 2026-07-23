# Forge ⚡

> Describe a project. Watch a team of AI agents build it.

Forge is a **local-first multi-agent AI orchestration platform**. You describe
what you want built, a team of specialized AI agents plans it, builds it, and
ships it — with you in the loop at every critical step.

---

## Quick Install (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/yuvanadarsh/forge/main/install.sh | bash
```

Requires Docker Desktop and PostgreSQL running on your machine (with
[pgvector](https://github.com/pgvector/pgvector)). The script pulls the
pre-built images from GHCR, sets up the database, and starts Forge at
<http://localhost:3000> — no source checkout needed.

To update later: `cd ~/.forge && docker compose pull && docker compose up -d`

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
- [x] Auto-plan with Forge — the best available agent drafts the plan and picks
      the team, Atlas creates missing specialists (no CEO agent required)
- [x] Existing project auto-ingestion — Forge scans your codebase before the
      first agent runs, so agents start out knowing your files
- [x] Pipeline chat memory — ask follow-up questions after a run and agents
      remember everything that happened in the pipeline
- [x] Image attachments — paste a screenshot into agent or pipeline chat and
      ask about it (stored locally, sent as native image content)
- [x] Full agent editing — name, role, model, color, and prompt from the agent
      card or detail page
- [x] Claude-style code blocks in chat, with language label and copy button
- [x] Pipeline archive and delete
- [x] Real-time WebSocket streaming of tokens, tool calls, and gates
- [x] Agent memory — pgvector similarity recall of past work (VoyageAI embeddings)
- [x] Command security model — allow/deny lists, strict mode, full audit logs
- [x] Cost protection — per-run, per-agent, and daily spending ceilings
- [x] Encrypted API key vault with one-click provider testing
- [x] Token usage and cost analytics per agent, provider, and time bucket
- [x] Persistent pipeline chat — keep working with your agents after a run finishes
- [x] Tool call history persisted to the database (survives page reloads)
- [x] Live agent status dots and typing indicators in pipeline chat
- [x] One-command install with pre-built GHCR images (`install.sh`)
- [x] Collapsible execution plan drawer — open/closed state remembered per pipeline
- [x] Export any pipeline conversation as Markdown or PDF (browser print)
- [x] Continue-project flow — start a new pipeline in a completed pipeline's workspace
- [ ] Additional execution providers (OpenAI, Gemini, local models)
- [ ] Re-embedding of agent memory on model change

## For Developers (build from source)

Prefer hot reload and a local checkout? This is the `docker compose up --build`
path — the backend bind-mounts with `--reload`; rebuild after frontend changes.

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

1. **Create a pipeline** — describe the project; Forge drafts the execution
   plan with your best planning agent, or picks the whole team for you with
   auto-plan (Atlas creates any missing agents first).
2. **Approve it** — nothing runs until you say so.
3. **Agents execute in sequence** — each with memory recall, sandboxed file and
   command tools, and output streamed live into the pipeline chat.
4. **Gates pause execution** — phase boundaries and reviewable commands wait
   for your approval; cost ceilings stop runaways automatically.
5. **Everything is audited** — every file access, command, token, and dollar
   lands in Postgres, on your machine.

Prefer something smaller? Create a **task**, assign an agent, and hit **Run →**
for a single-agent execution — same tools, same audit trail, no pipeline.

## Execution Modes

Forge gives you control over how autonomously agents work:

| Mode | Terminal Commands | File Access | Inter-agent handoffs |
|------|------------------|-------------|---------------------|
| Full Auto | Always run | Always allowed | Seamless |
| Supervised | Ask first | Always allowed | Seamless |
| Strict | Ask first | Ask first | Ask first |

**Approval gates** in the execution plan always pause regardless of mode —
these are intentional checkpoints where you review what was built before
the next phase begins.

Set your global default in Settings → Security & Execution.
Override per-pipeline when creating a new pipeline.

## Working with Forge

**Each pipeline is a job, not a project.** Point multiple pipelines at the
same workspace folder to build features incrementally. Agents automatically
read existing code before starting.

```
You describe a task
     ↓
Forge auto-plans → your planning agent picks the team → Atlas creates missing ones
     ↓
You approve the plan
     ↓
Agents execute: read files → write code → run tests → write docs
     ↓
You review at approval gates
     ↓
Files land in ~/forge-workspace/[project]/
     ↓
Continue chatting with agents or start a new pipeline
```

When a pipeline completes, its chat stays open: ask follow-up questions,
export the conversation (**Export ↓** → Markdown or PDF), or click
**→ Start new pipeline in this workspace** below the input to queue the next
feature against the same codebase. Completed pipeline cards have the same
shortcut in their **⋯** menu (**New Pipeline →**).

## Working with existing projects

Create a pipeline, select **Existing Folder**, point it at your project.
Forge automatically scans your codebase before agents start working — file
structure plus the contents of key files (README, package.json, and more) land
in the first agent's context, and a "📁 Forge scanned your project" note
appears in the pipeline chat. Describe the feature you want — agents read
your code and implement it, instead of rediscovering the project one file
read at a time.

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
| Distribution | Pre-built images on GHCR (`ghcr.io/yuvanadarsh/forge-backend`, `-frontend`), published by GitHub Actions on every push to main |

Two ways to run the containers: `docker-compose.yml` builds from source (dev),
while `docker-compose.prod.yml` pulls the pre-built GHCR images — that's what
`install.sh` uses, so end users never need the repo or a build toolchain.

## Screenshots

<!-- Add screenshots to docs/screenshots/ and update the paths below. -->

![Dashboard](docs/screenshots/dashboard.png)
*The dashboard — live agent grid, cost analytics, and the operations kanban.*

![Pipeline chat with approval gate](docs/screenshots/pipeline-chat.png)
*Pipeline chat mid-run — streaming tokens, tool calls, and an approval gate waiting on you.*

![Atlas creating an agent](docs/screenshots/atlas.png)
*Atlas designing and creating a new specialist agent from a chat request.*

![Create pipeline with auto-plan](docs/screenshots/create-pipeline.png)
*Auto-plan picks the team, drafts the execution plan, and waits for your approval.*

## Roadmap

Future ideas, in no particular order:

- Additional execution providers (OpenAI, Gemini, local models)
- Voice interface
- Web-based agent marketplace
- Team collaboration (multi-user)
- Cloud deployment option
- Re-embedding of agent memory on model change

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) — dev setup, branch conventions, commit
format, and how to add agent presets or LLM providers.

## License

[MIT](LICENSE)
