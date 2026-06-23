"use client";

import { useState } from "react";
import type { Pipeline, Agent } from "@/types";

interface Props {
  pipeline: Pipeline;
  allAgents: Agent[];
  onClose: () => void;
  onSave: (updated: Pipeline) => void;
}

export default function EditPipelineModal({ pipeline, allAgents, onClose, onSave }: Props) {
  const [title, setTitle] = useState(pipeline.title);
  const [agentIds, setAgentIds] = useState<string[]>(pipeline.agents);
  const [showPicker, setShowPicker] = useState(false);

  function moveUp(i: number) {
    if (i === 0) return;
    const next = [...agentIds];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    setAgentIds(next);
  }

  function moveDown(i: number) {
    if (i === agentIds.length - 1) return;
    const next = [...agentIds];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    setAgentIds(next);
  }

  function removeAgent(i: number) {
    setAgentIds((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addAgent(id: string) {
    if (!agentIds.includes(id)) {
      setAgentIds((prev) => [...prev, id]);
    }
    setShowPicker(false);
  }

  function handleSave() {
    onSave({ ...pipeline, title, agents: agentIds });
  }

  const availableToAdd = allAgents.filter((a) => !agentIds.includes(a.id));

  return (
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-[520px] rounded-2xl border shadow-2xl max-h-[90vh] flex flex-col"
        style={{ background: "#111111", borderColor: "#1f1f1f" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b shrink-0" style={{ borderColor: "#1f1f1f" }}>
          <h2 className="text-base font-semibold" style={{ color: "#f5f5f5" }}>Edit Pipeline</h2>
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
        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          {/* Title */}
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: "#71717a" }}>Pipeline Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none border transition-colors duration-150"
              style={{ background: "#0d0d0d", borderColor: "#1f1f1f", color: "#f5f5f5" }}
              onFocus={(e) => (e.target.style.borderColor = "#f59e0b")}
              onBlur={(e) => (e.target.style.borderColor = "#1f1f1f")}
            />
          </div>

          {/* Agent sequence */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-medium" style={{ color: "#71717a" }}>Agent Sequence</label>
              <div className="relative">
                <button
                  onClick={() => setShowPicker((v) => !v)}
                  className="text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors duration-150"
                  style={{ background: "#1f1f1f", color: "#f59e0b" }}
                >
                  + Add Agent
                </button>
                {showPicker && availableToAdd.length > 0 && (
                  <div
                    className="absolute right-0 top-full mt-1 z-20 rounded-xl border shadow-xl overflow-hidden"
                    style={{ background: "#1a1a1a", borderColor: "#2a2a2a", minWidth: "200px", maxHeight: "200px", overflowY: "auto" }}
                  >
                    {availableToAdd.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => addAgent(a.id)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left transition-colors duration-150 hover:bg-[#2a2a2a]"
                        style={{ color: "#f5f5f5" }}
                      >
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                          style={{ background: a.avatar_color, color: "#fff" }}
                        >
                          {a.name[0]}
                        </span>
                        <span>{a.name}</span>
                        <span className="ml-auto" style={{ color: "#71717a" }}>{a.role}</span>
                      </button>
                    ))}
                    {availableToAdd.length === 0 && (
                      <div className="px-3 py-2.5 text-xs" style={{ color: "#71717a" }}>All agents added</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {agentIds.length === 0 && (
              <p className="text-xs text-center py-6" style={{ color: "#3f3f46" }}>
                No agents in sequence. Add one above.
              </p>
            )}

            <div className="space-y-2">
              {agentIds.map((agentId, i) => {
                const agent = allAgents.find((a) => a.id === agentId);
                if (!agent) return null;
                return (
                  <div
                    key={agentId}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl border"
                    style={{ background: "#0d0d0d", borderColor: "#1f1f1f" }}
                  >
                    <span className="text-xs font-medium w-5 text-center shrink-0" style={{ color: "#3f3f46" }}>
                      {i + 1}
                    </span>
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{ background: agent.avatar_color, color: "#fff" }}
                    >
                      {agent.name[0]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium" style={{ color: "#f5f5f5" }}>{agent.name}</div>
                      <div className="text-[10px]" style={{ color: "#71717a" }}>{agent.role}</div>
                    </div>
                    {/* Up/Down */}
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        onClick={() => moveUp(i)}
                        disabled={i === 0}
                        className="p-0.5 rounded transition-colors duration-150 disabled:opacity-20"
                        style={{ color: "#71717a" }}
                        onMouseEnter={(e) => { if (i > 0) (e.currentTarget as HTMLButtonElement).style.color = "#f5f5f5"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#71717a"; }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="18 15 12 9 6 15" />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveDown(i)}
                        disabled={i === agentIds.length - 1}
                        className="p-0.5 rounded transition-colors duration-150 disabled:opacity-20"
                        style={{ color: "#71717a" }}
                        onMouseEnter={(e) => { if (i < agentIds.length - 1) (e.currentTarget as HTMLButtonElement).style.color = "#f5f5f5"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#71717a"; }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    </div>
                    {/* Remove */}
                    <button
                      onClick={() => removeAgent(i)}
                      className="shrink-0 transition-colors duration-150"
                      style={{ color: "#3f3f46" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#3f3f46"; }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t shrink-0" style={{ borderColor: "#1f1f1f" }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150"
            style={{ background: "#1f1f1f", color: "#71717a" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-150"
            style={{ background: title.trim() ? "#f59e0b" : "#2a2a2a", color: title.trim() ? "#0a0a0a" : "#3f3f46" }}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
