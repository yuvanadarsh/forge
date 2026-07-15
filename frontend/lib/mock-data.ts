import type { Agent, Task, Pipeline, Conversation, Message } from "@/types";

export const mockAgents: Agent[] = [
  {
    id: "agent-1",
    name: "Aria",
    role: "CEO",
    specialty: "Strategic planning and stakeholder alignment",
    avatar_color: "#6366f1",
    model: "claude-opus-4-8",
    system_prompt:
      "You are Aria, the CEO agent. You oversee all operations, set strategic direction, and ensure agents are aligned toward business goals. You speak clearly and decisively.",
    status: "working",
    last_active: "2026-06-23T14:30:00Z",
    tokens_used: 142500,
    cost_usd: 4.28,
    created_at: "2026-06-01T09:00:00Z",
  },
  {
    id: "agent-2",
    name: "Victor",
    role: "CTO",
    specialty: "Technical architecture and engineering leadership",
    avatar_color: "#f59e0b",
    model: "claude-sonnet-4-6",
    system_prompt:
      "You are Victor, the CTO agent. You define technical strategy, review architectural decisions, and ensure engineering excellence across all pipelines.",
    status: "idle",
    last_active: "2026-06-23T13:15:00Z",
    tokens_used: 98200,
    cost_usd: 1.96,
    created_at: "2026-06-01T09:05:00Z",
  },
  {
    id: "agent-3",
    name: "Sage",
    role: "Architect",
    specialty: "System design and infrastructure planning",
    avatar_color: "#3b82f6",
    model: "claude-sonnet-4-6",
    system_prompt:
      "You are Sage, the Architect agent. You design scalable systems, define data models, and produce technical specifications for the team to implement.",
    status: "working",
    last_active: "2026-06-23T14:45:00Z",
    tokens_used: 205800,
    cost_usd: 4.12,
    created_at: "2026-06-01T09:10:00Z",
  },
  {
    id: "agent-4",
    name: "Pixel",
    role: "Frontend Dev",
    specialty: "React, Next.js, and UI/UX implementation",
    avatar_color: "#22c55e",
    model: "claude-sonnet-4-6",
    system_prompt:
      "You are Pixel, the Frontend Developer agent. You build beautiful, accessible, and performant user interfaces using modern React patterns and Tailwind CSS.",
    status: "working",
    last_active: "2026-06-23T14:50:00Z",
    tokens_used: 312000,
    cost_usd: 6.24,
    created_at: "2026-06-01T09:15:00Z",
  },
  {
    id: "agent-5",
    name: "Nexus",
    role: "Backend Dev",
    specialty: "APIs, databases, and server-side logic",
    avatar_color: "#ec4899",
    model: "claude-sonnet-4-6",
    system_prompt:
      "You are Nexus, the Backend Developer agent. You build robust APIs, manage databases, and implement business logic with a focus on security and performance.",
    status: "idle",
    last_active: "2026-06-23T12:00:00Z",
    tokens_used: 187400,
    cost_usd: 3.75,
    created_at: "2026-06-01T09:20:00Z",
  },
  {
    id: "agent-6",
    name: "Vera",
    role: "Tester",
    specialty: "QA, test automation, and edge case discovery",
    avatar_color: "#f97316",
    model: "claude-haiku-4-5",
    system_prompt:
      "You are Vera, the Tester agent. You write comprehensive test suites, identify edge cases, and ensure code quality before any feature ships to production.",
    status: "idle",
    last_active: "2026-06-23T11:30:00Z",
    tokens_used: 64300,
    cost_usd: 0.26,
    created_at: "2026-06-01T09:25:00Z",
  },
  {
    id: "agent-7",
    name: "Patch",
    role: "Bug Patcher",
    specialty: "Debugging, hotfixes, and root cause analysis",
    avatar_color: "#6366f1",
    model: "claude-sonnet-4-6",
    system_prompt:
      "You are Patch, the Bug Patcher agent. You investigate failures, find root causes, and ship minimal targeted fixes without introducing regressions.",
    status: "error",
    last_active: "2026-06-23T10:00:00Z",
    tokens_used: 43100,
    cost_usd: 0.86,
    created_at: "2026-06-01T09:30:00Z",
  },
  {
    id: "agent-8",
    name: "Orion",
    role: "Project Manager",
    specialty: "Task coordination, timelines, and delivery tracking",
    avatar_color: "#3b82f6",
    model: "claude-haiku-4-5",
    system_prompt:
      "You are Orion, the Project Manager agent. You coordinate tasks, track progress, manage dependencies, and ensure the team delivers on time.",
    status: "idle",
    last_active: "2026-06-23T13:45:00Z",
    tokens_used: 29800,
    cost_usd: 0.12,
    created_at: "2026-06-01T09:35:00Z",
  },
];

export const mockTasks: Task[] = [
  {
    id: "task-1",
    title: "Design agent communication protocol",
    description:
      "Define the JSON schema for inter-agent messages, including task delegation, status updates, and approval requests.",
    assigned_to: "agent-3",
    priority: "urgent",
    status: "in_progress",
    pipeline_id: "pipeline-1",
    created_from_chat: false,
    created_at: "2026-06-20T09:00:00Z",
  },
  {
    id: "task-2",
    title: "Build dashboard agent grid",
    description:
      "Implement the agent card grid on the dashboard page with status indicators, token counts, and cost display.",
    assigned_to: "agent-4",
    priority: "high",
    status: "in_progress",
    pipeline_id: "pipeline-1",
    created_from_chat: false,
    created_at: "2026-06-20T10:00:00Z",
  },
  {
    id: "task-3",
    title: "Implement kanban board",
    description:
      "Create the operations kanban board with Backlog, In Progress, Review, and Completed columns.",
    assigned_to: "agent-4",
    priority: "high",
    status: "review",
    pipeline_id: "pipeline-1",
    created_from_chat: false,
    created_at: "2026-06-20T11:00:00Z",
  },
  {
    id: "task-4",
    title: "Set up Supabase schema",
    description:
      "Create tables for agents, tasks, pipelines, conversations, and messages in Supabase with proper RLS policies.",
    assigned_to: "agent-5",
    priority: "urgent",
    status: "backlog",
    pipeline_id: null,
    created_from_chat: false,
    created_at: "2026-06-21T09:00:00Z",
  },
  {
    id: "task-5",
    title: "Write E2E test suite",
    description:
      "Set up Playwright and write end-to-end tests covering dashboard navigation, modal flows, and agent creation.",
    assigned_to: "agent-6",
    priority: "med",
    status: "backlog",
    pipeline_id: null,
    created_from_chat: false,
    created_at: "2026-06-21T10:00:00Z",
  },
  {
    id: "task-6",
    title: "Fix agent status sync bug",
    description:
      "Agent status shows 'idle' after task completion but should transition to 'working' on the next task pick-up.",
    assigned_to: "agent-7",
    priority: "urgent",
    status: "in_progress",
    pipeline_id: null,
    created_from_chat: true,
    created_at: "2026-06-22T08:00:00Z",
  },
  {
    id: "task-7",
    title: "Design system documentation",
    description:
      "Document all color tokens, typography scales, component patterns, and spacing conventions for the design system.",
    assigned_to: "agent-1",
    priority: "low",
    status: "completed",
    pipeline_id: null,
    created_from_chat: false,
    created_at: "2026-06-18T09:00:00Z",
  },
  {
    id: "task-8",
    title: "Define Q3 roadmap",
    description:
      "Outline feature priorities for Q3: real LLM integration, authentication, drag-and-drop kanban, and real-time updates.",
    assigned_to: "agent-1",
    priority: "high",
    status: "completed",
    pipeline_id: null,
    created_from_chat: false,
    created_at: "2026-06-15T09:00:00Z",
  },
  {
    id: "task-9",
    title: "API rate limiting strategy",
    description:
      "Design and implement rate limiting for the agent orchestration API to prevent runaway LLM costs.",
    assigned_to: "agent-2",
    priority: "high",
    status: "review",
    pipeline_id: "pipeline-2",
    created_from_chat: false,
    created_at: "2026-06-22T14:00:00Z",
  },
  {
    id: "task-10",
    title: "Create pipeline approval UI",
    description:
      "Build the approval gate UI where a human can review a pipeline plan before agents begin execution.",
    assigned_to: "agent-4",
    priority: "med",
    status: "backlog",
    pipeline_id: "pipeline-2",
    created_from_chat: false,
    created_at: "2026-06-23T09:00:00Z",
  },
];

export const mockPipelines: Pipeline[] = [
  {
    id: "pipeline-1",
    title: "Mock UI Foundation Build",
    description:
      "End-to-end pipeline to design, implement, and test the Forge mock UI foundation.",
    status: "running",
    agents: ["agent-1", "agent-3", "agent-4", "agent-5", "agent-6"],
    created_by: "agent-1",
    plan_md: `# Pipeline: Mock UI Foundation Build

## Objective
Build a fully interactive mock UI for the Forge platform with no backend dependencies.

## Phase 1: Design & Architecture
- [ ] **Sage (Architect)** — Define component hierarchy and data flow
- [ ] **Sage (Architect)** — Finalize TypeScript interfaces for all entities
- [ ] **Aria (CEO)** — Approve design direction and scope

## Phase 2: Implementation
- [ ] **Pixel (Frontend Dev)** — Implement root layout and sidebar navigation
- [ ] **Pixel (Frontend Dev)** — Build dashboard with agent grid and kanban board
- [ ] **Pixel (Frontend Dev)** — Build agent registry and per-agent pages
- [ ] **Pixel (Frontend Dev)** — Build chat and pipelines pages
- [ ] **Nexus (Backend Dev)** — Prepare mock data layer and state management

## Phase 3: Quality Assurance
- [ ] **Vera (Tester)** — Manual QA pass on all pages and modals
- [ ] **Vera (Tester)** — Verify navigation and modal flows
- [ ] **Vera (Tester)** — Check responsive behavior at 1280px+

## Approval Gate
Human approval required before Phase 3 begins.

## Success Criteria
- All pages render without errors
- All navigation links work correctly
- All modals open and close with fade transitions
- Mock data populates all views correctly
`,
    approved_at: "2026-06-20T10:00:00Z",
  },
  {
    id: "pipeline-2",
    title: "Backend API Integration",
    description:
      "Design and implement the Supabase-backed API layer for agents, tasks, and real-time updates.",
    status: "pending_approval",
    agents: ["agent-2", "agent-3", "agent-5", "agent-6"],
    created_by: "agent-2",
    plan_md: `# Pipeline: Backend API Integration

## Objective
Replace mock data with a live Supabase backend and add real-time updates via Supabase Realtime.

## Phase 1: Schema Design
- [ ] **Sage (Architect)** — Design normalized Postgres schema
- [ ] **Victor (CTO)** — Review and approve schema
- [ ] **Nexus (Backend Dev)** — Implement Supabase migrations

## Phase 2: API Layer
- [ ] **Nexus (Backend Dev)** — Implement CRUD endpoints for agents
- [ ] **Nexus (Backend Dev)** — Implement CRUD endpoints for tasks and pipelines
- [ ] **Nexus (Backend Dev)** — Add Supabase Realtime subscriptions
- [ ] **Nexus (Backend Dev)** — Implement Row Level Security policies

## Phase 3: Frontend Integration
- [ ] **Pixel (Frontend Dev)** — Replace mock data with API calls
- [ ] **Pixel (Frontend Dev)** — Add loading and error states
- [ ] **Pixel (Frontend Dev)** — Wire up real-time updates

## Phase 4: Testing
- [ ] **Vera (Tester)** — Integration test suite
- [ ] **Vera (Tester)** — Load testing for concurrent agents

## Approval Gate
**AWAITING HUMAN APPROVAL** — This pipeline will incur Supabase costs and make live database changes.

## Success Criteria
- All CRUD operations work correctly
- Real-time updates reflect within 500ms
- RLS prevents cross-user data access
`,
    approved_at: null,
  },
];

export const mockConversations: Conversation[] = [
  {
    id: "conv-1",
    agent_id: "agent-3",
    task_id: "task-1",
    pipeline_id: "pipeline-1",
    title: "Agent communication protocol design",
    last_message:
      "I'll go with a discriminated union on the 'type' field — much safer than a generic object.",
    last_active: "2026-06-23T14:30:00Z",
    created_at: "2026-06-20T09:00:00Z",
  },
  {
    id: "conv-2",
    agent_id: "agent-4",
    task_id: "task-2",
    pipeline_id: "pipeline-1",
    title: "Dashboard agent grid implementation",
    last_message:
      "The gradient border trick with a wrapper div works perfectly — no extra libraries needed.",
    last_active: "2026-06-23T14:50:00Z",
    created_at: "2026-06-20T10:00:00Z",
  },
  {
    id: "conv-3",
    agent_id: "agent-7",
    task_id: "task-6",
    pipeline_id: null,
    title: "Agent status sync bug investigation",
    last_message:
      "Found it — the status update was firing before the task assignment completed. Race condition.",
    last_active: "2026-06-23T10:00:00Z",
    created_at: "2026-06-22T08:00:00Z",
  },
];

export const mockMessages: Message[] = [
  // Conversation 1 — Sage designing agent protocol
  {
    id: "msg-1",
    conversation_id: "conv-1",
    agent_id: "agent-3",
    role: "user",
    content:
      "Sage, I need you to define the JSON schema for inter-agent messages. We need to handle task delegation, status updates, and human approval requests.",
    created_at: "2026-06-20T09:00:00Z",
  },
  {
    id: "msg-2",
    conversation_id: "conv-1",
    agent_id: "agent-3",
    role: "assistant",
    content:
      "Understood. I'll design a discriminated union schema with a `type` field as the discriminant. This gives us full type safety in TypeScript and makes it easy to add new message types without breaking existing handlers.\n\nHere's the base structure I'm thinking:\n\n```typescript\ntype AgentMessage =\n  | { type: 'task_delegation'; task_id: string; from_agent: string; to_agent: string; priority: Priority }\n  | { type: 'status_update'; agent_id: string; status: AgentStatus; task_id?: string }\n  | { type: 'approval_request'; pipeline_id: string; plan_md: string; requested_by: string };\n```\n\nShall I proceed with this approach?",
    created_at: "2026-06-20T09:02:00Z",
  },
  {
    id: "msg-3",
    conversation_id: "conv-1",
    agent_id: "agent-3",
    role: "user",
    content:
      "Yes, proceed. Also add a `result_report` type for when an agent completes a task and needs to send results back to the orchestrator.",
    created_at: "2026-06-20T09:05:00Z",
  },
  {
    id: "msg-4",
    conversation_id: "conv-1",
    agent_id: "agent-3",
    role: "assistant",
    content:
      "Added. The `result_report` type will include:\n- `task_id` — which task was completed\n- `output` — freeform string or structured JSON output\n- `tokens_used` — for cost tracking\n- `duration_ms` — for performance monitoring\n- `next_suggested_task` — optional, for autonomous chaining\n\nI'm also adding a `metadata` field on the base type for tracing and correlation IDs. This keeps the message envelope clean while allowing debug context to flow through.",
    created_at: "2026-06-20T09:08:00Z",
  },
  {
    id: "msg-5",
    conversation_id: "conv-1",
    agent_id: "agent-3",
    role: "user",
    content:
      "Smart. What format should `output` take? Some tasks produce code, others produce analysis text, others produce structured data.",
    created_at: "2026-06-20T09:12:00Z",
  },
  {
    id: "msg-6",
    conversation_id: "conv-1",
    agent_id: "agent-3",
    role: "assistant",
    content:
      "I'll go with a discriminated union on the 'type' field — much safer than a generic object. The output will be:\n\n```typescript\ntype TaskOutput =\n  | { kind: 'text'; content: string }\n  | { kind: 'code'; language: string; content: string }\n  | { kind: 'json'; data: Record<string, unknown> }\n  | { kind: 'file_reference'; path: string; mime_type: string };\n```\n\nThis lets consumers safely narrow without runtime type checks and keeps the schema self-documenting. Schema spec is ready for Victor's review.",
    created_at: "2026-06-20T09:16:00Z",
  },

  // Conversation 2 — Pixel building the dashboard
  {
    id: "msg-7",
    conversation_id: "conv-2",
    agent_id: "agent-4",
    role: "user",
    content:
      "Pixel, build the agent card grid for the dashboard. Each card needs a colored top border, status dot, name, role, token count, and cost. Use the design system colors.",
    created_at: "2026-06-20T10:00:00Z",
  },
  {
    id: "msg-8",
    conversation_id: "conv-2",
    agent_id: "agent-4",
    role: "assistant",
    content:
      "On it. I'll use a gradient border trick — wrap the card in a `div` with `p-[1px]` and a `bg-gradient-to-r` background, then put the card content inside with `bg-[#111111]`. This avoids the `border-image` CSS property which doesn't support border-radius.\n\nCard layout plan:\n- Gradient top strip (4px, via padding trick)\n- Agent name + role\n- Status dot (green/amber/red) with label\n- Token count and cost in a two-column stat row\n- Last active timestamp\n- Current task title (truncated)",
    created_at: "2026-06-20T10:03:00Z",
  },
  {
    id: "msg-9",
    conversation_id: "conv-2",
    agent_id: "agent-4",
    role: "user",
    content: "Good approach. Should the cards be clickable to navigate to /agents/[id]?",
    created_at: "2026-06-20T10:06:00Z",
  },
  {
    id: "msg-10",
    conversation_id: "conv-2",
    agent_id: "agent-4",
    role: "assistant",
    content:
      "Yes — I'll wrap the entire card in a Next.js `<Link>` pointing to `/agents/${agent.id}`. The cursor will become a pointer on hover, and I'll add a subtle `scale-[1.01]` transform on hover for tactile feedback. The gradient border will also brighten slightly using `opacity` adjustment on hover.",
    created_at: "2026-06-20T10:08:00Z",
  },
  {
    id: "msg-11",
    conversation_id: "conv-2",
    agent_id: "agent-4",
    role: "user",
    content:
      "Perfect. Also wire up a 'Create Task' button in the kanban board that opens the CreateTaskModal.",
    created_at: "2026-06-20T10:12:00Z",
  },
  {
    id: "msg-12",
    conversation_id: "conv-2",
    agent_id: "agent-4",
    role: "assistant",
    content:
      "The gradient border trick with a wrapper div works perfectly — no extra libraries needed. I've also wired the 'Create Task' button in the Backlog column header to open the modal. Each column now has a '+' button in the header for quick task creation with the status pre-filled. The modal receives an `initialStatus` prop to handle this.",
    created_at: "2026-06-23T14:50:00Z",
  },

  // Conversation 3 — Patch debugging status sync
  {
    id: "msg-13",
    conversation_id: "conv-3",
    agent_id: "agent-7",
    role: "user",
    content:
      "Patch, we have a bug: agent status shows 'idle' after task completion but should pick up 'working' on the next task. Investigate.",
    created_at: "2026-06-22T08:00:00Z",
  },
  {
    id: "msg-14",
    conversation_id: "conv-3",
    agent_id: "agent-7",
    role: "assistant",
    content:
      "Starting investigation. First, I'll check the status update flow. The sequence should be:\n1. Task marked `completed`\n2. Agent status set to `idle`\n3. Orchestrator picks next task from backlog\n4. Task assigned to agent\n5. Agent status set to `working`\n\nI'll trace steps 2-4 to find where the handoff breaks.",
    created_at: "2026-06-22T08:05:00Z",
  },
  {
    id: "msg-15",
    conversation_id: "conv-3",
    agent_id: "agent-7",
    role: "user",
    content:
      "The status seems to stick on 'idle' even when we can see the task is assigned in the database.",
    created_at: "2026-06-22T08:10:00Z",
  },
  {
    id: "msg-16",
    conversation_id: "conv-3",
    agent_id: "agent-7",
    role: "assistant",
    content:
      "That's a classic race condition signature. The task assignment and status update are separate operations — if the status update fires optimistically before the task assignment propagates through the Realtime subscription, the UI shows `idle` even though the DB has `working`.\n\nLet me check if we're awaiting the Realtime confirmation before updating local state...",
    created_at: "2026-06-22T08:15:00Z",
  },
  {
    id: "msg-17",
    conversation_id: "conv-3",
    agent_id: "agent-7",
    role: "user",
    content: "What's the fix?",
    created_at: "2026-06-22T09:00:00Z",
  },
  {
    id: "msg-18",
    conversation_id: "conv-3",
    agent_id: "agent-7",
    role: "assistant",
    content:
      "Found it — the status update was firing before the task assignment completed. Race condition.\n\nFix: derive agent status from task state rather than storing it separately. An agent is `working` if it has any task with `status = 'in_progress'`. This way status is always consistent with task state — no sync required. I'll implement this as a computed field on the agent query.",
    created_at: "2026-06-23T10:00:00Z",
  },
];
