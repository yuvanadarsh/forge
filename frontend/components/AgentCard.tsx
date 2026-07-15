"use client";

import Link from "next/link";
import type { Agent, BackendAgent, BackendTask } from "@/types";

const RING_COLORS: Record<string, [string, string]> = {
  "#6366f1": ["#6366f1", "#8b5cf6"],
  "#f59e0b": ["#f59e0b", "#ef4444"],
  "#3b82f6": ["#3b82f6", "#06b6d4"],
  "#22c55e": ["#22c55e", "#10b981"],
  "#ec4899": ["#ec4899", "#f43f5e"],
  "#f97316": ["#f97316", "#eab308"],
};

function getGradient(color: string) {
  const pair = RING_COLORS[color] ?? [color, color];
  return `linear-gradient(to right, ${pair[0]}, ${pair[1]})`;
}

function StatusDot({ status }: { status: Agent["status"] }) {
  const colors = { idle: "#71717a", working: "#22c55e", error: "#ef4444" };
  const labels = { idle: "Idle", working: "Working", error: "Error" };
  return (
    <span className="flex items-center gap-1.5 text-xs" style={{ color: colors[status] }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: colors[status] }} />
      {labels[status]}
    </span>
  );
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface Props {
  // Backend shapes; the stricter mock-phase Agent/Task remain assignable.
  agent: BackendAgent;
  currentTask?: BackendTask;
}

export default function AgentCard({ agent, currentTask }: Props) {
  return (
    <Link href={`/agents/${agent.id}`} className="block group h-full">
      <div
        className="rounded-xl overflow-hidden transition-transform duration-150 group-hover:scale-[1.01] h-full"
        style={{ padding: "1px", background: getGradient(agent.avatar_color) }}
      >
        <div className="rounded-xl p-4 h-full flex flex-col gap-3" style={{ background: "#111111" }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="font-semibold text-sm" style={{ color: "#f5f5f5" }}>{agent.name}</div>
              <div className="text-xs mt-0.5" style={{ color: "#71717a" }}>{agent.role}</div>
            </div>
            <StatusDot status={agent.status} />
          </div>

          <div className="text-xs leading-relaxed line-clamp-2" style={{ color: "#71717a" }}>
            {agent.specialty}
          </div>

          <div className="flex items-center gap-4 text-xs" style={{ color: "#71717a" }}>
            <span>{formatTokens(agent.tokens_used)} tokens</span>
            <span>${agent.cost_usd.toFixed(2)}</span>
          </div>

          {currentTask && (
            <div className="text-xs px-2 py-1.5 rounded-lg truncate" style={{ background: "#1a1a1a", color: "#a1a1aa" }}>
              {currentTask.title}
            </div>
          )}

          <div className="text-xs mt-auto" style={{ color: "#3f3f46" }}>
            {agent.last_active ? `Active ${timeAgo(agent.last_active)}` : "Not active yet"}
          </div>
        </div>
      </div>
    </Link>
  );
}
