# Graph Report - forge  (2026-07-15)

## Corpus Check
- 36 files · ~18,116 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 172 nodes · 191 edges · 10 communities detected
- Extraction: 84% EXTRACTED · 16% INFERRED · 0% AMBIGUOUS · INFERRED: 30 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]

## God Nodes (most connected - your core abstractions)
1. `Forge — Multi-agent AI Orchestration Platform` - 19 edges
2. `Phase 1 - Mock UI Foundation` - 14 edges
3. `Forge Platform` - 12 edges
4. `Forge` - 10 edges
5. `Agent Entity: id, name, role, specialty, avatar_color, model, system_prompt, status, tokens_used, cost_usd` - 7 edges
6. `Conversation Entity: id, agent_id, task_id, pipeline_id, title, last_message` - 7 edges
7. `Tech Stack` - 7 edges
8. `TypeScript Interfaces (types/index.ts)` - 7 edges
9. `Data Shapes: Agent, Task, Pipeline, Conversation, Message` - 6 edges
10. `Session 1 Decisions (2026-06-23)` - 6 edges

## Surprising Connections (you probably didn't know these)
- `Forge — Multi-agent AI Orchestration Platform` --conceptually_related_to--> `File/Document Icon SVG: generic file with text lines, gray (#666)`  [INFERRED]
  CLAUDE.md → public/file.svg
- `Forge — Multi-agent AI Orchestration Platform` --conceptually_related_to--> `Globe/World Icon SVG: globe with latitude/longitude lines, gray (#666)`  [INFERRED]
  CLAUDE.md → public/globe.svg
- `Forge — Multi-agent AI Orchestration Platform` --conceptually_related_to--> `Vercel Logo SVG: White triangle/chevron — Vercel deployment platform logo`  [INFERRED]
  CLAUDE.md → public/vercel.svg
- `Forge — Multi-agent AI Orchestration Platform` --conceptually_related_to--> `Window/Browser Icon SVG: browser window with three dots (traffic lights), gray (#666)`  [INFERRED]
  CLAUDE.md → public/window.svg
- `Tech Stack: Next.js 15, TypeScript, Tailwind CSS, Geist Font` --references--> `Next.js Wordmark SVG: Official Next.js black wordmark logo`  [INFERRED]
  CLAUDE.md → public/next.svg

## Communities

### Community 0 - "Community 0"
Cohesion: 0.09
Nodes (28): Behavior Notes, Export Data (Blob download), Modal Fade Transition, Modals: Create Agent Modal, Create Task Modal, Pipeline Editing, Role Preset System (Create Agent Modal), Session 2 Decisions (2026-06-23), Settings Page API Keys (+20 more)

### Community 1 - "Community 1"
Cohesion: 0.17
Nodes (18): Agent Data Shape, Agent Ring Colors, Conversation Data Shape, Design System (CLAUDE.md), File Structure Rules, Forge Platform, Human Approval Gates, Kanban Board (+10 more)

### Community 2 - "Community 2"
Cohesion: 0.15
Nodes (14): Components: Sidebar, AgentCard, TaskCard, Toast, CreateAgentModal, CreateTaskModal, File Structure Rules: types/index.ts, lib/mock-data.ts, 150-line limit, Forge — Multi-agent AI Orchestration Platform, Git Workflow, Exclusions (No Backend): No API routes, no DB, no real LLM calls, no auth, no drag-drop, Sidebar Navigation: Forge logo, Dashboard/Agents/Pipelines/Tasks/Chat links, amber active state, File/Document Icon SVG: generic file with text lines, gray (#666), Globe/World Icon SVG: globe with latitude/longitude lines, gray (#666) (+6 more)

### Community 3 - "Community 3"
Cohesion: 0.4
Nodes (11): Agent Detail Page /agents/[id]: Task conversations, General Chat, system prompt, Agent Entity: id, name, role, specialty, avatar_color, model, system_prompt, status, tokens_used, cost_usd, Chat Window /agents/[id]/conversations/[convId]: Left sidebar, message bubbles, send input, Conversation Entity: id, agent_id, task_id, pipeline_id, title, last_message, Dashboard Page: Agent grid + Operations Kanban (Backlog/In Progress/Review/Completed), Data Shapes: Agent, Task, Pipeline, Conversation, Message, Message Entity: id, conversation_id, agent_id, role (user/assistant), content, Mock Data Requirements: 8 agents (CEO/CTO/Architect/Frontend/Backend/Tester/Bug Patcher/PM), 10 tasks, 2 pipelines, 3 conversations (+3 more)

### Community 4 - "Community 4"
Cohesion: 0.18
Nodes (11): Conversation Routing, Current Phase: Mock UI, Gradient Border Technique, Current Phase: Mock UI Only (No Backend), Next.js Version Decision (16.2.9), Session 1 Decisions (2026-06-23), State Management (useState, mock phase), What NOT to build yet (+3 more)

### Community 5 - "Community 5"
Cohesion: 0.22
Nodes (10): AGENTS.md: Next.js version warning — read node_modules/next/dist/docs/ before writing code, Chat Window Markdown Rendering, Tech Stack: Next.js 15, TypeScript, Tailwind CSS, Geist Font, Next.js Wordmark SVG: Official Next.js black wordmark logo, Chat Window Page (/agents/[id]/conversations/[convId]), react-markdown + rehype-highlight, recharts, Tailwind CSS v4 (+2 more)

### Community 6 - "Community 6"
Cohesion: 0.28
Nodes (4): getAgent(), getCurrentTask(), handleCreateAgent(), handleMoveTask()

### Community 9 - "Community 9"
Cohesion: 0.4
Nodes (1): timeAgo()

### Community 11 - "Community 11"
Cohesion: 0.5
Nodes (2): buildData(), getLabels()

### Community 12 - "Community 12"
Cohesion: 0.5
Nodes (1): handleSend()

## Knowledge Gaps
- **28 isolated node(s):** `Sidebar Navigation: Forge logo, Dashboard/Agents/Pipelines/Tasks/Chat links, amber active state`, `README: Forge Multi-agent AI Orchestration Dashboard`, `Phase 1 Mock UI Foundation — Completed Features`, `Phase 2 Backend Integration: Supabase, CRUD API, Realtime, RLS`, `Phase 3 Live Agent Execution: Anthropic Claude API, pipeline gates, auth, drag-drop kanban` (+23 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 9`** (5 nodes): `page.tsx`, `page.tsx`, `savePrompt()`, `startEdit()`, `timeAgo()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 11`** (5 nodes): `buildData()`, `getLabels()`, `rand()`, `randCost()`, `analytics-mock-data.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 12`** (4 nodes): `page.tsx`, `page.tsx`, `handleSend()`, `timeStr()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Forge — Multi-agent AI Orchestration Platform` connect `Community 2` to `Community 0`, `Community 1`, `Community 3`, `Community 4`, `Community 5`?**
  _High betweenness centrality (0.124) - this node is a cross-community bridge._
- **Why does `Phase 1 - Mock UI Foundation` connect `Community 0` to `Community 1`, `Community 4`, `Community 5`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `Forge` connect `Community 1` to `Community 0`, `Community 5`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `Forge — Multi-agent AI Orchestration Platform` (e.g. with `File/Document Icon SVG: generic file with text lines, gray (#666)` and `Globe/World Icon SVG: globe with latitude/longitude lines, gray (#666)`) actually correct?**
  _`Forge — Multi-agent AI Orchestration Platform` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Sidebar Navigation: Forge logo, Dashboard/Agents/Pipelines/Tasks/Chat links, amber active state`, `README: Forge Multi-agent AI Orchestration Dashboard`, `Phase 1 Mock UI Foundation — Completed Features` to the rest of the system?**
  _28 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._