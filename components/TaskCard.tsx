"use client";

import type { Task, Agent } from "@/types";

const PRIORITY_STYLES: Record<Task["priority"], { label: string; color: string; bg: string }> = {
  low: { label: "Low", color: "#71717a", bg: "#1a1a1a" },
  med: { label: "Med", color: "#3b82f6", bg: "#1a2a3a" },
  high: { label: "High", color: "#f59e0b", bg: "#2a1a00" },
  urgent: { label: "Urgent", color: "#ef4444", bg: "#2a1010" },
};

interface Props {
  task: Task;
  agent?: Agent;
  onRun: () => void;
}

export default function TaskCard({ task, agent, onRun }: Props) {
  const p = PRIORITY_STYLES[task.priority];

  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-2 border"
      style={{ background: "#111111", borderColor: "#1f1f1f" }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-snug" style={{ color: "#f5f5f5" }}>
          {task.title}
        </span>
        <span
          className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded"
          style={{ color: p.color, background: p.bg }}
        >
          {p.label}
        </span>
      </div>

      <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: "#71717a" }}>
        {task.description}
      </p>

      <div className="flex items-center justify-between mt-1">
        {agent && (
          <span className="text-xs flex items-center gap-1.5" style={{ color: "#71717a" }}>
            <span
              className="w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold"
              style={{ background: agent.avatar_color, color: "#fff" }}
            >
              {agent.name[0]}
            </span>
            {agent.name}
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onRun(); }}
          className="ml-auto text-xs font-medium px-2.5 py-1 rounded-lg transition-colors duration-150"
          style={{ background: "#1f1f1f", color: "#71717a" }}
          onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.background = "#2a2a2a"; (e.target as HTMLButtonElement).style.color = "#f5f5f5"; }}
          onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.background = "#1f1f1f"; (e.target as HTMLButtonElement).style.color = "#71717a"; }}
        >
          Run →
        </button>
      </div>
    </div>
  );
}
