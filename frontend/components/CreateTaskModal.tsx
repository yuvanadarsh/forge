"use client";

import { useEffect, useState } from "react";
import { createTask } from "@/lib/api";
import { useForge } from "@/lib/store";
import type { BackendTask, Task } from "@/types";

const PRIORITIES: { value: Task["priority"]; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "#71717a" },
  { value: "med", label: "Medium", color: "#3b82f6" },
  { value: "high", label: "High", color: "#f59e0b" },
  { value: "urgent", label: "Urgent", color: "#ef4444" },
];

interface Props {
  initialStatus?: Task["status"];
  onClose: () => void;
  /** Called with the persisted task after a successful POST. */
  onCreate: (task: BackendTask) => void;
  /** Called with the API error message; the modal stays open. */
  onError?: (message: string) => void;
}

export default function CreateTaskModal({ onClose, onCreate, onError }: Props) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const { state } = useForge();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("med");
  const [submitting, setSubmitting] = useState(false);

  const agents = state.agents;

  async function handleCreate(chosenStatus: Task["status"]) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const task = await createTask({
        title: title.trim(),
        description,
        assigned_to: assignedTo || undefined,
        priority,
        status: chosenStatus,
      });
      onCreate(task);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="modal-overlay fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-[560px] rounded-2xl border shadow-2xl"
        style={{ background: "#111111", borderColor: "#1f1f1f" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "#1f1f1f" }}>
          <h2 className="text-base font-semibold" style={{ color: "#f5f5f5" }}>New Task</h2>
          <button onClick={onClose} className="transition-colors duration-150" style={{ color: "#71717a" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#f5f5f5")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#71717a")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: "#71717a" }}>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Build the agent card component"
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none border transition-colors duration-150"
              style={{ background: "#0d0d0d", borderColor: "#1f1f1f", color: "#f5f5f5" }}
              onFocus={(e) => (e.target.style.borderColor = "#f59e0b")}
              onBlur={(e) => (e.target.style.borderColor = "#1f1f1f")}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: "#71717a" }}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What needs to be done?"
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none border transition-colors duration-150 resize-none"
              style={{ background: "#0d0d0d", borderColor: "#1f1f1f", color: "#f5f5f5" }}
              onFocus={(e) => (e.target.style.borderColor = "#f59e0b")}
              onBlur={(e) => (e.target.style.borderColor = "#1f1f1f")}
            />
          </div>

          {/* Assign to */}
          <div>
            <label className="text-xs font-medium block mb-2" style={{ color: "#71717a" }}>Assign To</label>
            <div className="grid grid-cols-4 gap-2">
              {agents.length === 0 && (
                <p className="col-span-4 text-xs" style={{ color: "#3f3f46" }}>
                  No agents yet — the task will be unassigned.
                </p>
              )}
              {agents.map((agent) => {
                const selected = assignedTo === agent.id;
                return (
                  <button
                    key={agent.id}
                    onClick={() => setAssignedTo(agent.id)}
                    className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-center transition-all duration-150"
                    style={{
                      background: selected ? `${agent.avatar_color}15` : "#0d0d0d",
                      borderColor: selected ? agent.avatar_color : "#1f1f1f",
                    }}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: agent.avatar_color, color: "#fff" }}
                    >
                      {agent.name[0]}
                    </div>
                    <div className="text-[10px] leading-tight" style={{ color: selected ? "#f5f5f5" : "#71717a" }}>
                      <div className="font-medium">{agent.name}</div>
                      <div className="opacity-70">{agent.role}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="text-xs font-medium block mb-2" style={{ color: "#71717a" }}>Priority</label>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPriority(p.value)}
                  className="flex-1 py-2 rounded-lg text-xs font-medium border transition-all duration-150"
                  style={{
                    color: priority === p.value ? p.color : "#71717a",
                    borderColor: priority === p.value ? p.color : "#1f1f1f",
                    background: priority === p.value ? `${p.color}15` : "#0d0d0d",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: "#1f1f1f" }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150"
            style={{ background: "#1f1f1f", color: "#71717a" }}
          >
            Cancel
          </button>
          <button
            onClick={() => handleCreate("backlog")}
            disabled={!title.trim() || submitting}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150"
            style={{ background: title.trim() && !submitting ? "#1f1f1f" : "#161616", color: title.trim() && !submitting ? "#f5f5f5" : "#3f3f46", border: "1px solid #2a2a2a" }}
          >
            Add to Backlog
          </button>
          <button
            onClick={() => handleCreate("in_progress")}
            disabled={!title.trim() || submitting}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-150"
            style={{ background: title.trim() && !submitting ? "#f59e0b" : "#2a2a2a", color: title.trim() && !submitting ? "#0a0a0a" : "#3f3f46" }}
          >
            {submitting ? "Creating…" : "Start Now"}
          </button>
        </div>
      </div>
    </div>
  );
}
