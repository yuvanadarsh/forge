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

~~PHASE 2 — Backend wiring. The mock UI in /frontend is complete (Sessions 1–4 done).
Now building the real FastAPI backend, LangGraph orchestration, WebSocket streaming,
and restructuring the repo into a monorepo.~~

~~PHASE 2 STARTED — backend foundation complete (Session 5, 2026-07-15): monorepo
restructure, FastAPI + all 6 routers, 13-table schema, LangGraph orchestration with
approval gates, WebSocket streaming, agent executor, tool registry, encrypted key
vault, Docker setup, and the typed frontend API client (lib/api.ts).
NEXT SESSION: wire the UI — replace lib/mock-data.ts reads with lib/api.ts calls.~~

PHASE 2 COMPLETE (Session 6, 2026-07-15): every page wired to the live backend —
global store (lib/store.tsx), WebSocket pipeline chat, real key vault + security
settings UI, analytics endpoints, single-agent chat replies (chat_reply), loading/
error/empty states. Mock data files kept as reference; nothing imports them.

~~PHASE 3 — Real agent execution and pipeline testing: run pipelines end-to-end with
a real Anthropic key (streamed tokens, live approval gates), wire the task "Run →"
button to agent execution, add pipeline creation UI.~~

~~Note (Session 8): tasks are single-agent execution units (TaskCard's "Run →" is
still unwired — "Coming soon"); pipelines are the multi-agent, LangGraph-orchestrated
flow with approval gates. Wiring the task Run button to real single-agent execution
is part of Phase 3, not done yet.~~

PHASE 3 COMPLETE (Session 9, 2026-07-16): Atlas eternal agent with the
create_agent tool, task "Run →" wired to real single-agent execution, CEO
execution-plan generation on pipeline creation, auto-pipeline suggestion
(CEO picks the team, Atlas fills gaps), pipeline archive/delete, onboarding
banner, cost protection ceilings, and open source docs (README rewrite,
CONTRIBUTING.md, MIT LICENSE).

SHIPPED — OPEN SOURCE PRODUCT. Remaining roadmap lives in the README feature
checklist (additional execution providers, memory re-embedding). ~~Real-key
end-to-end pipeline verification is still pending a live Anthropic key.~~
Real-key verification DONE (Session 12) — a live Anthropic key now sits in
the local vault; a full pipeline run, post-completion chat replies, and
image content blocks were all verified against the real API.

SESSION 14 (2026-07-22) — FINAL CLEANUP & SHIP: full lint cleanup (tsc,
eslint, and next build all pass clean — every remaining
react-hooks/set-state-in-effect error fixed), collapsible execution plan
drawer, conversation export (Markdown + print-to-PDF), continue-project
UX (new pipeline from a completed pipeline's workspace), and final docs.
All planned features are COMPLETE — the README feature checklist's only
unchecked items are the two roadmap entries (additional providers,
re-embedding). New sections below + Session 14 history entry.

SESSION 13 (2026-07-22) — CHAT POLISH, MULTI-IMAGE: post-completion
pipeline chat gets a poll-based fallback so a slow reply that outlasts the
client still lands without a refresh, multi-image chat attachments
(migration 009, message_images table), client-side image compression,
GFM table/inline-code markdown styling, and the last pre-existing ESLint
errors. New sections below + Session 13 history entry.

SESSION 11 (2026-07-16) — FINAL POLISH, SHIPPED PUBLICLY: persistent
post-completion pipeline chat, persisted tool call history (role
'tool_call' + migration 007), agent status dots/typing indicator,
approval-gate banner timing fix, GHCR image publishing (GitHub Actions),
docker-compose.prod.yml, and the one-command install.sh. Distribution
details in the "Distribution & Install" section below.

SESSION 12 (2026-07-21) — CHAT CONTEXT, IMAGES, POLISH: post-completion
pipeline chat now injects the full run transcript, Claude-style code
blocks with copy button, image attachments in chat (migration 008),
auto-plan freed from the CEO requirement, full agent edit modal,
existing-project auto-ingestion before the first agent runs, and the
first real-key end-to-end pipeline run. New sections below + Session 12
history entry.

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
- ~/forge-workspace is mounted into the backend container at /root/forge-workspace,
  so files agents write to a pipeline's workspace_path are visible on the host (Finder)
- Frontend has NO volume mounts (Session 10) — the image is rebuilt on every
  `docker compose up --build`. To apply frontend code changes, always run
  `docker compose up --build`; a plain `docker compose up` serves stale code
  from the last build. Backend keeps its bind-mount + `--reload`, so backend
  hot reload still works — this tradeoff is frontend-only.

## Distribution & Install (Session 11)

- .github/workflows/publish.yml builds and pushes ghcr.io/<owner>/forge-backend
  and forge-frontend on every push to main and on published releases; tags
  :latest and :<sha>, uses GHA layer caching, auth via GITHUB_TOKEN
  (permissions: packages write)
- docker-compose.prod.yml (repo root) runs Forge from the pre-built GHCR
  images — no build:, no source checkout; this is the file install.sh
  downloads into ~/.forge as its docker-compose.yml
- The dev docker-compose.yml services also carry image: tags with the GHCR
  names, so local builds are tagged consistently and `docker compose pull`
  works from a checkout too
- install.sh is the user-facing install path (README "Quick Install"):
  checks Docker + psql, downloads docker-compose.prod.yml + .env.example
  into ~/.forge, generates SECRET_KEY, creates the DB, applies
  001_initial.sql, then docker compose pull && up -d
- install.sh reads the "press Enter" prompt from /dev/tty (|| true), NOT
  stdin — under `curl | bash` stdin is the script itself and a bare read
  aborts at EOF under set -e. Keep this if the script is edited.

## Docker Notes
~~- Frontend uses named volumes (frontend_node_modules, frontend_next) instead of
  anonymous volumes — required for VirtioFS compatibility on Apple Silicon
- Named volumes are stored inside Docker's VM, VirtioFS never touches them
- If frontend breaks after Docker Desktop updates, run: docker compose down -v && docker compose up --build
- Do NOT switch back to anonymous volumes (/app/node_modules syntax) — causes corruption on VirtioFS
- PR #14 (running the frontend natively instead of in Docker) was closed in favor of
  this named-volumes fix — both addressed the same VirtioFS issue, but named volumes
  keep the two-service Docker Compose architecture intact
- A fresh named volume is NOT reliably pre-populated from the image's built node_modules
  (Docker's image→empty-volume copy did not fire consistently under this bind-mount +
  child-volume layout during testing on this machine, Docker Desktop 29.3.1/overlayfs).
  The frontend command therefore bootstraps itself: `[ -f node_modules/.install-complete ]
  || (npm ci && touch node_modules/.install-complete)` before `npm run dev` — first boot
  after a volume reset runs a real `npm ci` (~10-15s), later restarts skip it. Do not
  replace this with a bare `[ -d node_modules/next ]` check — a container killed mid-`npm ci`
  (e.g. a crash-loop) leaves a `next/` dir without `@swc/helpers`, and that weaker check
  treats the partial install as complete forever.~~
- Session 10: named volumes kept corrupting on this machine's Docker Desktop
  setup even after the VirtioFS fix above. The permanent fix is removing
  frontend volume mounts entirely — no bind mount, no named volumes, nothing
  for VirtioFS to corrupt. Hot reload is sacrificed for stability: the
  frontend Dockerfile does a normal `npm ci` + `COPY . .` at build time, and
  `docker compose up --build` is required after every frontend code change.
  Backend is unaffected (its bind-mount + `--reload` setup was never the
  source of the VirtioFS corruption, only frontend's node_modules churn was).

## Running Locally

- docker compose up --build
- Hot reload enabled via volume mounts on both frontend and backend.
- Postgres runs on host machine — containers connect via host.docker.internal.

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

## Cost Protection (Session 9)

- settings columns: max_run_cost ($5 default, per pipeline run), max_agent_cost
  ($2, per agent per run), max_daily_cost ($20, across ALL token_usage today —
  runs, task runs, chat, planning; it protects the budget, not a category)
- agent_executor._check_cost_limits runs before EVERY LLM call in the tool
  loop, counting persisted token_usage PLUS the current agent's in-flight
  tokens, so a runaway tool loop stops mid-agent
- Limits are re-read from the DB on each check — raising a ceiling in Settings
  takes effect immediately, even mid-run
- CostLimitExceeded subclasses ExecutionError, so the orchestrator's existing
  failure path (run 'failed', streamed error, notification) applies unchanged
- The executor's finally block persists partial token usage on ANY failure —
  burned tokens always land in token_usage or the guardrails would undercount

## Atlas & the Eternal Agent Pattern (Session 9)

- Eternal agents ship with Forge (agents.is_eternal = true) and cannot be
  deleted: DELETE /api/agents/{id} 403s, the AgentCard shows a ⚡ badge instead
  of the ⋯ menu, the detail page makes the system prompt read-only, and the
  store's DELETE_AGENT reducer ignores them (defense in depth)
- Atlas (fixed UUID 00000000-0000-0000-0000-000000000001) is seeded on every
  backend startup from backend/db/seeds/001_eternal_agents.sql — seed files
  are one-statement-per-file (asyncpg rejects multi-statement strings) and
  idempotent (ON CONFLICT DO NOTHING); a failed seed warns loudly but doesn't
  block startup (usual cause: unapplied migrations)
- Atlas's only job is creating agents via the create_agent tool
  (tool_registry.create_agent): exposed ONLY to eternal agents — appended to
  the tool list at call time and double-guarded at dispatch; creations are
  audited in file_access_log with operation='agent_created'
- chat_reply runs a bounded tool loop (5 iterations) for eternal agents so
  Atlas creates agents conversationally; regular agents stay tool-free in chat
- The conversation page refreshes the agent roster after eternal-agent replies
  and toasts each newly created agent
- Eternal agents are excluded from auto-suggest selection (they never perform
  pipeline tasks) and their amber ring (#f59e0b→#f97316) overrides avatar color

## Post-Completion Pipeline Chat Context (Session 12)

- chat_reply detects pipeline conversations (conversation.agent_id NULL +
  pipeline_id set) and loads the ENTIRE transcript instead of the
  40-message CHAT_HISTORY_LIMIT window
- _chat_turns (pure helper, unit-testable without DB or key) labels each
  assistant turn with the speaking agent's name ("[Aria] …"), elides
  transcripts >30 turns to first 5 + "[Summary: N messages omitted]" +
  last 20, and prepends the context note as a USER turn — user-first
  ordering is what stops the alternating-roles merge from dropping the
  (assistant-first) run history. That drop was the original "I don't have
  any previous context" bug.
- Image messages appear in history as "[image attached] <text>"; only the
  newest user message is sent as a real image content block (payload size)

## Image Attachments (Session 12; multi-image in Session 13)

- messages.image_data (raw base64, NO data: prefix) + image_media_type
  (VARCHAR(50)); migration 008, 001_initial.sql kept in step. Legacy
  single-image columns only — see message_images below for current writes.
- ~~POST /conversations/{id}/messages validates PNG/JPEG/GIF/WebP, caps at
  10M base64 chars (backend backstop; the 5MB frontend cap is the real
  limit, matching Anthropic's per-image API limit); empty content is
  allowed when an image is attached ("📷 Image" becomes last_message)~~
- Session 13: message_images table (migration 009, one row per image, FK
  ON DELETE CASCADE, sort_order) — up to 4 images per message. Legacy
  messages.image_data/image_media_type stay for pre-009 rows only; new
  writes always go through message_images. MessageCreate.images is a list
  (the old singular image_data/image_media_type fields still parse for
  older clients and fold into the same list). GET messages serializes
  defensively per-row (try/except, logs, falls back to no image) so a
  pre-008 install missing the legacy columns entirely doesn't 500 the
  whole page.
- 10M base64 chars stays the per-image backend backstop; the frontend now
  compresses client-side (canvas resize to max 1200x1200, JPEG @ 0.85) so
  the real ceiling is a 10MB *input* file, not 5MB — compression brings
  almost everything under 1MB before it's ever sent.
- components/chat/ImageAttachment.tsx: AttachImageButton (Paperclip via
  lucide-react, `multiple` + remainingSlots prop), ImagePreviewRow (staged
  thumbnail row, each independently removable, shows compressed size), and
  ImageAttachmentGroup for rendering a message's images in order. Message
  thumbnails are 240px max-width (was 400px), click-to-expand lightbox at
  z-40, Escape closes it.
- Both chat inputs support drag-and-drop onto the compose box (dashed
  amber border while dragging) in addition to the attach button; both cap
  at 4 images per message across click + drop combined.
- agent_executor.chat_reply fetches message_images for every user turn in
  a pipeline follow-up's history (for the "[image attached]" text
  stand-in) and for the latest turn (real image content blocks — multiple
  images send as multiple blocks ahead of the text block, Anthropic's
  multi-part content format); falls back to the legacy single-image
  column when a row predates 009.
- Images flow only through chat (chat_reply); pipeline/task executions do
  not receive image content

## Pipeline-per-Feature Pattern (Session 14)

- Each pipeline is a JOB, not a project: point multiple pipelines at the
  same workspace folder to build features incrementally; existing-project
  auto-ingestion (Session 12) means later pipelines start out knowing the
  files earlier ones wrote
- Continue-project UX: completed pipeline chat shows "Working on something
  new in this project?" + an amber "→ Start new pipeline in this workspace"
  link below the input; completed pipeline cards have "New Pipeline →" in
  their ⋯ menu — both open CreatePipelineModal with continueFrom set
- CreatePipelineModal.continueFrom ({workspacePath, fromTitle}) preselects
  "Existing folder", pre-fills the path, autofocuses Title, and shows
  "Continuing from: <title> — agents will see all existing files in this
  workspace." under the workspace field
- Cross-page handoff on create-from-chat: forge:toast (Session 8 pattern)
  plus NEW sessionStorage key forge:pending-plan — the pipelines page
  seeds its 3s plan-drafting poll list from it in a lazy useState
  initializer, so a pipeline created on the chat page still shows live
  plan progress after the redirect to /pipelines

## Conversation Export (Session 14)

- Export ↓ dropdown in the pipeline chat header (outlined secondary
  button, shown for running AND completed pipelines): Export as PDF /
  Export as Markdown
- lib/export.ts owns the pure builders (unit-testable, no React):
  buildConversationMarkdown, buildPrintHtml, slugify, exportFilename;
  exported roles are user/assistant/approval_gate/tool_call/system, tool
  calls render as code blocks, images as "[N images attached]" markers
- Markdown downloads via Blob + createObjectURL as
  <pipeline-title-slug>-<YYYY-MM-DD>.md (date = latest run's completed_at,
  else pipeline created_at)
- PDF is browser print: window.open + document.write of a print-formatted
  page (white bg, black text, escaped content, page-break-inside: avoid
  per message) with window.onload = window.print() — no PDF library; a
  blocked popup surfaces a toast instead of failing silently

## Collapsible Execution Plan (Session 14)

- The plan panel is a drawer: COLLAPSED BY DEFAULT to a 32px tab (📋 +
  "Plan" label in vertical writing-mode); clicking the tab slides the
  280px panel in via transform: translateX (200ms ease); a ‹ button in
  the open panel's header collapses it; chat takes the freed width
- Open/closed preference persists per pipeline in localStorage key
  forge:plan-open:<pipelineId> ("1" = open); read in a lazy useState
  initializer with a typeof window guard, written on every toggle
- remarkGfm + the shared .markdown-body class (Session 13) carried over
  unchanged — tables in plan_md render styled, not as raw pipes

## Existing Project Auto-Ingestion (Session 12)

- run_pipeline scans a non-empty workspace before building the graph:
  gitignore-aware walk (reuses tool_registry._load_gitignore/_is_ignored,
  same precedent as planner importing executor privates), skips dot-dirs
  and node_modules/dist/build/etc, lists up to 200 files, excerpts up to
  20 files under 50KB (1500 chars each; README/package.json/pyproject/
  docker-compose read first). Empty/missing workspace → no scan (fresh
  project). Scan failure logs but NEVER blocks the run.
- The summary is prepended to the FIRST agent's prior_context as a user
  turn; a role='system' "📁 Forge scanned your project — N files indexed"
  message is persisted to the pipeline conversation (pipeline chat now
  renders role='system' as a centered note); live viewers get a
  "scanned:N" status event which the frontend converts to a chat note —
  NOT a run status
- executor._normalize_turns merges prior context into user-first
  alternating turns and prepends a framing user turn when the list would
  start with assistant — this also fixed the latent agent-2+ bug where
  the messages array began with an assistant turn (the API rejects that;
  it had never surfaced because no real-key multi-agent run had executed)
- The frontend status handler now normalizes "running:<agent>" payloads
  to "running" — raw per-agent statuses previously leaked into
  displayStatus and misfired the not-running banners mid-run

## Auto-Plan — CEO Requirement Removed (Session 12)

- planner._pick_planner preference chain: role containing "ceo" → role
  containing "director"/"lead" → first candidate → oldest non-eternal
  agent on the roster; candidates checked before the roster-wide pass;
  eternal agents are never planners. Returns None only on an empty roster
  (existing degradation paths handle it).
- Create Pipeline toggle is now "Auto-plan with Forge", default ON when
  any non-eternal agent exists (was: only when an exact 'CEO' role
  existed); every user-facing CEO string replaced (pipeline cards, empty
  state, approve-endpoint 409 detail)
- CreateAgentModal's CEO role PRESET is intentionally kept — that's agent
  creation, not pipeline creation

## Task Runs (Session 9)

- POST /api/tasks/{id}/run executes the assigned agent in the background:
  reuses/creates the task's conversation (matched on task_id AND agent_id),
  persists the description as the user message, sets status in_progress,
  409s on double-run (module-level active-id set)
- execute_agent now accepts pipeline_run_id=None (task runs): streaming
  no-ops (no WS listener for the synthetic key), and approval-gated commands
  FAIL as tool errors instead of pausing — there is no gate UI outside
  pipelines, and a gated command must never silently run
- Task workspace: linked pipeline's workspace_path if any, else
  settings.workspace_root (the spec'd task.workspace_path column doesn't
  exist — tasks have no workspace of their own)
- Terminal statuses: 'review' on success (human verifies the output), back to
  'backlog' on failure (there is no 'failed' task status), with a
  notification + persisted error message either way
- The conversation page polls messages every 3s while its task is
  in_progress (merges by id, fetches the tail page ± 1) and shows a
  "working on this task…" indicator

## Auto-Pipeline Suggestion Flow (Session 9)

1. CreatePipelineModal toggle "Let CEO suggest the pipeline" (default on when
   a CEO-role agent exists) → POST /api/pipelines with auto_suggest=true and
   an empty agent_sequence (manual mode still requires ≥1 agent)
2. Background suggest_and_plan (services/planner.py): CEO returns JSON
   {agent_sequence, missing_agents, reasoning}; ids are validated against the
   roster (eternal agents excluded); for each missing agent Atlas is invoked
   with tool_choice forced to create_agent (deterministic non-LLM fallback if
   Atlas errors); created agents are appended after the existing ones
3. Reasoning persists to pipelines.suggestion_reasoning (004 migration) and
   renders as an expandable "CEO's Reasoning" section on the card
4. Then the normal plan generation runs (generate_execution_plan): planner =
   CEO in sequence → any CEO → first agent; LLM/key failures fall back to an
   editable default template — plan_md ALWAYS terminates non-empty, which is
   what stops the frontend's 3s poll (poll also stops on 404)
5. Degradation: no roster → explanatory reasoning, empty sequence; no API
   key/parse failure → CEO-alone sequence with the reason recorded

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
- Z-index convention (Session 8): toast notifications z-50, modals/overlays
  z-40, dropdown menus z-30, slide-over panels z-20, sidebar z-10, pipeline
  execution plan panel z-10. Sidebar needs an explicit z-index (not just
  `fixed`) because `position: fixed` always creates its own stacking
  context — without one it loses paint-order ties to later, non-positioned
  main content, which is what buried the NotificationBell dropdown under
  the execution plan panel before this was fixed.

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
  lib/mock-data.ts                    — reference only since Session 6 (no imports)
  lib/analytics-mock-data.ts          — reference only since Session 6 (no imports)
  lib/api.ts                          — typed client for every backend endpoint
  lib/store.tsx                       — global Context+useReducer store (Session 6)
  components/LoadingSkeleton.tsx      — card/row/text pulse skeletons (Session 6)
  components/ErrorState.tsx           — error card with retry (Session 6)
  components/EmptyState.tsx           — icon/title/CTA empty card (Session 6)
  components/ErrorBanner.tsx          — global store.error banner in layout (Session 6)
  components/OnboardingBanner.tsx     — first-run welcome card, localStorage dismiss (Session 9)
  components/chat/CodeBlock.tsx       — Claude-style code block + copy button and the
                                        shared chatMarkdownComponents map (Session 12)
  components/chat/ImageAttachment.tsx — attach button, staged preview, message
                                        thumbnail + lightbox (Session 12)
  components/chat/ExportMenu.tsx      — Export ↓ dropdown in the pipeline chat
                                        header (Session 14)
  lib/export.ts                       — conversation export builders: Markdown
                                        download + print-to-PDF HTML (Session 14)
  components/agents/EditAgentModal.tsx — full agent editor; read-only for eternal
                                        agents (Session 12)
```

New component SUBDIRECTORIES (components/chat/, components/agents/) were
introduced in Session 12 for new files only — everything pre-existing stays
flat in components/.

## Backend File Structure (created in Session 5)

```
backend/
  main.py
  routers/
    agents.py, pipelines.py, tasks.py
    conversations.py, settings.py, notifications.py
  services/
    orchestrator.py, agent_executor.py, tool_registry.py
    memory_service.py, streaming.py, crypto.py
    planner.py                       — CEO plan generation + auto-suggest (Session 9)
  db/
    connection.py, models.py
    migrations/001_initial.sql       — full schema for fresh installs (kept current)
    migrations/002–006_*.sql         — upgrades: is_eternal, agent_created log op,
                                       suggestion_reasoning, archive, cost limits (Session 9)
    migrations/007_tool_call_messages.sql — role CHECK gains 'tool_call' (Session 11)
    migrations/008_chat_images.sql   — messages.image_data + image_media_type (Session 12)
    migrations/009_message_images.sql — message_images table, multi-image (Session 13)
    seeds/001_eternal_agents.sql     — Atlas; run on every startup (Session 9)
  requirements.txt
  Dockerfile
```

## What NOT to build

- ~~Multi-user auth (single user only)~~ ~~Multi-user auth — not planned~~
  Team collaboration (multi-user) is a README Roadmap idea (Session 11) —
  still not to be built until explicitly scheduled
- Cloud deployment (local first, Docker is enough)
- Drag and drop kanban
- ~~Voice interface (Meridian integration — future phase)~~ ~~Voice interface — not planned~~
  Voice interface is a README Roadmap idea (Session 11) — still not to be
  built until explicitly scheduled
- Payment/billing

## Known Limitations

- Single user only — no authentication or multi-tenancy
- Local filesystem only — workspaces live on this machine, no cloud storage
- Requires Docker Desktop on Mac (frontend + backend containers; Postgres
  stays on the host)
- Agent execution is Anthropic-only today; other providers' keys are stored
  and testable in the vault but don't run agents yet
- Command approval gates exist only in pipeline runs — standalone task runs
  fail gated commands instead of pausing
- Image attachments are chat-only — pipeline/task agent executions never
  receive image content, and only the newest user message carries the real
  image block (history keeps "[image attached]" text markers)
- Messages persisted by installs predating the newer migrations (e.g.
  pre-007 role values or missing image columns) can fail row
  serialization — the messages endpoint renders those rows as placeholder
  notices instead of 500ing the page, so old conversations load with
  gaps rather than crashing
- install.sh requires the GHCR images to be published (a push to main
  must have run .github/workflows/publish.yml) — on a fork or before
  first publish, use the build-from-source path instead
- Single user only — no authentication (also listed above; it is the
  first limitation new deployers should know)

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

### Session 5 (2026-07-15) — Backend foundation

**Monorepo & tooling**
- Next.js app moved to /frontend via `git mv` (history preserved); backend at /backend
- requirements.txt pins voyageai==0.3.2 (correct for the python:3.11-slim Docker image);
  local dev on Python 3.13 needs voyageai>=0.3.3 in its venv — the pin is Docker-first
- .dockerignore files keep node_modules/.venv out of image build contexts
- backend/.env (gitignored) holds local DATABASE_URL + SECRET_KEY; root .env feeds compose

**Database**
- SQLAlchemy 2.0 mapped_column models mirror migrations/001_initial.sql (SQL is source of truth)
- `Base.type_annotation_map = {datetime: DateTime(timezone=True)}` is REQUIRED — every
  migration column is TIMESTAMPTZ, and without the map asyncpg rejects aware datetimes
- agents.tokens_used / cost_usd are never stored — always aggregated from token_usage
- api_keys stores key_last4 so list endpoints mask ("••••••••abcd") without decrypting

**Crypto**
- AES-256-GCM; stored format base64(12-byte nonce || ciphertext+tag); key = SHA-256(SECRET_KEY)
- `python -m services.crypto` runs the round-trip self-test

**Tool registry / security model**
- Policy precedence: denied list (hard block) > strict_mode (approval for everything)
  > allowed list (always runs) > terminal_execution mode
- 'agent_decides' = allowlist-only; anything else still requires approval (safe reading)
- Command list matching: exact or word-boundary prefix ("rm" blocks "rm -rf x", not "rmdir")
- Path safety resolves symlinks before the containment check; run_command hard timeout 60s

**Orchestration**
- Two gate kinds share one resume flow: executor command gates and the orchestrator
  phase gate both set pipeline_runs.status='paused_for_approval'; approve-gate endpoint
  flips it to 'approved'; a 2s poller flips it back to 'running' and resumes
- Phase gate placement: `<!-- gate_after: N -->` marker in plan_md wins; else a
  "## Phase 2" heading gates after agent 0; else no gate (single-agent pipelines)
- Phase gate uses LangGraph dynamic interrupt() as the FIRST statement of the gated
  node (nodes re-execute from the top on resume); MemorySaver checkpointer is
  process-local, which matches the single-backend deployment
- If an agent has no task in the pipeline, the orchestrator synthesizes AND persists
  one (agent_memory.source_task_id FK requires a real row)
- Background runs are asyncio tasks held in a module-level set (GC protection)

**Frontend API client**
- lib/api.ts + "Backend*" wire types appended to types/index.ts; the mock-phase
  interfaces are untouched so the existing UI keeps compiling until the wiring session
- WS envelope is a discriminated union (PipelineStreamEvent) keyed on event type

**Verification status**
- Everything DB/HTTP-level tested against local Postgres; orchestrator interrupt/resume
  verified with a stubbed executor; real LLM calls untested (no live API key)
- Docker daemon wasn't running locally: `docker compose config` validated, image builds not run

### Session 6 (2026-07-15) — Frontend wiring

**Global store pattern (lib/store.tsx)**
- React Context + useReducer, no external library; file is .tsx (provider renders JSX)
- ForgeProvider fetches agents/tasks/pipelines/notifications in parallel on mount
  via Promise.allSettled — partial failures populate what loaded and set store.error
  (rendered by the dismissible ErrorBanner in layout.tsx, Retry calls store.reload())
- Discriminated-union actions: SET_*/ADD_*/UPDATE_*/DELETE_AGENT/MARK_NOTIFICATION_*
  /SET_LOADING/SET_ERROR; hooks useForge()/useAgent(id)/usePipeline(id)
- Store holds Backend* wire types; components' props widened from mock Agent/Task to
  BackendAgent/BackendTask (mock types remain assignable, so nothing else broke)
- Optimistic mutation pattern: dispatch optimistic UPDATE_* → await PATCH → dispatch
  server truth; revert to the saved previous object + toast on error

**WebSocket handling pattern (pipelines/[id]/chat)**
- Persisted history (conversation messages) and live socket items are SEPARATE lists;
  live items: stream (token accumulation per agent), tool (call + attached result),
  gate, note. On 'complete' the live list is dropped and DB messages reloaded — the
  executor persisted everything, so DB truth replaces the stream without duplicates
- token events append to the trailing stream item only if agent_id matches, else a
  new bubble starts (agent handoffs split correctly)
- tool_result attaches to the newest tool item without a result (executor is
  sequential within an agent)
- Active run detection: pipeline detail current_run in (running|paused_for_approval|
  approved); otherwise a banner offers "Approve & Start" (POST /approve also restarts
  completed/failed pipelines)
- UI mirrors the orchestrator's conversation pick: OLDEST conversation with that
  pipeline_id (orchestrator _get_or_create_conversation orders by created_at)

**Backend endpoints added this session**
- GET /api/token-usage?agent_id&interval=day|week|month|all — bucketed sums
  (hour/day/week/month via date_trunc); frontend zero-fills fixed UTC slot ranges
- GET /api/analytics/cost?interval&providers= — per provider+model+bucket slices;
  bucket label = ISO timestamp, frontend formats labels + assigns provider palettes
- GET /api/agents/{id}/runs — runs of pipelines containing the agent, with the
  agent's per-run token/cost sums (token_usage outerjoin), newest first, limit 50
- POST /api/settings/api-keys/{id}/test — decrypts and probes the provider
  (anthropic /v1/models, voyage 1-token embed, openai /v1/models, else base_url
  /models); returns {success, message}, never raises for a bad key
- POST /api/settings/reembed — stub returning {"status": "coming_soon"}
- POST /conversations/{id}/messages now returns SendMessageOut {user_message,
  assistant_message, error}: agent conversations run agent_executor.chat_reply()
  (single non-streaming completion, no tools, memory recall, history merged to
  user-first alternating turns); pipeline conversations never auto-reply; reply
  failures return error text WITHOUT losing the saved user message

**Other decisions**
- frontend/.env.local (gitignored): NEXT_PUBLIC_API_URL + NEXT_PUBLIC_WS_URL
- Settings page has a new "Security & Execution" card (terminal_execution dropdown,
  strict_mode toggle, allowed/denied command textareas one-per-line) → PATCH /api/settings
- AddProviderModal now requires a key (vault stores encrypted keys, min 4 chars)
- Postgres date_trunc runs in the server session timezone (buckets land at 04:00Z
  for EDT); frontend matches points to slots by time-range, not exact equality
- zsh `echo` mangles \n inside JSON — use printf when piping curl responses
- Smoke test (Playwright, live backend): all flows pass; streamed tokens + live
  gates need a real Anthropic key (fake key verifies the error paths end-to-end)

### Session 7 (2026-07-15) — Chat/agent fixes + workspace, delete/rename conversation

- workspace_path is set at pipeline creation (CreatePipelineModal: "New project" →
  ~/forge-workspace/{title}/, or "Existing folder" → free-text path); POST
  /api/pipelines defaults and os.makedirs(exist_ok=True) when not provided; shown
  on the pipeline card and in the pipeline chat header
- Task conversations require task_id to be set at conversation creation time —
  the agent page's "+ General Chat" now shows a "Link to a task (optional)"
  picker (this agent's tasks + "No task (general)") when the agent has tasks
- GET /api/agents/{id}/runs already existed and was already correct
  (Pipeline.agent_sequence.contains([agent_id]) compiles to the `@>` array
  operator); "Run History empty" was empty test data, not a query bug — verified
  by inserting a real pipeline/run/agent_sequence row and confirming the endpoint
  returned it, not a code defect
- Conversations can be renamed and deleted via a shared "⋯" ConversationMenu
  component (agent conversation header + /chat row): Delete opens ConfirmDialog →
  DELETE /api/conversations/{id} (already existed); Rename opens an inline title
  edit (Enter/Escape) → new PATCH /api/conversations/{id} ({title}); both dispatch
  UPDATE_CONVERSATION/DELETE_CONVERSATION so /chat's store-backed list and the
  agent page's local sidebar list stay in sync without a refetch
- Delete/rename share one row-layout restructure (Link content vs. the menu must
  be siblings, not nested, or the menu's stopPropagation still lets the anchor's
  native click through) — shipped as one commit rather than two, since splitting
  by feature would leave an artificial half-wired intermediate state

### Session 8 (2026-07-16) — Z-index audit, escape key, delete agent/task, model dropdown

- Z-index convention established (see Design System section above); AgentCard's
  and TaskCard's overlay menus follow the same "sibling to the Link/onClick
  target, not nested inside it" pattern documented in Session 7
- Escape-to-close added to every modal/panel via a per-component
  `useEffect` + `document.addEventListener("keydown", ...)`; ConfirmDialog
  nested inside another modal will close both on Escape (each has its own
  listener) — acceptable since Escape closing "too much" is safer than not
  closing enough
- Delete agent: backend already enforced the active-pipeline-run check
  (409 with a detail string) — frontend just needed to catch status 409
  specifically and show "Cannot delete agent with active pipeline runs"
  instead of the raw backend message
- Delete task: DELETE /api/tasks/{id} and the frontend deleteTask() call
  already existed; only DELETE_TASK was missing from the store's action
  union/reducer
- Auto-delete empty conversations (POST /api/conversations): after creating
  the new conversation, delete other conversations for the same agent_id
  where task_id IS NULL and there's no matching row in messages (outer join
  filtered to Message.id IS NULL) — applies to general chats only, task
  conversations are expected to sit empty until used
- Delete conversation success toast: the conversation page unmounts on
  navigation before a same-page toast can render, so the message is handed
  off via `sessionStorage["forge:toast"]` and read once on the agent page's
  mount — first cross-page toast handoff in the codebase; reuse this pattern
  instead of inventing a new one if another flow needs a post-navigation toast
- Model dropdown (Create Agent): fetches GET /api/settings/api-keys and
  groups a hardcoded per-provider model list by which providers have a key
  configured; default selection is a derived value computed in render
  (`model || availableGroups[0]?.models[0]`), not a `useEffect` that calls
  `setState` — the project's eslint config (react-hooks/set-state-in-effect)
  flags that pattern as an error

### Session 9 (2026-07-16) — Ship-ready: Atlas, task runs, auto-pipeline, cost protection, open source

- Migration discipline established: 001_initial.sql stays the complete schema
  for fresh installs; every schema change ALSO ships as a numbered idempotent
  upgrade migration (002 is_eternal, 003 agent_created log op, 004
  suggestion_reasoning, 005 archived_at + status CHECK, 006 cost columns) —
  run all in order works for both cases
- Seeds vs migrations: db/seeds/ files run on EVERY startup (main.py lifespan)
  and must be single-statement + idempotent; migrations run once via psql
- The spec'd seed columns didn't all exist (agents has no updated_at; tasks
  has assigned_to not assigned_agent_id; settings has workspace_root not
  default_workspace_path) — schema is source of truth, seed/endpoints adapted
- execute_agent's pipeline_run_id is now Optional; task runs pass None →
  streaming no-ops and gated commands raise ToolError (never silently run,
  never dead-wait on a gate no UI can approve)
- Executor cost guardrails count in-flight tokens and re-read limits fresh
  per check; partial usage persists from finally on any failure so
  token_usage never undercounts (guardrails read it)
- planner.py owns both CEO flows; every background path terminates in a
  non-empty plan_md — that invariant is what stops the frontend 3s poll, so
  keep it when touching plan generation
- Atlas creation in auto-suggest uses tool_choice={"type":"tool"} to force
  the create_agent call; a deterministic non-LLM fallback synthesizes the
  agent if Atlas errors (name = role, generic pipeline prompt)
- Pipeline delete relies on FK cascades (runs/conversations/messages CASCADE;
  tasks/token_usage SET NULL) — no manual cleanup queries; archive/delete
  both 409 while a run is in ('running','paused_for_approval','approved')
- Pipelines page card extracted into PipelineCard (menu state per card, same
  outside-click pattern as AgentCard); ARCHIVE_PIPELINE/DELETE_PIPELINE/
  UPDATE_PIPELINE added to the store union
- Onboarding banner gates on agents.length === 1 && agents[0].is_eternal &&
  tasks.length === 0; dismissal key "forge:onboarding-dismissed"; the banner
  reveals AFTER a mount-time localStorage check so SSR and client agree
- Deviation from session spec, on purpose: frontend/.next stays gitignored —
  named volumes are populated at container runtime, never from git, and
  committing build cache would bloat the repo (spec's stated reason was
  factually wrong); .env/.venv/graphify ignores were already correct
- README rewritten as a capability landing page in the same session commit
  block as this CLAUDE.md update (G9 commit precedes G10; both this session)
- Verification without a real Anthropic key: every LLM-dependent path was
  exercised to its fallback (plan template, CEO-alone suggestion, task-run
  failure bookkeeping) against local Postgres; streamed real-key runs remain
  Phase-3-verification debt

### Session 11 (2026-07-16) — Final polish & public ship: persistent chat, tool history, indicators, GHCR, installer

- Sessions 10/10.x (same day, PRs #16–#19) were Docker-stability and UX-fix
  sessions recorded in claude-mem, not here; the "Session 10" references in
  the Docker sections above come from them
- Persistent pipeline chat: completed/failed pipelines keep the chat input
  enabled ("Continue working with your agents..." / "Ask your agents what
  went wrong..."); Run Again/Retry button and the finished-run status bar
  are gone; 'running' now DISABLES the input (agents are busy — previously
  it was enabled)
- Post-completion message routing lives in routers/conversations.py (the
  spec named pipelines.py, but POST /conversations/{id}/messages is the
  endpoint that receives the message): _pipeline_reply_agent picks the
  @mentioned participant (earliest mention wins, matched as
  "@"+agent.name case-insensitive), else the last agent who spoke, else
  the last agent in agent_sequence — only when pipeline.status is
  completed/failed; active runs still flow through the orchestrator
- chat_reply(conversation_id, agent_id=None): the override lets a
  pipeline-level conversation (agent_id null) reply as a chosen agent;
  reply Messages carry that agent_id so the UI shows name/color
- Tool call persistence: executor writes a role='tool_call' Message
  (content = JSON {tool_name, args, status, result_summary}) before each
  tool runs and updates it to 'completed' with a 200-char result summary
  after; string args truncated to 500 chars (write_file content would
  bloat rows). Migration 007 recreates messages_role_check with
  'tool_call'; 001_initial.sql updated in step
- ToolCallCard is the shared renderer for live socket tool events AND
  persisted tool_call history (running pulses via animate-pulse);
  summarizeToolArgs picks path/command/query for the one-line summary
- Participants sidebar: markActivity() tracks per-agent live state —
  token → 'streaming' (blue dot + staggered ••• typing indicator,
  reverts 3s after tokens stop), tool_call/tool_result/status →
  'executing' (green, 65s failsafe = command timeout + margin);
  complete/error clears all. CSS keyframes typingPulse in globals.css
- Gate-approve banner fix: isResuming set right after PATCH approve-gate
  succeeds suppresses both not-running notices until the next WS 'status'
  event confirms; also reconnects the socket immediately if it dropped
- install.sh dry-run harness (stubbed docker/psql/curl + fake HOME)
  caught that `read -p` under `curl | bash` aborts at EOF — fixed by
  reading from /dev/tty with || true; fresh install and re-run both
  verified exit 0
- Migration 007 applied to the local forge DB; constraint verified via
  pg_get_constraintdef
- README restructured: Quick Install (curl | bash) at top, old Quick
  Start renamed "For Developers (build from source)", Distribution row +
  GHCR paragraph in Tech Stack, new Roadmap section (voice, marketplace,
  multi-user, cloud) — What NOT to build above updated to match

### Session 12 (2026-07-21) — Chat context, images, code blocks, auto-plan, agent edit, ingestion

- Group 1 root cause: pipeline conversations are assistant-first, and
  chat_reply's "drop anything before the first user turn" merge deleted the
  entire run history — agents literally only ever saw the new question. The
  context note as a leading USER turn fixes the ordering structurally (no
  special-casing in the merge); _chat_turns extracted as a pure helper so
  it's testable with in-memory Message objects, no DB or key
- The local vault now holds a REAL Anthropic key (added by the user between
  sessions). Verified live: pipeline follow-up answers from planted history
  ("what color was the button?" → "Chartreuse."), image content blocks
  accepted end-to-end, and one full pipeline run (fixture project → scan →
  status completed → agent answered a codebase question with zero tool
  calls). Test agents/pipelines deleted afterward, including their
  token_usage rows, so analytics aren't polluted with probe noise
- JetBrains Mono loads via next/font/google (build-time self-hosted, same
  pattern as Geist, exposed as --font-jetbrains-mono) rather than a runtime
  Google Fonts CDN link — works offline after build; the spec's "CDN"
  wording was treated as "use the Google Fonts family"
- CodeBlock overrides ReactMarkdown's `pre`, NOT `code`: rehype-highlight
  has already rewritten children into hljs spans, so the language is parsed
  from the <code> child's className and Copy reads the rendered DOM's
  textContent (works regardless of highlighting)
- PROVIDER_MODELS + COLOR_PRESETS now export from CreateAgentModal and are
  reused by EditAgentModal; the edit modal PATCHes only changed fields and
  keeps an unlisted current model selectable as "<model> (current)"
- PATCH /api/agents/{id} 403s for eternal agents (defense in depth,
  mirrors DELETE); AgentUpdate gained avatar_color
- install.sh fresh installs are unaffected by 008 (001 carries the image
  columns); existing installs must run migration 008 once
- messages role CHECK already allowed 'system' since 001 — the scan notice
  needed no migration, only frontend rendering for the role
- sendUserMessage(text, image?) in pipeline chat takes the image as a
  parameter so ApprovalGateCard feedback sends never attach a staged image
- Pre-existing eslint errors (react-hooks/set-state-in-effect ×2 in
  agents/[id]/page.tsx, from Session 6/8 code) are untouched — not
  introduced this session, not this session's scope

### Session 13 (2026-07-22) — Chat refresh fix, multi-image, markdown polish, ESLint

- The two agents/[id]/page.tsx eslint errors flagged as "untouched" in
  Session 12 are fixed now: the sessionStorage toast read moved to a lazy
  useState initializer (was a setState call inside a mount effect), and
  the loading-state reset on agent-id change moved to a render-phase
  state adjustment (React's documented pattern for resetting state on a
  prop change) instead of the top of the data-fetching effect. Other
  react-hooks/set-state-in-effect violations found elsewhere in the repo
  during this session's lint pass (settings/page.tsx, CostAnalyticsGraph,
  OnboardingBanner, TokenUsageGraph, the mention-detection effect in
  PipelineChatInput, the messages-loading effect in the agent conversation
  page) are pre-existing and out of this session's scope — confirmed
  against git history before leaving them alone.
- Multi-image chat: went with a dedicated message_images table (migration
  009) over cramming an array into the existing single-image columns or
  sending each staged image as its own message — matches how Slack/
  Discord/iMessage model multi-image messages and keeps context injection
  (pipeline follow-up chat) working on whole messages rather than
  fragmenting a user's turn across several DB rows. Legacy image_data/
  image_media_type columns are kept read-only for pre-009 rows; every new
  write goes through message_images only.
- Fix 1's "message appears but the reply never shows" bug doesn't come
  from a missing await — chat_reply already runs synchronously inside the
  POST handler and the original code already appended assistant_message
  from that single response. The real gap: a sufficiently slow generation
  (a large pipeline transcript, Session 12's whole-run context injection)
  can outlast the client's patience or a reverse proxy's timeout, in which
  case the reply still lands in Postgres but never reaches the browser.
  The fix is a fallback poll (2s interval, 60s timeout) that only kicks in
  when the response comes back without an assistant_message and without an
  error — the common case still resolves in the original request.
- remarkGfm was already wired into PipelineExecutionPlan but missing from
  both chat message renderers — without it, GFM tables never parsed at
  all (pipe characters just sat in a paragraph as plain text), so "broken
  tables" wasn't literally reproducible before this session. Adding
  remarkGfm plus styled table/thead/tbody/th/td components is what makes
  4A (invalid tables stay plain text) and 4E (valid tables render styled)
  both true at once — GFM's own grammar already requires a header-
  separator row before it treats anything as a table, so no custom
  validator was needed on top.
- Table/inline-code styling lives in globals.css under .markdown-body
  (shared class) rather than per-surface component overrides, so
  PipelineExecutionPlan picked up the same look by just adding the class
  — one CSS change instead of three duplicated component trees.

### Session 14 (2026-07-22) — Final cleanup & ship: lint-clean, plan drawer, export, continue-project

- The cleanup sweep found the codebase already free of console.log debug
  artifacts, stale TODOs, and commented-out code — the real work was the
  11 outstanding eslint problems (6 errors + 5 warnings) documented as
  out-of-scope in Session 13. All fixed; eslint AND tsc now pass with
  zero findings, so "lint not clean on main" notes in older memories are
  obsolete once this merges
- set-state-in-effect fixes used three patterns, each chosen to keep the
  existing behavior byte-identical: (1) render-phase state adjustment
  (track prev key in state, reset during render) for the loading resets
  in TokenUsageGraph/CostAnalyticsGraph/the conversation page; (2)
  useSyncExternalStore with a server snapshot of "dismissed" for
  OnboardingBanner's localStorage read (SSR-safe, no mount-effect
  setState); (3) derived-during-render state for PipelineChatInput's
  @mention query, with Escape dismissal stored as dismissedForValue ===
  value so typing anything revives the picker exactly like the old
  effect did
- settings page effect now calls listApiKeys().then(setKeys) inline
  instead of refreshKeys() — the linter can't see through an async
  wrapper whose first statement awaits; refreshKeys stays for the
  post-mutation call sites
- The dead participants prop was removed from PipelineChatMessage
  end-to-end (interface + both call sites) rather than silently
  un-destructured — tsc caught the second call site the lint warning
  didn't mention
- Execution plan drawer defaults to COLLAPSED (spec decision) — the
  localStorage key stores the OPEN state ("1" = open) so absent-key
  first visits collapse; per-pipeline key forge:plan-open:<id>
- Export deliberately ships without a PDF library: browser print via a
  new window is dependency-free and honors the user's page size/margins;
  markdown builders live in lib/export.ts so they stay testable without
  DOM
- README's "How it works" user-flow diagram says "your planning agent
  picks the team" where the session spec draft said "CEO picks agents" —
  Session 12 removed user-facing CEO strings on purpose, and README copy
  follows the product, not the draft
- forge:pending-plan sessionStorage handoff introduced (see
  Pipeline-per-Feature section) — reuse it if any other page ever
  creates a pipeline and redirects to /pipelines

## CLAUDE.md Rules

- Update at end of every session with new decisions
- Never remove content — strikethrough superseded items instead
- README.md updated in same commit as CLAUDE.md

## README Rules

- Features checklist with checkboxes
- Getting Started: clone, copy .env.example, run migration, docker compose up --build
- Architecture diagram
- Screenshot section
