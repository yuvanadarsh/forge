import type { PipelineChatMsg } from "@/components/PipelineChatMessage";

export function makeMockMessages(
  agentsByRole: Record<string, { name: string; color: string }>
): PipelineChatMsg[] {
  const architect = agentsByRole["Architect"] ?? agentsByRole["Sage"] ?? { name: "Architect", color: "#3b82f6" };
  const ceo = agentsByRole["CEO"] ?? agentsByRole["Aria"] ?? { name: "CEO", color: "#6366f1" };
  return [
    {
      id: "pcm-1",
      role: "user",
      content: "Let's kick off the API redesign pipeline. @Architect please review the current structure first.",
      created_at: "2026-06-23T09:00:00Z",
    },
    {
      id: "pcm-2",
      role: "assistant",
      agentName: architect.name,
      agentColor: architect.color,
      content:
        "On it. I've analyzed the current API and found 3 main issues: inconsistent error handling, missing rate limiting, and non-RESTful endpoint naming. Here's my proposed structure:\n\n```\nGET /api/v2/agents\nPOST /api/v2/agents\nPATCH /api/v2/agents/:id\nDELETE /api/v2/agents/:id\n```\n\nShall I proceed with the implementation plan?",
      created_at: "2026-06-23T09:02:00Z",
    },
    {
      id: "pcm-3",
      role: "assistant",
      agentName: ceo.name,
      agentColor: ceo.color,
      content: "Approved. @Architect coordinate with the Backend Dev on implementation timeline.",
      created_at: "2026-06-23T09:05:00Z",
    },
    {
      id: "pcm-4",
      role: "user",
      content: "@Architect what's the estimated completion time?",
      created_at: "2026-06-23T09:08:00Z",
    },
    {
      id: "pcm-5",
      role: "assistant",
      agentName: architect.name,
      agentColor: architect.color,
      content:
        "Given the scope, I estimate 3-4 days for full implementation. Breaking it down:\n- Day 1: Schema design and migration\n- Day 2-3: Endpoint implementation\n- Day 4: Testing and documentation\n\nI'll start immediately.",
      created_at: "2026-06-23T09:10:00Z",
    },
  ];
}
