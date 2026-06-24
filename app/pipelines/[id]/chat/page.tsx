"use client";

import { use, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { mockPipelines, mockAgents } from "@/lib/mock-data";
import PipelineChatMessage, { type PipelineChatMsg } from "@/components/PipelineChatMessage";
import PipelineChatInput from "@/components/PipelineChatInput";
import PipelineParticipants from "@/components/PipelineParticipants";
import PipelineExecutionPlan from "@/components/PipelineExecutionPlan";

const STATUS_STYLES = {
  pending_approval: { label: "Pending Approval", color: "#f59e0b", bg: "#2a1a00" },
  approved: { label: "Approved", color: "#3b82f6", bg: "#0a1a2a" },
  running: { label: "Running", color: "#22c55e", bg: "#0a1a0a" },
  completed: { label: "Completed", color: "#71717a", bg: "#1a1a1a" },
};

function makeMockMessages(agentsByName: Record<string, { name: string; color: string }>): PipelineChatMsg[] {
  const architect = agentsByName["Architect"] ?? agentsByName["Sage"] ?? { name: "Architect", color: "#3b82f6" };
  const ceo = agentsByName["CEO"] ?? agentsByName["Aria"] ?? { name: "CEO", color: "#6366f1" };
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

export default function PipelineChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const pipeline = mockPipelines.find((p) => p.id === id);
  if (!pipeline) notFound();

  const participants = pipeline.agents
    .map((aid) => mockAgents.find((a) => a.id === aid))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  const agentsByRole = Object.fromEntries(
    participants.map((a) => [a.role, { name: a.name, color: a.avatar_color }])
  );

  const [messages, setMessages] = useState<PipelineChatMsg[]>(() => makeMockMessages(agentsByRole));
  const [input, setInput] = useState("");
  const [planCollapsed, setPlanCollapsed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    const newMsg: PipelineChatMsg = {
      id: `pcm-tmp-${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newMsg]);
    setInput("");
  }

  const s = STATUS_STYLES[pipeline.status];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left panel — execution plan */}
      <PipelineExecutionPlan
        planMd={pipeline.plan_md}
        collapsed={planCollapsed}
        onToggle={() => setPlanCollapsed((v) => !v)}
      />

      {/* Center — chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b shrink-0" style={{ borderColor: "#1f1f1f" }}>
          <Link
            href="/pipelines"
            className="text-xs transition-colors duration-150 shrink-0"
            style={{ color: "#71717a" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#f5f5f5")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#71717a")}
          >
            ← Back to Pipelines
          </Link>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="text-sm font-semibold truncate" style={{ color: "#f5f5f5" }}>
              {pipeline.title}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
              style={{ color: s.color, background: s.bg }}
            >
              {s.label}
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {messages.map((msg) => (
            <PipelineChatMessage key={msg.id} msg={msg} />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <PipelineChatInput value={input} onChange={setInput} onSend={handleSend} />
      </div>

      {/* Right panel — participants */}
      <PipelineParticipants agents={participants} />
    </div>
  );
}
