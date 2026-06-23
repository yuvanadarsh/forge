"use client";

import { useState } from "react";
import Link from "next/link";
import { mockAgents, mockConversations } from "@/lib/mock-data";

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function ChatPage() {
  const [search, setSearch] = useState("");

  const filtered = mockConversations.filter(
    (c) =>
      search === "" ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.last_message?.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = mockAgents
    .map((agent) => ({
      agent,
      convos: filtered.filter((c) => c.agent_id === agent.id),
    }))
    .filter((g) => g.convos.length > 0);

  return (
    <div className="px-8 py-8 max-w-[800px] mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "#f5f5f5" }}>Chat</h1>
        <p className="text-sm mt-1" style={{ color: "#71717a" }}>
          {mockConversations.length} conversations across {mockAgents.length} agents
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search conversations..."
          className="w-full px-4 py-3 rounded-xl text-sm outline-none border transition-colors duration-150"
          style={{ background: "#111111", borderColor: "#1f1f1f", color: "#f5f5f5" }}
          onFocus={(e) => (e.target.style.borderColor = "#f59e0b")}
          onBlur={(e) => (e.target.style.borderColor = "#1f1f1f")}
        />
      </div>

      {grouped.length === 0 && (
        <div className="text-sm text-center py-16" style={{ color: "#71717a" }}>
          No conversations match your search.
        </div>
      )}

      <div className="space-y-8">
        {grouped.map(({ agent, convos }) => {
          const RING_COLORS: Record<string, [string, string]> = {
            "#6366f1": ["#6366f1", "#8b5cf6"],
            "#f59e0b": ["#f59e0b", "#ef4444"],
            "#3b82f6": ["#3b82f6", "#06b6d4"],
            "#22c55e": ["#22c55e", "#10b981"],
            "#ec4899": ["#ec4899", "#f43f5e"],
            "#f97316": ["#f97316", "#eab308"],
          };
          const pair = RING_COLORS[agent.avatar_color] ?? [agent.avatar_color, agent.avatar_color];

          return (
            <div key={agent.id}>
              <Link
                href={`/agents/${agent.id}`}
                className="flex items-center gap-3 mb-3 group"
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs"
                  style={{ background: `linear-gradient(to right, ${pair[0]}, ${pair[1]})`, color: "#fff" }}
                >
                  {agent.name[0]}
                </div>
                <span className="text-sm font-semibold group-hover:text-[#f59e0b] transition-colors duration-150" style={{ color: "#f5f5f5" }}>
                  {agent.name}
                </span>
                <span className="text-xs" style={{ color: "#71717a" }}>{agent.role}</span>
              </Link>

              <div className="flex flex-col gap-2 ml-10">
                {convos.map((conv) => (
                  <Link
                    key={conv.id}
                    href={`/agents/${agent.id}/conversations/${conv.id}`}
                    className="flex items-start justify-between gap-4 p-4 rounded-xl border transition-all duration-150 hover:border-[#2a2a2a]"
                    style={{ background: "#111111", borderColor: "#1f1f1f" }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium mb-1" style={{ color: "#f5f5f5" }}>
                        {conv.title}
                      </div>
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
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
