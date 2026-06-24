"use client";

import { use, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { mockPipelines, mockAgents } from "@/lib/mock-data";
import PipelineChatMessage, { type PipelineChatMsg } from "@/components/PipelineChatMessage";
import PipelineChatInput from "@/components/PipelineChatInput";
import PipelineParticipants from "@/components/PipelineParticipants";
import PipelineExecutionPlan from "@/components/PipelineExecutionPlan";
import { makeMockMessages } from "@/lib/pipeline-chat-mock";

const STATUS_STYLES = {
  pending_approval: { label: "Pending Approval", color: "#f59e0b", bg: "#2a1a00" },
  approved: { label: "Approved", color: "#3b82f6", bg: "#0a1a2a" },
  running: { label: "Running", color: "#22c55e", bg: "#0a1a0a" },
  completed: { label: "Completed", color: "#71717a", bg: "#1a1a1a" },
};

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
