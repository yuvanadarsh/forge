"use client";

import { use } from "react";
import Link from "next/link";
import { mockAgents, mockConversations, mockTasks } from "@/lib/mock-data";
import { notFound } from "next/navigation";

function timeAgo(iso: string | null) {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const agent = mockAgents.find((a) => a.id === id);
  if (!agent) notFound();

  const conversations = mockConversations.filter((c) => c.agent_id === id);
  const taskConvos = conversations.filter((c) => c.task_id !== null);

  const statusColor = { idle: "#71717a", working: "#22c55e", error: "#ef4444" }[agent.status];
  const statusLabel = { idle: "Idle", working: "Working", error: "Error" }[agent.status];

  const RING_COLORS: Record<string, [string, string]> = {
    "#6366f1": ["#6366f1", "#8b5cf6"],
    "#f59e0b": ["#f59e0b", "#ef4444"],
    "#3b82f6": ["#3b82f6", "#06b6d4"],
    "#22c55e": ["#22c55e", "#10b981"],
    "#ec4899": ["#ec4899", "#f43f5e"],
    "#f97316": ["#f97316", "#eab308"],
  };
  const pair = RING_COLORS[agent.avatar_color] ?? [agent.avatar_color, agent.avatar_color];
  const gradient = `linear-gradient(to right, ${pair[0]}, ${pair[1]})`;

  return (
    <div className="px-8 py-8 max-w-[900px] mx-auto">
      {/* Back */}
      <Link href="/agents" className="text-xs flex items-center gap-1 mb-6 transition-colors duration-150" style={{ color: "#71717a" }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#f5f5f5")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#71717a")}
      >
        ← Back to Agents
      </Link>

      {/* Agent header */}
      <div className="rounded-xl overflow-hidden mb-8" style={{ padding: "1px", background: gradient }}>
        <div className="rounded-xl p-6 flex items-start gap-5" style={{ background: "#111111" }}>
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold shrink-0"
            style={{ background: agent.avatar_color, color: "#fff" }}
          >
            {agent.name[0]}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold" style={{ color: "#f5f5f5" }}>{agent.name}</h1>
              <span
                className="text-xs px-2 py-1 rounded-full font-medium border"
                style={{ color: statusColor, borderColor: statusColor, background: `${statusColor}15` }}
              >
                {statusLabel}
              </span>
            </div>
            <p className="text-sm mt-0.5" style={{ color: "#71717a" }}>{agent.role} · {agent.specialty}</p>
            <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: "#71717a" }}>
              <span className="px-2 py-1 rounded-lg" style={{ background: "#1a1a1a" }}>{agent.model}</span>
              <span>{(agent.tokens_used / 1000).toFixed(0)}k tokens</span>
              <span>${agent.cost_usd.toFixed(2)} spent</span>
            </div>
          </div>
        </div>
      </div>

      {/* Task Conversations */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#71717a" }}>
            Task Conversations
          </h2>
          <Link
            href={`/agents/${id}/conversations/new`}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors duration-150"
            style={{ background: "#1f1f1f", color: "#f59e0b" }}
          >
            + General Chat
          </Link>
        </div>

        {taskConvos.length === 0 && (
          <p className="text-sm" style={{ color: "#71717a" }}>No task conversations yet.</p>
        )}

        <div className="flex flex-col gap-2">
          {taskConvos.map((conv) => {
            const task = mockTasks.find((t) => t.id === conv.task_id);
            return (
              <Link
                key={conv.id}
                href={`/agents/${id}/conversations/${conv.id}`}
                className="flex items-start justify-between gap-4 p-4 rounded-xl border transition-colors duration-150"
                style={{ background: "#111111", borderColor: "#1f1f1f" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium mb-1" style={{ color: "#f5f5f5" }}>
                    {conv.title}
                  </div>
                  {task && (
                    <div className="text-xs mb-1" style={{ color: "#f59e0b" }}>
                      Task: {task.title}
                    </div>
                  )}
                  {conv.last_message && (
                    <div className="text-xs truncate" style={{ color: "#71717a" }}>
                      {conv.last_message}
                    </div>
                  )}
                </div>
                <div className="text-xs shrink-0 mt-0.5" style={{ color: "#3f3f46" }}>
                  {timeAgo(conv.last_active)}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* System Prompt */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: "#71717a" }}>
          System Prompt
        </h2>
        <div className="p-4 rounded-xl border text-sm leading-relaxed" style={{ background: "#111111", borderColor: "#1f1f1f", color: "#a1a1aa" }}>
          {agent.system_prompt}
        </div>
      </section>
    </div>
  );
}
