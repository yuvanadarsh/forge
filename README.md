# Forge

**Multi-agent AI orchestration dashboard.** Spawn specialized AI agents (CEO, Architect, Developer, Tester, etc.), assign them tasks, and watch them execute pipelines with human approval gates at critical steps.

---

## Screenshots

> _Screenshots to be added once the UI is deployed or running locally._

---

## Features

### Phase 1 — Mock UI Foundation ✅

- [x] **Dashboard** — Agent grid with status indicators, token counts, and cost display; Operations kanban board (Backlog / In Progress / Review / Completed)
- [x] **Agent Registry** (`/agents`) — Full grid of all agents with "+ Create Agent" button
- [x] **Agent Detail** (`/agents/[id]`) — Agent header, task conversations list, General Chat button, system prompt view
- [x] **Chat Window** (`/agents/[id]/conversations/[convId]`) — Left sidebar with conversation list, chat message bubbles, live send input
- [x] **Global Chat** (`/chat`) — All conversations grouped by agent, searchable
- [x] **Pipelines** (`/pipelines`) — Pipeline list with expandable plan_md view and approval buttons
- [x] **Tasks** (`/tasks`) — Full kanban board with per-column "+ task" buttons
- [x] **Create Agent Modal** — Name, role, specialty, model, system prompt, 6 color presets
- [x] **Create Task Modal** — Title, description, agent picker grid, priority selector, Backlog/Start Now actions
- [x] **Toast notifications** — "Coming soon" on all Run buttons with fade animation
- [x] **Sidebar navigation** — Fixed left sidebar with Forge logo, nav links, active state, Settings
- [x] **Design system** — Dark theme (#0a0a0a background, #f59e0b amber accent, Geist font)

### Phase 1.5 — UI Polish ✅

- [x] **Equal-height agent cards** — CSS grid `items-stretch` + `h-full` on card internals
- [x] **Create Agent on Dashboard** — "+ Create Agent" button in dashboard header alongside "+ New Task"
- [x] **Role preset system** — Create Agent modal now has 12 presets (CEO, CTO, Architect, etc.) that auto-fill role title, specialty, and system prompt — all fields remain freely editable
- [x] **Task "Move to →" dropdown** — Every task card now has an inline status mover on both `/tasks` and dashboard kanban
- [x] **Task detail slide-over** — Click any task card to open a 400px slide-over panel showing full title, description, assigned agent, priority, status, and created date
- [x] **Editable system prompt** — Agent detail page now has Edit/Save/Cancel for system prompt
- [x] **Token usage graph** — Bar chart on agent detail page with Day/Week/Month/All Time toggle (recharts)
- [x] **Markdown + syntax highlighting** — Chat messages render markdown with `react-markdown` + `rehype-highlight`
- [x] **Condensed /chat page** — Single-row layout with avatar, agent name·role, conversation title, preview, timestamp; left border color matches agent
- [x] **Full Settings page** — API keys (add/update/delete/test), Embeddings (locked model picker + warning), Export Data (working JSON downloads)
- [x] **Pipeline edit modal** — Edit title and reorder agent sequence with up/down arrows; Add Agent picker

### Phase 1.75 — Analytics, Pipeline Chat & Provider Vault ✅

- [x] **Cost Analytics Graph** — Grouped bar chart on dashboard with provider/model filter chips and metric/timeline dropdowns (recharts)
- [x] **Pipeline Chat** — Three-panel chat interface at `/pipelines/[id]/chat` with collapsible execution plan, @mention highlighting, and participants sidebar
- [x] **Dynamic API Key Vault** — User-managed provider list in settings with add/edit/delete (Anthropic is default and cannot be deleted)
- [x] **Agent Stat Cards** — Lifetime cost, this-month cost, and avg-per-day cards above the token usage graph on agent detail page

### Phase 1.9 — Final Mock Features ✅

- [x] **Analytics legend above chart** — Legend moved above the bar chart between filter chips and bars, eliminating label collision
- [x] **Discord-style @mention picker** — Pipeline chat input shows a floating agent picker filtered by name when user types `@`; arrow keys + Enter to select
- [x] **Execution plan markdown** — `PipelineExecutionPlan` uses `remark-gfm` for `[ ]` checkboxes (rendered as disabled inputs), bold text, and sized headers
- [x] **Approval gate UI** — `ApprovalGateCard` appears inline in pipeline chat between phases; supports Approve → (green confirmation) and Request Changes (feedback textarea)
- [x] **Agent-to-agent messages** — `relay_to_agent_name` field on `PipelineChatMsg` renders a "→ AgentName" relay indicator under the avatar and in the name row
- [x] **Notification bell** — Amber badge on sidebar showing unread count; dropdown with color-coded activity feed; "Mark all read" clears badge
- [x] **Agent run history** — Collapsible "RUN HISTORY" section on `/agents/[id]` with timestamp, task name, token/cost stats, success/error badge; error rows have red left border

### Phase 2 — Backend Foundation ✅

- [x] **Monorepo restructure** — Next.js app moved to `/frontend`, FastAPI backend at `/backend`
- [x] **FastAPI scaffold** — CORS, lifespan-managed DB engine, `/health`, WebSocket route
- [x] **Database schema** — 13 tables (agents, pipelines, runs, tasks, conversations, messages, token_usage, logs, memory, notifications…) with pgvector + pgcrypto, plus async SQLAlchemy 2.0 models
- [x] **Encrypted API key vault** — AES-256-GCM at rest, masked (`••••••••abcd`) in every response
- [x] **Agents CRUD** — token usage aggregated live from the `token_usage` time series
- [x] **Settings API** — single-row config incl. the terminal security model (allow/deny lists, strict mode)
- [x] **Tool registry** — `read_file` / `write_file` / `run_command` / `search_codebase` with workspace containment, command policy gates, 60s timeouts, full audit logging
- [x] **WebSocket streaming** — per-run socket pushing `token | tool_call | tool_result | status | gate | complete | error` envelopes
- [x] **Agent executor** — streaming Anthropic tool loop with vector-memory recall (VoyageAI + pgvector), cost tracking, and command approval gates
- [x] **LangGraph orchestrator** — sequential agent graph with `interrupt()` phase gates, DB-polled resume, completion/failure notifications
- [x] **Tasks / Conversations / Notifications routers** — full CRUD with filters and pagination
- [x] **Docker** — `docker compose up --build` runs both services against host Postgres
- [x] **Typed API client** — `frontend/lib/api.ts` covering every endpoint + `createPipelineSocket()`

### Phase 2.5 — Frontend Wiring ✅

- [x] **Global store** — `lib/store.tsx` React Context + useReducer; agents/tasks/pipelines/notifications fetched once on mount, mutations reflect everywhere instantly
- [x] **Every page on the real API** — dashboard, agents, agent detail, tasks, chat, conversations, pipelines, pipeline chat, settings all read/write through `lib/api.ts` (mock data no longer imported by any page)
- [x] **Live pipeline chat over WebSocket** — token deltas stream into agent bubbles; tool calls render 🔧 indicator cards updated with results; status/gate/complete/error events drive the UI
- [x] **Approval gates driven by real run status** — gate cards from persisted `approval_gate` messages and live `gate` events; Approve resumes the LangGraph run, Request Changes posts feedback and keeps the gate open
- [x] **Agent chat replies** — `POST /messages` runs a single-agent LLM turn (`chat_reply`) and returns the assistant message; optimistic send with pending/thinking states
- [x] **Analytics on real data** — `GET /api/token-usage` + `GET /api/analytics/cost` aggregate the `token_usage` time series per agent/provider/model/bucket
- [x] **Key vault UI live** — add/update/delete/test keys against the encrypted vault; Test decrypts and probes the provider API
- [x] **Security settings UI** — terminal execution mode, strict mode, allowed/denied command lists editable and persisted
- [x] **Loading / error / empty states** — shared `LoadingSkeleton`, `ErrorState`, `EmptyState` components + dismissible global error banner
- [x] **Notifications live** — 30s polling, unread badge, mark-read / mark-all-read

### Phase 3 — Real Agent Execution & Pipeline Testing ⬜ (next session)

- [ ] End-to-end pipeline runs with a real Anthropic key (streamed tokens, live gates)
- [ ] Task "Run →" button triggers agent execution
- [ ] Pipeline creation UI

### Phase 4 — Hardening ⬜

- [ ] Drag-and-drop kanban
- [ ] Multi-provider LLM routing (OpenAI, Gemini)
- [ ] Authentication
- [ ] Cloud deployment

---

## Architecture

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
                                     │     │  ├─ tool_registry (read/write/  │
                                     │     │  │   run_command/search — all   │
                                     │     │  │   confined to workspace)     │
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

Agents execute pipelines sequentially; human approval gates pause the graph
(`pipeline_runs.status = paused_for_approval`) until approved in the pipeline chat.
Every file access and command is audit-logged and confined to the pipeline's workspace.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript (strict), Tailwind CSS v4, Geist |
| Charts / Markdown | recharts · react-markdown + rehype-highlight + remark-gfm |
| Backend | FastAPI (Python 3.11), async SQLAlchemy 2.0, asyncpg |
| Orchestration | LangGraph (state graph, checkpointed interrupts) |
| LLM / Embeddings | Anthropic SDK · VoyageAI (voyage-3, 1024-dim) |
| Database | PostgreSQL on host with pgvector + pgcrypto |
| Security | AES-256-GCM key vault, workspace path containment, command allow/deny lists |
| Ops | Docker Compose (backend + frontend; DB stays on host) |

No UI component library — everything built from scratch with Tailwind.

---

## Getting Started

**Prerequisites:** Docker, and PostgreSQL running on the host with the `pgvector`
extension available (`brew install postgresql pgvector` on macOS).

### Running Locally

```bash
# 1. Clone the repo
git clone https://github.com/yuvanadarsh/forge.git
cd forge

# 2. Copy .env.example to .env, fill in DB credentials and SECRET_KEY
cp .env.example .env
#    → DB_USER / DB_PASSWORD / DB_NAME
#    → SECRET_KEY: openssl rand -hex 32
#    → VOYAGE_API_KEY (optional — memory search degrades gracefully without it)

# 3. Create the forge database and run the migration
createdb forge
psql -d forge -f backend/db/migrations/001_initial.sql

# 4. Run everything (or run frontend/backend separately — see below)
docker compose up --build
```

5. Open [http://localhost:3000](http://localhost:3000)
6. Go to **Settings → API Keys → Add** and paste your Anthropic API key
   (stored AES-256 encrypted in the DB — never in `.env`)
7. Create an agent and start a pipeline

API health: [http://localhost:8000/health](http://localhost:8000/health) · API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

The frontend needs `frontend/.env.local` when run outside compose:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

**Local development without Docker:**

```bash
# backend (Python 3.11+; on 3.13 install voyageai>=0.3.3)
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
echo "DATABASE_URL=postgresql+asyncpg://localhost:5432/forge" > .env
echo "SECRET_KEY=$(openssl rand -hex 32)" >> .env
.venv/bin/uvicorn main:app --reload --port 8000

# frontend
cd frontend && npm install && npm run dev
```

---

## Project Structure

```
backend/
  main.py                     FastAPI entry point (CORS, lifespan, /health, /ws)
  routers/                    agents · pipelines · tasks · conversations · settings · notifications
  services/
    orchestrator.py           LangGraph pipeline runner with approval-gate interrupts
    agent_executor.py         Streaming Anthropic tool loop + cost/memory bookkeeping
    tool_registry.py          read_file / write_file / run_command / search_codebase
    memory_service.py         VoyageAI embeddings + pgvector similarity search
    streaming.py              Per-run WebSocket manager (typed event envelopes)
    crypto.py                 AES-256-GCM API key encryption
  db/
    connection.py             Async engine, session factory, get_db dependency
    models.py                 SQLAlchemy 2.0 models (13 tables)
    migrations/001_initial.sql
  requirements.txt · Dockerfile
docker-compose.yml            backend + frontend, host Postgres via host.docker.internal

frontend/app/
  page.tsx                    Dashboard (/ — agent grid + kanban + cost analytics graph)
  layout.tsx                  Root layout + sidebar
  agents/page.tsx             Agent registry
  agents/[id]/page.tsx        Agent detail (stat cards + editable system prompt + token graph)
  agents/[id]/conversations/[convId]/page.tsx  Chat window (markdown rendering)
  chat/page.tsx               Global chat (single-row density layout)
  pipelines/page.tsx          Pipelines list with status badges
  pipelines/[id]/chat/page.tsx  Three-panel pipeline chat (plan | chat | participants)
  tasks/page.tsx              Tasks kanban (move-to + slide-over)
  settings/page.tsx           Settings (dynamic provider vault, embeddings, export)
frontend/components/
  Sidebar.tsx                 Fixed left navigation
  AgentCard.tsx               Gradient-border agent card (equal height)
  AgentStatCards.tsx          Lifetime/monthly/daily cost stat cards
  TaskCard.tsx                Kanban task card (move-to dropdown)
  TaskSlideOver.tsx           Task detail slide-over panel
  TokenUsageGraph.tsx         Recharts bar chart with interval toggle
  CostAnalyticsGraph.tsx      State/filter wrapper for dashboard analytics
  CostAnalyticsChart.tsx      Recharts grouped bar chart for cost analytics
  PipelineChatMessage.tsx     Message bubble with @mention highlighting
  PipelineChatInput.tsx       Textarea + send button for pipeline chat
  PipelineExecutionPlan.tsx   Collapsible left panel with markdown plan
  PipelineParticipants.tsx    Right sidebar with participant status dots
  ProviderRow.tsx             Single API provider row with inline edit/delete
  AddProviderModal.tsx        Modal for adding a new API provider
  EmbeddingsSection.tsx       Embeddings config section (settings)
  ExportSection.tsx           Export data section (settings)
  Toast.tsx                   Fade toast notification
  CreateAgentModal.tsx        New agent form (role presets)
  CreateTaskModal.tsx         New task form
frontend/lib/
  api.ts                      Typed client for every backend endpoint + WebSocket factory
  store.tsx                   Global React Context store (agents/tasks/pipelines/notifications)
  mock-data.ts                Mock-phase data — kept as reference only, no page imports it
  analytics-mock-data.ts      Mock-phase analytics data (reference only)
frontend/types/
  index.ts                    Mock-phase interfaces + Phase 2 backend wire types
```

---

## Design System

| Token | Value |
|---|---|
| Background | `#0a0a0a` |
| Card background | `#111111` |
| Card border | `#1f1f1f` |
| Accent (amber) | `#f59e0b` |
| Success | `#22c55e` |
| Error | `#ef4444` |
| Text primary | `#f5f5f5` |
| Text muted | `#71717a` |
| Border radius (cards) | `12px` |
| Transitions | `150ms ease` |
