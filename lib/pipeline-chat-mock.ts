import type { PipelineChatMsg } from "@/components/PipelineChatMessage";

export function makeMockMessages(
  agentsByRole: Record<string, { name: string; color: string; id?: string }>
): PipelineChatMsg[] {
  const architect = agentsByRole["Architect"] ?? { name: "Architect", color: "#3b82f6", id: "agent-3" };
  const ceo = agentsByRole["CEO"] ?? { name: "CEO", color: "#6366f1", id: "agent-1" };
  const frontendDev = agentsByRole["Frontend Dev"] ?? { name: "Frontend Dev", color: "#22c55e", id: "agent-4" };
  const backendDev = agentsByRole["Backend Dev"] ?? { name: "Backend Dev", color: "#ec4899", id: "agent-5" };

  return [
    {
      id: "pcm-1",
      role: "user",
      content: "Let's kick off the pipeline. @Architect please review the current API structure first and coordinate with the team.",
      created_at: "2026-06-23T09:00:00Z",
    },
    {
      id: "pcm-2",
      role: "assistant",
      agentName: architect.name,
      agentColor: architect.color,
      sender_agent_id: architect.id,
      content:
        "On it. I've analyzed the current structure and found 3 main issues: inconsistent error handling, missing rate limiting, and non-RESTful naming. Here's my proposed API surface:\n\n```\nGET /api/v2/agents\nPOST /api/v2/agents\nPATCH /api/v2/agents/:id\nDELETE /api/v2/agents/:id\n```\n\nI'm sending implementation specs to Pixel and Nexus now.",
      created_at: "2026-06-23T09:02:00Z",
    },
    // Agent-to-agent: Aria (CEO) directing Pixel (Frontend Dev)
    {
      id: "pcm-3",
      role: "assistant",
      agentName: ceo.name,
      agentColor: ceo.color,
      sender_agent_id: ceo.id,
      relay_to_agent_name: frontendDev.name,
      content: "@Pixel, prioritize the dashboard agent grid first — that's the highest-visibility piece for the stakeholder demo. Coordinate with @Architect on the component spec.",
      created_at: "2026-06-23T09:05:00Z",
    },
    // Agent-to-agent: Sage (Architect) sending spec to Nexus (Backend Dev)
    {
      id: "pcm-4",
      role: "assistant",
      agentName: architect.name,
      agentColor: architect.color,
      sender_agent_id: architect.id,
      relay_to_agent_name: backendDev.name,
      content: "@Nexus here's the data schema I finalized — use this as the source of truth for the mock layer:\n\n```typescript\ninterface Agent {\n  id: string;\n  name: string;\n  role: string;\n  status: 'idle' | 'working' | 'error';\n  tokens_used: number;\n  cost_usd: number;\n}\n```\n\nMake sure the mock data covers all status variants.",
      created_at: "2026-06-23T09:08:00Z",
    },
    {
      id: "pcm-5",
      role: "user",
      content: "@Architect what's the estimated completion time for Phase 1?",
      created_at: "2026-06-23T09:10:00Z",
    },
    {
      id: "pcm-6",
      role: "assistant",
      agentName: architect.name,
      agentColor: architect.color,
      sender_agent_id: architect.id,
      content:
        "Phase 1 is complete. Summary:\n- ✓ Component hierarchy defined\n- ✓ TypeScript interfaces finalized\n- ✓ Implementation specs distributed to Pixel and Nexus\n\nReady to proceed to Phase 2 (Implementation) when you approve.",
      created_at: "2026-06-23T09:14:00Z",
    },
    // Approval gate between Phase 1 and Phase 2
    {
      id: "pcm-gate-1",
      role: "assistant",
      content: "",
      created_at: "2026-06-23T09:15:00Z",
      type: "approval_gate",
      approvalSummary: "Phase 1 complete — component hierarchy defined, TypeScript interfaces finalized, and implementation specs distributed to all agents.",
      approvalWhatNext: "Phase 2 (Implementation) — Pixel builds the dashboard UI, Nexus prepares the mock data layer. Estimated 2-3 days.",
    },
    {
      id: "pcm-7",
      role: "user",
      content: "Approved. @Architect coordinate Phase 2 execution.",
      created_at: "2026-06-23T09:20:00Z",
    },
    {
      id: "pcm-8",
      role: "assistant",
      agentName: architect.name,
      agentColor: architect.color,
      sender_agent_id: architect.id,
      content:
        "Phase 2 underway. @Pixel is starting on root layout and sidebar, @Nexus is setting up the mock data layer. I'll check in with status updates every 2 hours.",
      created_at: "2026-06-23T09:22:00Z",
    },
  ];
}
