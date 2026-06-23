# Graph Report - .  (2026-06-23)

## Corpus Check
- Corpus is ~10,707 words - fits in a single context window. You may not need a graph.

## Summary
- 77 nodes · 77 edges · 7 communities detected
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.75)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Design System & Docs|Design System & Docs]]
- [[_COMMUNITY_Core Entities & UI Pages|Core Entities & UI Pages]]
- [[_COMMUNITY_Dashboard & Task Pages|Dashboard & Task Pages]]
- [[_COMMUNITY_Architecture Decisions|Architecture Decisions]]
- [[_COMMUNITY_Tech Stack|Tech Stack]]
- [[_COMMUNITY_Agent & Chat Pages|Agent & Chat Pages]]
- [[_COMMUNITY_Future Roadmap|Future Roadmap]]

## God Nodes (most connected - your core abstractions)
1. `Forge — Multi-agent AI Orchestration Platform` - 19 edges
2. `Agent Entity: id, name, role, specialty, avatar_color, model, system_prompt, status, tokens_used, cost_usd` - 7 edges
3. `Conversation Entity: id, agent_id, task_id, pipeline_id, title, last_message` - 7 edges
4. `Data Shapes: Agent, Task, Pipeline, Conversation, Message` - 6 edges
5. `Task Entity: id, title, description, assigned_to, priority, status, pipeline_id` - 5 edges
6. `Mock Data Requirements: 8 agents (CEO/CTO/Architect/Frontend/Backend/Tester/Bug Patcher/PM), 10 tasks, 2 pipelines, 3 conversations` - 5 edges
7. `Tech Stack: Next.js 15, TypeScript, Tailwind CSS, Geist Font` - 4 edges
8. `Pipeline Entity: id, title, status (pending_approval/approved/running/completed), agents, plan_md` - 4 edges
9. `Pages: Dashboard, /agents, /agents/[id], /agents/[id]/conversations/[convId], /chat, /pipelines, /tasks` - 4 edges
10. `Session 1 Decisions (2026-06-23): Next.js 16.2.9, full file structure created` - 4 edges

## Surprising Connections (you probably didn't know these)
- `File/Document Icon SVG: generic file with text lines, gray (#666)` --conceptually_related_to--> `Forge — Multi-agent AI Orchestration Platform`  [INFERRED]
  public/file.svg → CLAUDE.md
- `Globe/World Icon SVG: globe with latitude/longitude lines, gray (#666)` --conceptually_related_to--> `Forge — Multi-agent AI Orchestration Platform`  [INFERRED]
  public/globe.svg → CLAUDE.md
- `Vercel Logo SVG: White triangle/chevron — Vercel deployment platform logo` --conceptually_related_to--> `Forge — Multi-agent AI Orchestration Platform`  [INFERRED]
  public/vercel.svg → CLAUDE.md
- `Window/Browser Icon SVG: browser window with three dots (traffic lights), gray (#666)` --conceptually_related_to--> `Forge — Multi-agent AI Orchestration Platform`  [INFERRED]
  public/window.svg → CLAUDE.md
- `Next.js Wordmark SVG: Official Next.js black wordmark logo` --references--> `Tech Stack: Next.js 15, TypeScript, Tailwind CSS, Geist Font`  [INFERRED]
  public/next.svg → CLAUDE.md

## Communities

### Community 0 - "Design System & Docs"
Cohesion: 0.16
Nodes (14): Agent Ring Colors: Gradient Color System per Agent Role, Components: Sidebar, AgentCard, TaskCard, Toast, CreateAgentModal, CreateTaskModal, Design System: Dark Theme with Amber Accent (#0a0a0a, #f59e0b), File Structure Rules: types/index.ts, lib/mock-data.ts, 150-line limit, Forge — Multi-agent AI Orchestration Platform, Git Workflow: feature branches from main, PR at session end, never commit to main, Sidebar Navigation: Forge logo, Dashboard/Agents/Pipelines/Tasks/Chat links, amber active state, File/Document Icon SVG: generic file with text lines, gray (#666) (+6 more)

### Community 1 - "Core Entities & UI Pages"
Cohesion: 0.4
Nodes (11): Agent Detail Page /agents/[id]: Task conversations, General Chat, system prompt, Agent Entity: id, name, role, specialty, avatar_color, model, system_prompt, status, tokens_used, cost_usd, Chat Window /agents/[id]/conversations/[convId]: Left sidebar, message bubbles, send input, Conversation Entity: id, agent_id, task_id, pipeline_id, title, last_message, Dashboard Page: Agent grid + Operations Kanban (Backlog/In Progress/Review/Completed), Data Shapes: Agent, Task, Pipeline, Conversation, Message, Message Entity: id, conversation_id, agent_id, role (user/assistant), content, Mock Data Requirements: 8 agents (CEO/CTO/Architect/Frontend/Backend/Tester/Bug Patcher/PM), 10 tasks, 2 pipelines, 3 conversations (+3 more)

### Community 2 - "Dashboard & Task Pages"
Cohesion: 0.25
Nodes (2): getAgent(), getCurrentTask()

### Community 3 - "Architecture Decisions"
Cohesion: 0.29
Nodes (7): Gradient Border Technique: wrapper div with padding:1px and background:linear-gradient for border-radius support, Current Phase: Mock UI Only (No Backend), Modal Fade Transition: .modal-overlay CSS class with fadeIn keyframe (150ms) in globals.css, Modals: Create Agent Modal, Create Task Modal, Session 1 Decisions (2026-06-23): Next.js 16.2.9, full file structure created, State Management: React useState for create operations, not persisted (mock phase intentional), Phase 1 Mock UI Foundation — Completed Features

### Community 5 - "Tech Stack"
Cohesion: 0.5
Nodes (4): AGENTS.md: Next.js version warning — read node_modules/next/dist/docs/ before writing code, Tech Stack: Next.js 15, TypeScript, Tailwind CSS, Geist Font, Next.js Wordmark SVG: Official Next.js black wordmark logo, Tech Stack Table: Next.js 16, TypeScript strict, Tailwind CSS v4, Geist font, React useState

### Community 6 - "Agent & Chat Pages"
Cohesion: 0.67
Nodes (1): timeAgo()

### Community 8 - "Future Roadmap"
Cohesion: 0.67
Nodes (3): Exclusions (No Backend): No API routes, no DB, no real LLM calls, no auth, no drag-drop, Phase 2 Backend Integration: Supabase, CRUD API, Realtime, RLS, Phase 3 Live Agent Execution: Anthropic Claude API, pipeline gates, auth, drag-drop kanban

## Knowledge Gaps
- **14 isolated node(s):** `Sidebar Navigation: Forge logo, Dashboard/Agents/Pipelines/Tasks/Chat links, amber active state`, `Git Workflow: feature branches from main, PR at session end, never commit to main`, `README: Forge Multi-agent AI Orchestration Dashboard`, `Phase 1 Mock UI Foundation — Completed Features`, `Phase 2 Backend Integration: Supabase, CRUD API, Realtime, RLS` (+9 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Dashboard & Task Pages`** (8 nodes): `page.tsx`, `page.tsx`, `page.tsx`, `getAgent()`, `getCurrentTask()`, `handleCreateAgent()`, `openModal()`, `openTaskModal()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Agent & Chat Pages`** (3 nodes): `page.tsx`, `page.tsx`, `timeAgo()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Forge — Multi-agent AI Orchestration Platform` connect `Design System & Docs` to `Future Roadmap`, `Core Entities & UI Pages`, `Architecture Decisions`, `Tech Stack`?**
  _High betweenness centrality (0.213) - this node is a cross-community bridge._
- **Why does `Tech Stack: Next.js 15, TypeScript, Tailwind CSS, Geist Font` connect `Tech Stack` to `Design System & Docs`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `Pages: Dashboard, /agents, /agents/[id], /agents/[id]/conversations/[convId], /chat, /pipelines, /tasks` connect `Core Entities & UI Pages` to `Design System & Docs`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `Forge — Multi-agent AI Orchestration Platform` (e.g. with `File/Document Icon SVG: generic file with text lines, gray (#666)` and `Globe/World Icon SVG: globe with latitude/longitude lines, gray (#666)`) actually correct?**
  _`Forge — Multi-agent AI Orchestration Platform` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Sidebar Navigation: Forge logo, Dashboard/Agents/Pipelines/Tasks/Chat links, amber active state`, `Git Workflow: feature branches from main, PR at session end, never commit to main`, `README: Forge Multi-agent AI Orchestration Dashboard` to the rest of the system?**
  _14 weakly-connected nodes found - possible documentation gaps or missing edges._