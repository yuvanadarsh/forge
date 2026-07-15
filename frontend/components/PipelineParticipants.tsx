"use client";

import type { Agent } from "@/types";

const STATUS_DOT: Record<Agent["status"], string> = {
  idle: "#71717a",
  working: "#22c55e",
  error: "#ef4444",
};

interface Props {
  agents: Agent[];
}

export default function PipelineParticipants({ agents }: Props) {
  return (
    <div
      className="w-[240px] shrink-0 border-l flex flex-col"
      style={{ background: "#111111", borderColor: "#1f1f1f" }}
    >
      <div className="px-4 py-4 border-b shrink-0" style={{ borderColor: "#1f1f1f" }}>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#71717a" }}>
          Participants
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
            style={{ background: "#0d0d0d" }}
          >
            <div className="relative shrink-0">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: agent.avatar_color, color: "#fff" }}
              >
                {agent.name[0]}
              </div>
              <span
                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                style={{
                  background: STATUS_DOT[agent.status],
                  borderColor: "#0d0d0d",
                }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium truncate" style={{ color: "#f5f5f5" }}>
                {agent.name}
              </div>
              <div className="text-[10px] truncate" style={{ color: "#71717a" }}>
                {agent.role}
              </div>
            </div>
          </div>
        ))}
        {agents.length === 0 && (
          <p className="text-xs text-center py-6" style={{ color: "#3f3f46" }}>
            No participants
          </p>
        )}
      </div>
    </div>
  );
}
