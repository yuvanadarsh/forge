"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { listConversations } from "@/lib/api";
import type { BackendAgent, BackendTask, Task } from "@/types";

const PRIORITY_STYLES: Record<Task["priority"], { label: string; color: string; bg: string }> = {
  low: { label: "Low", color: "#71717a", bg: "#1a1a1a" },
  med: { label: "Med", color: "#3b82f6", bg: "#1a2a3a" },
  high: { label: "High", color: "#f59e0b", bg: "#2a1a00" },
  urgent: { label: "Urgent", color: "#ef4444", bg: "#2a1010" },
};

const STATUS_LABELS: Record<Task["status"], string> = {
  backlog: "Backlog",
  in_progress: "In Progress",
  review: "Review",
  completed: "Completed",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

interface Props {
  task: BackendTask;
  agent?: BackendAgent;
  onClose: () => void;
}

export default function TaskSlideOver({ task, agent, onClose }: Props) {
  const p = PRIORITY_STYLES[task.priority];
  const router = useRouter();
  const [checkingConvo, setCheckingConvo] = useState(false);
  const [noConvo, setNoConvo] = useState(false);

  async function handleViewConversation() {
    if (checkingConvo) return;
    setCheckingConvo(true);
    setNoConvo(false);
    try {
      const convos = await listConversations({ task_id: task.id });
      const conversation = convos[0];
      if (conversation && conversation.agent_id) {
        router.push(`/agents/${conversation.agent_id}/conversations/${conversation.id}`);
      } else {
        setNoConvo(true);
      }
    } catch {
      setNoConvo(true);
    } finally {
      setCheckingConvo(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.4)" }}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 w-[400px] flex flex-col border-l shadow-2xl slide-over"
        style={{ background: "#111111", borderColor: "#1f1f1f" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: "#1f1f1f" }}>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#71717a" }}>Task Detail</span>
          <button
            onClick={onClose}
            className="transition-colors duration-150"
            style={{ color: "#71717a" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#f5f5f5")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#71717a")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Title */}
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: "#71717a" }}>Title</p>
            <h2 className="text-base font-semibold leading-snug" style={{ color: "#f5f5f5" }}>{task.title}</h2>
          </div>

          {/* Description */}
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: "#71717a" }}>Description</p>
            <p className="text-sm leading-relaxed" style={{ color: "#a1a1aa" }}>{task.description}</p>
          </div>

          {/* Meta row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium mb-1.5" style={{ color: "#71717a" }}>Priority</p>
              <span
                className="inline-block text-xs font-semibold px-2.5 py-1 rounded-lg"
                style={{ color: p.color, background: p.bg }}
              >
                {p.label}
              </span>
            </div>
            <div>
              <p className="text-xs font-medium mb-1.5" style={{ color: "#71717a" }}>Status</p>
              <span className="text-xs px-2.5 py-1 rounded-lg" style={{ background: "#1a1a1a", color: "#a1a1aa" }}>
                {STATUS_LABELS[task.status]}
              </span>
            </div>
          </div>

          {/* Assigned agent */}
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: "#71717a" }}>Assigned To</p>
            {agent ? (
              <div className="flex items-center gap-2.5">
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: agent.avatar_color, color: "#fff" }}
                >
                  {agent.name[0]}
                </span>
                <div>
                  <div className="text-sm font-medium" style={{ color: "#f5f5f5" }}>{agent.name}</div>
                  <div className="text-xs" style={{ color: "#71717a" }}>{agent.role}</div>
                </div>
              </div>
            ) : (
              <span className="text-sm" style={{ color: "#71717a" }}>Unassigned</span>
            )}
          </div>

          {/* Created */}
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: "#71717a" }}>Created</p>
            <p className="text-sm" style={{ color: "#a1a1aa" }}>{formatDate(task.created_at)}</p>
          </div>

          {/* View Conversation */}
          <div className="pt-2 border-t" style={{ borderColor: "#1f1f1f" }}>
            <button
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-colors duration-150"
              style={{ background: "#1a1a1a", color: "#71717a" }}
              disabled={checkingConvo}
              onClick={handleViewConversation}
            >
              <span>{checkingConvo ? "Looking…" : "View Conversation"}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
            {noConvo && (
              <p className="text-xs mt-2 text-center" style={{ color: "#3f3f46" }}>No conversation yet</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
