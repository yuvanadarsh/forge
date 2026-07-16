"use client";

import type { Agent, BackendAgent } from "@/types";

const STATUS_DOT: Record<Agent["status"], string> = {
  idle: "#71717a",
  working: "#22c55e",
  error: "#ef4444",
};

/** Live activity from the pipeline WebSocket, keyed by agent id.
 *  'executing' = green pulsing (running tools), 'streaming' = blue pulsing
 *  with a typing indicator; absent = fall back to the stored agent status. */
export type AgentActivity = Record<string, "executing" | "streaming">;

interface Props {
  agents: BackendAgent[];
  activity?: AgentActivity;
}

export default function PipelineParticipants({ agents, activity = {} }: Props) {
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
        {agents.map((agent) => {
          const live = activity[agent.id];
          const dotColor =
            live === "streaming" ? "#3b82f6" : live === "executing" ? "#22c55e" : STATUS_DOT[agent.status];
          return (
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
                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 ${live ? "animate-pulse" : ""}`}
                  style={{
                    background: dotColor,
                    borderColor: "#0d0d0d",
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium truncate flex items-center gap-1.5" style={{ color: "#f5f5f5" }}>
                  <span className="truncate">{agent.name}</span>
                  {live === "streaming" && (
                    <span className="shrink-0" style={{ color: "#3b82f6" }} aria-label="typing">
                      <span className="typing-dot">•</span>
                      <span className="typing-dot">•</span>
                      <span className="typing-dot">•</span>
                    </span>
                  )}
                </div>
                <div className="text-[10px] truncate" style={{ color: "#71717a" }}>
                  {agent.role}
                </div>
              </div>
            </div>
          );
        })}
        {agents.length === 0 && (
          <p className="text-xs text-center py-6" style={{ color: "#3f3f46" }}>
            No participants
          </p>
        )}
      </div>
    </div>
  );
}
