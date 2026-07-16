"use client";

import { useState } from "react";
import type { BackendAgent, BackendTask, Task } from "@/types";

const PRIORITY_STYLES: Record<Task["priority"], { label: string; color: string; bg: string }> = {
  low: { label: "Low", color: "#71717a", bg: "#1a1a1a" },
  med: { label: "Med", color: "#3b82f6", bg: "#1a2a3a" },
  high: { label: "High", color: "#f59e0b", bg: "#2a1a00" },
  urgent: { label: "Urgent", color: "#ef4444", bg: "#2a1010" },
};

const STATUS_OPTIONS: { key: Task["status"]; label: string }[] = [
  { key: "backlog", label: "Backlog" },
  { key: "in_progress", label: "In Progress" },
  { key: "review", label: "Review" },
  { key: "completed", label: "Completed" },
];

interface Props {
  task: BackendTask;
  agent?: BackendAgent;
  onRun: () => void;
  onClick?: () => void;
  onMove?: (status: Task["status"]) => void;
}

export default function TaskCard({ task, agent, onRun, onClick, onMove }: Props) {
  const p = PRIORITY_STYLES[task.priority];
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  const otherStatuses = STATUS_OPTIONS.filter((s) => s.key !== task.status);

  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-2 border cursor-pointer relative transition-colors duration-150 hover:border-[#2a2a2a]"
      style={{ background: "#111111", borderColor: "#1f1f1f" }}
      onClick={onClick}
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

      <div className="flex items-center justify-between mt-1 gap-1">
        {agent && (
          <span className="text-xs flex items-center gap-1.5 min-w-0 truncate" style={{ color: "#71717a" }}>
            <span
              className="w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold shrink-0"
              style={{ background: agent.avatar_color, color: "#fff" }}
            >
              {agent.name[0]}
            </span>
            <span className="truncate">{agent.name}</span>
          </span>
        )}
        <div className="flex items-center gap-1 ml-auto shrink-0">
          {/* Move to dropdown */}
          {onMove && (
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setShowMoveMenu((v) => !v); }}
                className="text-xs font-medium px-2 py-1 rounded-lg transition-colors duration-150 whitespace-nowrap"
                style={{ background: "#1f1f1f", color: "#71717a" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#2a2a2a"; (e.currentTarget as HTMLButtonElement).style.color = "#f5f5f5"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#1f1f1f"; (e.currentTarget as HTMLButtonElement).style.color = "#71717a"; }}
              >
                Move →
              </button>
              {showMoveMenu && (
                <div
                  className="absolute right-0 bottom-full mb-1 z-30 rounded-xl border shadow-xl overflow-hidden"
                  style={{ background: "#1a1a1a", borderColor: "#2a2a2a", minWidth: "130px" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {otherStatuses.map((s) => (
                    <button
                      key={s.key}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMove(s.key);
                        setShowMoveMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs transition-colors duration-150 hover:bg-[#2a2a2a]"
                      style={{ color: "#a1a1aa" }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onRun(); }}
            className="text-xs font-medium px-2.5 py-1 rounded-lg transition-colors duration-150"
            style={{ background: "#1f1f1f", color: "#71717a" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#2a2a2a"; (e.currentTarget as HTMLButtonElement).style.color = "#f5f5f5"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#1f1f1f"; (e.currentTarget as HTMLButtonElement).style.color = "#71717a"; }}
          >
            Run →
          </button>
        </div>
      </div>
    </div>
  );
}
