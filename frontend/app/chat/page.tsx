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

const RING_COLORS: Record<string, [string, string]> = {
  "#6366f1": ["#6366f1", "#8b5cf6"],
  "#f59e0b": ["#f59e0b", "#ef4444"],
  "#3b82f6": ["#3b82f6", "#06b6d4"],
  "#22c55e": ["#22c55e", "#10b981"],
  "#ec4899": ["#ec4899", "#f43f5e"],
  "#f97316": ["#f97316", "#eab308"],
};

export default function ChatPage() {
  const [search, setSearch] = useState("");

  const filtered = mockConversations.filter(
    (c) =>
      search === "" ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.last_message?.toLowerCase().includes(search.toLowerCase())
  );

  const rows = mockAgents.flatMap((agent) => {
    const pair = RING_COLORS[agent.avatar_color] ?? [agent.avatar_color, agent.avatar_color];
    return filtered
      .filter((c) => c.agent_id === agent.id)
      .map((conv) => ({ agent, conv, pair }));
  });

  return (
    <div className="px-8 py-8 max-w-[860px] mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "#f5f5f5" }}>Chat</h1>
        <p className="text-sm mt-1" style={{ color: "#71717a" }}>
          {mockConversations.length} conversations across {mockAgents.length} agents
        </p>
      </div>

      {/* Search */}
      <div className="mb-5">
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

      {rows.length === 0 && (
        <div className="text-sm text-center py-16" style={{ color: "#71717a" }}>
          No conversations match your search.
        </div>
      )}

      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: "#1f1f1f" }}
      >
        {rows.map(({ agent, conv, pair }, i) => (
          <Link
            key={conv.id}
            href={`/agents/${agent.id}/conversations/${conv.id}`}
            className="flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-[#161616]"
            style={{
              borderLeft: `3px solid ${pair[0]}`,
              borderBottom: i < rows.length - 1 ? "1px solid #1a1a1a" : "none",
              background: "#111111",
            }}
          >
            {/* Avatar */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: `linear-gradient(to right, ${pair[0]}, ${pair[1]})`, color: "#fff" }}
            >
              {agent.name[0]}
            </div>

            {/* Agent name · role */}
            <div className="shrink-0 flex items-center gap-1 min-w-[160px]">
              <span className="text-xs font-semibold truncate" style={{ color: "#f5f5f5" }}>
                {agent.name}
              </span>
              <span className="text-xs" style={{ color: "#3f3f46" }}>·</span>
              <span className="text-xs truncate" style={{ color: "#71717a" }}>
                {agent.role}
              </span>
            </div>

            {/* Separator */}
            <span className="text-xs shrink-0" style={{ color: "#2a2a2a" }}>—</span>

            {/* Conversation title */}
            <span className="text-xs font-medium shrink-0 truncate max-w-[160px]" style={{ color: "#a1a1aa" }}>
              {conv.title}
            </span>

            {/* Separator */}
            <span className="text-xs shrink-0" style={{ color: "#2a2a2a" }}>—</span>

            {/* Last message preview */}
            <span className="text-xs truncate flex-1 min-w-0" style={{ color: "#71717a" }}>
              {conv.last_message ?? "No messages yet"}
            </span>

            {/* Timestamp */}
            <span className="text-xs shrink-0 ml-auto" style={{ color: "#3f3f46" }}>
              {timeAgo(conv.last_active)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
