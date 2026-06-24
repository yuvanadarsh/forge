# Forge — Claude Code Project Instructions

## What is Forge

Forge is a multi-agent AI orchestration platform. Users spawn specialized AI agents
(CEO, Architect, Developer, Tester, etc), assign them tasks, and watch them execute
pipelines with human approval gates at critical steps. Think of it as an AI workforce
manager with a dashboard UI.

## Repository

https://github.com/yuvanadarsh/forge.git

## Git Workflow (ALWAYS follow this)

- At the start of every session: checkout a new branch from main
  Branch naming: feature/short-description (e.g. feature/mock-ui-dashboard)
- Make commits frequently — after every major component or page is complete
  Commit format: feat: add AgentCard component and AgentGrid layout
- At the end of every session: open a PR to main with a summary of what was built
- Never commit directly to main
- Always pull latest main before branching

## Current Phase

Mock UI only. No backend, no API calls, no database writes. Everything uses static
mock data from lib/mock-data.ts. Goal is a fully polished, interactive frontend.

## Tech Stack

- Next.js 15 (App Router)
- TypeScript (strict, never use `any`)
- Tailwind CSS
- Geist font (Next.js default)
- No UI component library — build everything from scratch with Tailwind
- No backend yet

## Design System

- Background: #0a0a0a
- Card background: #111111
- Card border: #1f1f1f
- Primary accent: #f59e0b (amber)
- Secondary accent: #3b82f6 (blue, for links/info)
- Success: #22c55e
- Error: #ef4444
- Text primary: #f5f5f5
- Text muted: #71717a
- Border radius: 12px on cards, 8px on inputs/buttons
- Transitions: 150ms ease on all hover states

## Agent Ring Colors (top border gradient per agent, cycle these)

- #6366f1 → #8b5cf6 (indigo/purple)
- #f59e0b → #ef4444 (amber/red)
- #3b82f6 → #06b6d4 (blue/cyan)
- #22c55e → #10b981 (green/emerald)
- #ec4899 → #f43f5e (pink/rose)
- #f97316 → #eab308 (orange/yellow)

## File Structure Rules

- All TypeScript interfaces → types/index.ts
- All mock data → lib/mock-data.ts
- Components are single-purpose and small
- No component should exceed 150 lines — split if needed
- Use Next.js App Router conventions throughout

## Data Shapes (implement all of these)

### Agent

id, name, role, specialty, avatar_color (hex), model, system_prompt,
status (idle/working/error), last_active, tokens_used, cost_usd, created_at

### Task

id, title, description, assigned_to (agent id), priority (low/med/high/urgent),
status (backlog/in_progress/review/completed), pipeline_id, created_from_chat,
created_at

### Pipeline

id, title, description, status (pending_approval/approved/running/completed),
agents (ordered agent id array), created_by (agent id), plan_md, approved_at

### Conversation

id, agent_id, task_id (nullable), pipeline_id (nullable), title,
last_message (nullable), last_active (nullable), created_at

### Message

id, conversation_id, agent_id, role (user/assistant), content, created_at

## Pages to Build

### / (Dashboard)

- Agent grid at top: cards with name, role, specialty, colored top border ring,
  status dot, last active, token count, cost, current task
- Operations kanban board below: Backlog / In Progress / Review / Completed columns
- Each task card: title, description snippet, priority badge, assigned agent avatar,
  "Run" button (mock)

### /agents/[id]

- Agent header: name, role, model badge, status
- Two sections: "Task Conversations" (list of convos tied to tasks) and
  "General Chat" button that starts a freeform convo
- Each task convo shows task title, last message preview, last active time

### /agents/[id]/conversations/[convId]

- Left sidebar: list of all this agent's conversations (switchable)
- Main area: chat window with message bubbles, timestamps
- Header shows which task this conversation is tied to (or "General")
- Input at bottom with send button

### /chat

- All conversations across all agents, grouped by agent
- Searchable
- Click takes you to /agents/[id]/conversations/[convId]

### /pipelines

- List of pipelines with status badge
- Click expands to show the plan_md rendered as markdown and the agent sequence

### /agents (agent registry)

- Full grid of all agents with a "+ Create Agent" button
- Same cards as dashboard but full page

## Modals to Build

### Create Agent Modal

- Fields: name, role (dropdown), specialty (text), model (dropdown of claude/gpt/gemini options),
  system_prompt (textarea), avatar_color (pick from 6 presets)
- Buttons: Cancel, Create Agent

### Create Task Modal

- Fields: title, description, assign_to (agent picker grid like reference UI),
  priority (radio), status (backlog default or in_progress)
- Buttons: Cancel, Add to Backlog / Start Now

## Mock Data Requirements

Create at least:

- 8 agents covering: CEO, CTO, Architect, Frontend Dev, Backend Dev, Tester,
  Bug Patcher, Project Manager
- 10 tasks spread across all kanban statuses
- 2 pipelines (one pending approval, one running)
- 3 conversations with 6+ messages each (realistic back-and-forth)

## Sidebar Navigation

Fixed left sidebar, always visible:

- Forge logo (hammer + lightning SVG) + "Forge" wordmark
- Nav items: Dashboard, Agents, Pipelines, Tasks, Chat
- Active state: amber left border + amber text
- Bottom: Settings link

## Behavior Notes

- All buttons are wired to open the correct modal or navigate correctly
- Modals open/close with smooth fade transition
- Kanban cards are NOT draggable yet (future phase)
- "Run" buttons on tasks show a toast "Coming soon" (mock)
- Creating an agent/task adds it to the mock data array in state (useState, not persisted)
- No form validation required yet

## What NOT to build yet

- No API routes
- No database connections
- No real LLM calls
- No authentication
- No drag and drop
- No real-time updates

## README.md Rules

- Keep README.md updated at the end of every session
- It should always reflect: what's been built, what's next, and how to run the project
- Include a features checklist with checkboxes that get checked as things are completed
- Screenshot section placeholder from day 1 (fill in as UI gets built)

## CLAUDE.md Rules

- This file is a living document — update it at the end of every session
- Add any new conventions, decisions, or architectural notes made during the session
- Never remove existing content unless it's been superseded — add a strikethrough note instead

---

## Session 1 Decisions (2026-06-23)

### Framework version
`create-next-app` installed Next.js 16.2.9 (latest). Proceeding with 16 — fully compatible with all patterns.

### File structure created this session
```
app/
  page.tsx                          — Dashboard (/)
  layout.tsx                        — Root layout with Sidebar
  globals.css                       — Design tokens + scrollbar styling
  agents/
    page.tsx                        — Agent registry (/agents)
    [id]/
      page.tsx                      — Agent detail (/agents/[id])
      conversations/
        [convId]/
          page.tsx                  — Chat window (/agents/[id]/conversations/[convId])
  chat/page.tsx                     — Global chat (/chat)
  pipelines/page.tsx                — Pipelines list (/pipelines)
  tasks/page.tsx                    — Tasks kanban (/tasks)
  settings/page.tsx                 — Settings placeholder (/settings)
components/
  Sidebar.tsx                       — Fixed left nav
  AgentCard.tsx                     — Agent card with gradient ring
  TaskCard.tsx                      — Kanban task card
  Toast.tsx                         — Fade-in/out toast notification
  CreateAgentModal.tsx              — New agent form modal
  CreateTaskModal.tsx               — New task form modal (with agent picker grid)
types/index.ts                      — All interfaces
lib/mock-data.ts                    — Static mock data (agents, tasks, pipelines, conversations, messages)
```

### Gradient border technique
Agent cards use a wrapper div with `padding: 1px` and `background: linear-gradient(...)` to achieve gradient borders that respect `border-radius`. CSS `border-image` doesn't support border-radius.

### Modal fade transition
Modals use the `.modal-overlay` CSS class (defined in `globals.css`) which applies a `fadeIn` keyframe animation (150ms). This is the standard approach for all modals.

### Conversation routing
`/agents/[id]/conversations/new` is a valid route — the conversation page handles `convId === "new"` by starting with an empty message list.

### State management
All create operations (agents, tasks) use local React `useState` — data is not persisted across page navigations or refreshes. This is intentional for the mock phase.

---

## Session 2 Decisions (2026-06-23)

### New dependencies added
- `recharts` — token usage bar chart on agent detail page
- `react-markdown` + `rehype-highlight` + `highlight.js` — markdown and code syntax highlighting in chat messages
- CSS for highlight.js (`github-dark` theme) imported in `globals.css` via `@import "highlight.js/styles/github-dark.css"`

### New components created
```
components/
  TaskSlideOver.tsx         — Slide-over panel for task detail (400px, right side, .slide-over CSS animation)
  TokenUsageGraph.tsx       — Recharts bar chart with Day/Week/Month/All Time toggle; generates deterministic mock data from agent.tokens_used
  EditPipelineModal.tsx     — Edit pipeline title and reorder/add agents with up/down arrows (no drag-drop yet)
```

### AgentCard height fix
Added `h-full` to both the `Link` wrapper and the gradient border wrapper div. Grid uses `items-stretch` to equalize row heights.

### Create Agent modal — role preset system
Replaced the locked role dropdown with a two-level approach:
1. A "Role Preset" dropdown (12 options + Custom) that auto-fills role title, specialty, and system_prompt as suggestions
2. A separate "Role Title" text input that the user can freely edit after preset selection
Model dropdown removed — replaced with a static info note "Model assigned in Settings"

### Task interactions (TaskCard, dashboard, /tasks)
- `TaskCard` now accepts optional `onClick` and `onMove` props
- `Move →` dropdown renders above the card (absolute-positioned, `bottom-full`) and stops event propagation
- Clicking the card body opens the `TaskSlideOver` panel
- `handleMoveTask` updates both the tasks array and the currently-open slide-over task reference in sync

### Agent detail page — made client component
`/agents/[id]/page.tsx` now has `"use client"` directive since it needs `useState` for system prompt editing. Uses `use(params)` from React 19 which works in client components.

### Chat window — markdown rendering
Only assistant messages (`role === "assistant"`) go through `ReactMarkdown`. User messages use plain `whitespace-pre-wrap` to avoid double-rendering markdown in sent text.

### /chat page redesign
Removed grouped-by-agent header rows. Rows now use `borderLeft: 3px solid pair[0]` (the agent's primary gradient color) as the visual grouping signal.

### Settings page — API keys
Keys stored in React `useState` as plaintext (mock only). In production these would be encrypted server-side. The "Test" and "Re-embed" buttons both show Coming Soon toast.

### Export Data
Uses browser `Blob` + `URL.createObjectURL` + temporary `<a>` element to trigger JSON file download directly from mock data. Works without any server-side code.

### Pipeline editing
`mockPipelines` is copied into local state on the Pipelines page so edits are reflected in the same session. The "Add Agent" picker in the edit modal filters out agents already in the sequence.

### .env.example
Added at repo root with `DATABASE_URL` and `NEXTJS_PORT` as placeholder structure for future backend integration.
