# Forge — Claude Code Project Instructions

## What is Forge

Forge is a multi-agent AI orchestration platform. Users spawn specialized AI agents
(CEO, Architect, Developer, Tester, etc), assign them tasks, and watch them execute
pipelines with human approval gates at critical steps. Think of it as an AI workforce
manager — describe what you want built, approve the plan, agents execute overnight.

## Repository

https://github.com/yuvanadarsh/forge.git

## Git Workflow (ALWAYS follow this)

- At the start of every session: checkout a new branch from main
  Branch naming: feature/short-description or fix/short-description
- Commit after every major component or logical unit of work
  Format: feat: | fix: | chore: | docs: | refactor:
- At end of every session: open PR to main with full summary
- Never commit directly to main
- Always pull latest main before branching

## Monorepo Structure

- /frontend — Next.js app (all existing frontend code lives here after restructure)
- /backend — FastAPI, Python, async SQLAlchemy, LangGraph
- docker-compose.yml at repo root spins up both services
- Database lives on host machine (not containerized)

## Current Phase

PHASE 2 — Backend wiring. The mock UI in /frontend is complete (Sessions 1–4 done).
Now building the real FastAPI backend, LangGraph orchestration, WebSocket streaming,
and restructuring the repo into a monorepo.

## Tech Stack — Frontend

- Next.js 16.2.9 (App Router), TypeScript (strict, never use `any`), Tailwind CSS
- Geist font (Next.js default)
- recharts for graphs
- react-markdown + rehype-highlight + remark-gfm for chat and execution plan
- highlight.js github-dark theme imported in globals.css
- No UI component library — everything built from scratch with Tailwind
- WebSocket client for real-time pipeline streaming (next phase)

## Tech Stack — Backend

- FastAPI (Python 3.11+), async SQLAlchemy, asyncpg
- LangGraph for agent orchestration and pipeline state management
- PostgreSQL (local via Homebrew, port 5432) with pgvector extension already installed
- VoyageAI for embeddings (voyage-3, 1024 dimensions)
- Anthropic SDK for LLM calls (primary provider)
- cryptography library for AES-256 API key encryption

## Docker Setup

- backend service: Python/FastAPI, port 8000
- frontend service: Next.js, port 3000
- Both connect to HOST Postgres via host.docker.internal:5432
- No containerized database — data lives on host machine, survives container restarts
- One command to run everything: docker compose up --build

## Database

- PostgreSQL via Homebrew on host machine
- pgvector extension already installed (from Meridian project)
- Connection string: postgresql+asyncpg://user:password@host.docker.internal:5432/forge
- All migrations in backend/db/migrations/ — run in order
- Tables: agents, api_keys, settings, pipelines, pipeline_runs, tasks,
  conversations, messages, token_usage, file_access_log, command_log,
  agent_memory, notifications

## Key Architecture Decisions

- LangGraph manages pipeline state, handoffs, and approval gate interrupts
- Each pipeline run has a langgraph_thread_id for pause/resume
- WebSocket: one connection per active pipeline run (not global)
- Approval gates are messages with role='approval_gate' and gate_status field
- Agents cannot access files outside their pipeline's workspace_path
- token_usage is a separate time-series table for analytics (not just message-level)
- API keys stored AES-256 encrypted in DB, never in .env files (except SECRET_KEY)
- Settings table is single-row user config, injected into every agent system prompt at runtime
- New projects default workspace: ~/forge-workspace/[project-name]/
- Existing projects: user selects folder via file picker on pipeline creation (workspace_path field)

## Security Model (maps to Settings UI)

- terminal_execution: 'always_proceed' | 'request_review' | 'agent_decides'
- strict_mode: boolean — requires human approval for ALL agent actions when true
- allowed_commands: string[] — always run regardless of terminal_execution setting
- denied_commands: string[] — always blocked regardless of terminal_execution setting
- Every file access logged to file_access_log, every command to command_log

## Agent Execution Model

- Agent = definition (system_prompt, model, specialty) stored in agents table
- Same agent definition can run in multiple simultaneous pipelines
- Before each LLM call: query agent_memory for relevant context (top 5, threshold 0.3)
- After each LLM call: save output to messages + agent_memory + token_usage tables
- Tools available: read_file, write_file, run_command, search_codebase
- All tool calls respect workspace_path boundary — path traversal protection enforced

## LangGraph Pipeline Flow

1. User creates pipeline → saved to DB, status 'pending_approval'
2. User approves → status 'approved', LangGraph graph created
3. Graph runs nodes in agent_sequence order
4. At approval gates: interrupt() called → status 'paused_for_approval'
5. User approves in pipeline chat → graph resumes from checkpoint
6. Completion → status 'completed', notifications created

## WebSocket Streaming

- Endpoint: ws://localhost:8000/ws/pipeline/{pipeline_run_id}
- Message envelope: { type, agent_id, payload, timestamp }
- Types: 'token' | 'tool_call' | 'tool_result' | 'status' | 'gate' | 'complete' | 'error'
- Frontend pipeline chat renders token deltas in real time

## Frontend API Integration (next session after backend)

- All mock data in lib/mock-data.ts replaced with real API calls
- API base: NEXT_PUBLIC_API_URL env var (http://localhost:8000)
- Single API client: frontend/lib/api.ts
- WebSocket: native browser WebSocket API via createPipelineSocket(runId)

## Design System (frontend — do not change)

- Background: #0a0a0a, Cards: #111111, Borders: #1f1f1f
- Primary accent: #f59e0b (amber), Secondary: #3b82f6 (blue)
- Success: #22c55e, Error: #ef4444
- Text primary: #f5f5f5, Text muted: #71717a
- Border radius: 12px on cards, 8px on inputs/buttons
- Transitions: 150ms ease on all hover states

## Agent Ring Colors

- #6366f1 → #8b5cf6 (indigo/purple)
- #f59e0b → #ef4444 (amber/red)
- #3b82f6 → #06b6d4 (blue/cyan)
- #22c55e → #10b981 (green/emerald)
- #ec4899 → #f43f5e (pink/rose)
- #f97316 → #eab308 (orange/yellow)

## Frontend File Structure (existing — do not reorganize)

```
frontend/
  app/
    page.tsx                          — Dashboard (/)
    layout.tsx                        — Root layout with Sidebar
    globals.css
    agents/
      page.tsx                        — Agent registry (/agents)
      [id]/
        page.tsx                      — Agent detail (/agents/[id])
        conversations/[convId]/
          page.tsx                    — Chat window
    chat/page.tsx
    pipelines/
      page.tsx
      [id]/chat/page.tsx              — Pipeline chat (3-panel)
    tasks/page.tsx
    settings/page.tsx
  components/
    Sidebar.tsx, AgentCard.tsx, TaskCard.tsx, Toast.tsx
    CreateAgentModal.tsx, CreateTaskModal.tsx
    TaskSlideOver.tsx, TokenUsageGraph.tsx
    PipelineChatMessage.tsx, PipelineChatInput.tsx
    PipelineExecutionPlan.tsx, PipelineParticipants.tsx
    CostAnalyticsGraph.tsx, CostAnalyticsChart.tsx
    ProviderRow.tsx, AddProviderModal.tsx
    EmbeddingsSection.tsx, ExportSection.tsx
    AgentStatCards.tsx, ApprovalGateCard.tsx, NotificationBell.tsx
  types/index.ts
  lib/mock-data.ts
  lib/analytics-mock-data.ts
  lib/api.ts                          — (to be created this session)
```

## Backend File Structure (to be created this session)

```
backend/
  main.py
  routers/
    agents.py, pipelines.py, tasks.py
    conversations.py, settings.py, notifications.py
  services/
    orchestrator.py, agent_executor.py, tool_registry.py
    memory_service.py, streaming.py, crypto.py
  db/
    connection.py, models.py
    migrations/001_initial.sql
  requirements.txt
  Dockerfile
```

## What NOT to build yet

- Multi-user auth (single user only)
- Cloud deployment (local first, Docker is enough)
- Drag and drop kanban
- Voice interface (Meridian integration — future phase)
- Payment/billing

## Session History Decisions

### Session 1 (2026-06-23) — Frontend scaffold

- Next.js 16.2.9 installed (latest at time)
- Gradient borders use wrapper div with padding:1px technique
- Modal fade uses .modal-overlay CSS class with fadeIn keyframe (globals.css)
- /agents/[id]/conversations/new handled by convId === "new" check
- All create operations use local useState (not persisted — mock phase)

### Session 2 (2026-06-23) — UI polish

- recharts, react-markdown, rehype-highlight, highlight.js added
- TaskSlideOver, TokenUsageGraph, EditPipelineModal added
- AgentCard height fix: h-full + items-stretch on grid
- Create Agent modal: role preset dropdown auto-fills fields, role title stays editable
- TaskCard: onClick opens slide-over, onMove dropdown opens above card (bottom-full)
- /agents/[id]/page.tsx is client component ("use client") — needs useState
- Only assistant messages go through ReactMarkdown (not user messages)
- Export uses Blob + URL.createObjectURL (no server needed)

### Session 3 (2026-06-24) — Analytics, pipeline chat, settings

- EditPipelineModal removed — replaced by /pipelines/[id]/chat
- Pipeline chat: 3-panel (execution plan | chat | participants)
- User bubbles: amber bg #f59e0b, dark text #0a0a0a. Assistant: #1a1a1a
- @mention highlighting: renderWithMentions() helper splits on /@(\w+)/g
- Dynamic provider vault: providers[] state, isDefault rows hide Delete button
- CostAnalyticsGraph: provider chips multi-select (min 1 active), metric + timeline dropdowns
- Mock data uses Math.sin-based deterministic generation per model

### Session 4 (2026-06-25) — Final mock features

- remark-gfm added for checkbox rendering in execution plan
- @mention picker: Discord-style, filters pipeline participants, arrow key navigation
- Approval gates: type="approval_gate" on PipelineChatMsg renders ApprovalGateCard
- Agent-to-agent: relay_to_agent_name on PipelineChatMsg renders "→ AgentName" chip
- NotificationBell: self-contained, mousedown outside-click handler, in Sidebar
- Run history: collapsed by default, error rows have red left border

## CLAUDE.md Rules

- Update at end of every session with new decisions
- Never remove content — strikethrough superseded items instead
- README.md updated in same commit as CLAUDE.md

## README Rules

- Features checklist with checkboxes
- Getting Started: clone, copy .env.example, run migration, docker compose up --build
- Architecture diagram
- Screenshot section
