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

### Phase 2 — Backend Integration ⬜

- [ ] Supabase database schema and migrations
- [ ] CRUD API for agents, tasks, pipelines, conversations
- [ ] Real-time updates via Supabase Realtime
- [ ] Row Level Security policies
- [ ] Replace mock data with live API calls
- [ ] Loading and error states throughout

### Phase 3 — Live Agent Execution ⬜

- [ ] Real LLM calls via Anthropic Claude API
- [ ] Pipeline approval gate enforcement
- [ ] Drag-and-drop kanban
- [ ] Authentication (Supabase Auth)
- [ ] Real-time agent status updates

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Font | Geist (via `next/font/google`) |
| Charts | recharts |
| Markdown | react-markdown + rehype-highlight + highlight.js |
| State | React `useState` (mock phase) |
| Data | Static mock data in `lib/mock-data.ts` |

No UI component library — everything built from scratch with Tailwind.

---

## Run Locally

```bash
# Clone
git clone https://github.com/yuvanadarsh/forge.git
cd forge

# Install
npm install

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Build check:**
```bash
npm run build
```

---

## Project Structure

```
app/
  page.tsx                    Dashboard (/)
  layout.tsx                  Root layout + sidebar
  agents/page.tsx             Agent registry
  agents/[id]/page.tsx        Agent detail (editable system prompt + token graph)
  agents/[id]/conversations/[convId]/page.tsx  Chat window (markdown rendering)
  chat/page.tsx               Global chat (single-row density layout)
  pipelines/page.tsx          Pipelines (edit modal with reorderable agents)
  tasks/page.tsx              Tasks kanban (move-to + slide-over)
  settings/page.tsx           Settings (API keys, embeddings, export)
components/
  Sidebar.tsx                 Fixed left navigation
  AgentCard.tsx               Gradient-border agent card (equal height)
  TaskCard.tsx                Kanban task card (move-to dropdown)
  TaskSlideOver.tsx           Task detail slide-over panel
  TokenUsageGraph.tsx         Recharts bar chart with interval toggle
  EditPipelineModal.tsx       Pipeline edit modal with agent reordering
  Toast.tsx                   Fade toast notification
  CreateAgentModal.tsx        New agent form (role presets)
  CreateTaskModal.tsx         New task form
lib/
  mock-data.ts                All static mock data
types/
  index.ts                    TypeScript interfaces
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
