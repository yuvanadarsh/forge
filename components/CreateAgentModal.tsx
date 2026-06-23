"use client";

import { useState } from "react";
import type { Agent } from "@/types";

const COLOR_PRESETS = [
  "#6366f1",
  "#f59e0b",
  "#3b82f6",
  "#22c55e",
  "#ec4899",
  "#f97316",
];

const ROLE_OPTIONS = [
  "CEO", "CTO", "Architect", "Frontend Dev", "Backend Dev",
  "Tester", "Bug Patcher", "Project Manager", "Data Scientist", "DevOps",
];

const MODEL_OPTIONS = [
  "claude-opus-4-8",
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
  "gpt-4o",
  "gpt-4o-mini",
  "gemini-2.5-pro",
];

interface Props {
  onClose: () => void;
  onCreate: (agent: Agent) => void;
}

export default function CreateAgentModal({ onClose, onCreate }: Props) {
  const [name, setName] = useState("");
  const [role, setRole] = useState(ROLE_OPTIONS[0]);
  const [specialty, setSpecialty] = useState("");
  const [model, setModel] = useState(MODEL_OPTIONS[1]);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [color, setColor] = useState(COLOR_PRESETS[0]);

  function handleCreate() {
    const agent: Agent = {
      id: `agent-${Date.now()}`,
      name,
      role,
      specialty,
      avatar_color: color,
      model,
      system_prompt: systemPrompt,
      status: "idle",
      last_active: new Date().toISOString(),
      tokens_used: 0,
      cost_usd: 0,
      created_at: new Date().toISOString(),
    };
    onCreate(agent);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-[520px] rounded-2xl border shadow-2xl"
        style={{ background: "#111111", borderColor: "#1f1f1f" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "#1f1f1f" }}>
          <h2 className="text-base font-semibold" style={{ color: "#f5f5f5" }}>Create Agent</h2>
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
          {/* Color picker */}
          <div>
            <label className="text-xs font-medium block mb-2" style={{ color: "#71717a" }}>Avatar Color</label>
            <div className="flex gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-full transition-transform duration-150 hover:scale-110"
                  style={{
                    background: c,
                    outline: color === c ? `3px solid ${c}` : "3px solid transparent",
                    outlineOffset: "2px",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: "#71717a" }}>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Aria"
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none border transition-colors duration-150"
              style={{ background: "#0d0d0d", borderColor: "#1f1f1f", color: "#f5f5f5" }}
              onFocus={(e) => (e.target.style.borderColor = "#f59e0b")}
              onBlur={(e) => (e.target.style.borderColor = "#1f1f1f")}
            />
          </div>

          {/* Role */}
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: "#71717a" }}>Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none border transition-colors duration-150 cursor-pointer"
              style={{ background: "#0d0d0d", borderColor: "#1f1f1f", color: "#f5f5f5" }}
            >
              {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Specialty */}
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: "#71717a" }}>Specialty</label>
            <input
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="e.g. React, Next.js, and UI/UX implementation"
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none border transition-colors duration-150"
              style={{ background: "#0d0d0d", borderColor: "#1f1f1f", color: "#f5f5f5" }}
              onFocus={(e) => (e.target.style.borderColor = "#f59e0b")}
              onBlur={(e) => (e.target.style.borderColor = "#1f1f1f")}
            />
          </div>

          {/* Model */}
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: "#71717a" }}>Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none border transition-colors duration-150 cursor-pointer"
              style={{ background: "#0d0d0d", borderColor: "#1f1f1f", color: "#f5f5f5" }}
            >
              {MODEL_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* System Prompt */}
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: "#71717a" }}>System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Describe this agent's persona and instructions..."
              rows={4}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none border transition-colors duration-150 resize-none"
              style={{ background: "#0d0d0d", borderColor: "#1f1f1f", color: "#f5f5f5" }}
              onFocus={(e) => (e.target.style.borderColor = "#f59e0b")}
              onBlur={(e) => (e.target.style.borderColor = "#1f1f1f")}
            />
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
            onClick={handleCreate}
            disabled={!name.trim()}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-150"
            style={{ background: name.trim() ? "#f59e0b" : "#2a2a2a", color: name.trim() ? "#0a0a0a" : "#3f3f46" }}
          >
            Create Agent
          </button>
        </div>
      </div>
    </div>
  );
}
