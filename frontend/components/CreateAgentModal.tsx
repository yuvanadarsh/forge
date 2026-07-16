"use client";

import { useState } from "react";
import { createAgent } from "@/lib/api";
import type { BackendAgent } from "@/types";

const COLOR_PRESETS = [
  "#6366f1",
  "#f59e0b",
  "#3b82f6",
  "#22c55e",
  "#ec4899",
  "#f97316",
];

type Preset = {
  role: string;
  specialty: string;
  system_prompt: string;
};

const ROLE_PRESETS: Record<string, Preset> = {
  CEO: {
    role: "CEO",
    specialty: "Strategic vision, team leadership, and high-level decision making",
    system_prompt: "You are the Chief Executive Officer of this project. Your role is to provide high-level strategic direction, make final decisions on priorities, and ensure all agents are aligned toward the overarching goal. Think big picture, communicate clearly, and empower your team.",
  },
  CTO: {
    role: "CTO",
    specialty: "Technical architecture, engineering standards, and technology decisions",
    system_prompt: "You are the Chief Technology Officer. Your role is to own the technical vision, define architecture standards, evaluate technology choices, and ensure engineering excellence across all workstreams.",
  },
  Architect: {
    role: "Architect",
    specialty: "System design, API contracts, and scalable architecture patterns",
    system_prompt: "You are a Software Architect. You design systems that are scalable, maintainable, and secure. You define API contracts, data models, and integration patterns. You review code for architectural compliance and guide implementation teams.",
  },
  "Frontend Dev": {
    role: "Frontend Dev",
    specialty: "React, Next.js, TypeScript, Tailwind CSS, and UI/UX implementation",
    system_prompt: "You are a Frontend Developer specializing in modern web technologies. You build polished, accessible, and performant user interfaces using React and Next.js. You care deeply about user experience, design consistency, and component reusability.",
  },
  "Backend Dev": {
    role: "Backend Dev",
    specialty: "APIs, databases, authentication, and server-side logic",
    system_prompt: "You are a Backend Developer. You design and implement robust APIs, manage database schemas, handle authentication and authorization, and ensure data integrity and security across all server-side systems.",
  },
  Tester: {
    role: "Tester",
    specialty: "QA, test automation, edge case analysis, and regression testing",
    system_prompt: "You are a QA Engineer. You write comprehensive test suites covering unit, integration, and end-to-end scenarios. You identify edge cases, validate requirements, and ensure that no regression slips through to production.",
  },
  "Bug Patcher": {
    role: "Bug Patcher",
    specialty: "Debugging, root cause analysis, and targeted code fixes",
    system_prompt: "You are a Bug Patcher. When issues arise, you quickly diagnose root causes, apply minimal targeted fixes, and verify that the fix doesn't introduce regressions. You document what went wrong and why.",
  },
  "Project Manager": {
    role: "Project Manager",
    specialty: "Task coordination, timeline tracking, and cross-team communication",
    system_prompt: "You are a Project Manager. You coordinate tasks across agents, track progress against milestones, flag blockers early, and ensure the team is always working on the highest-priority items. You keep communication clear and concise.",
  },
  "PR Reviewer": {
    role: "PR Reviewer",
    specialty: "Code review, standards enforcement, and constructive feedback",
    system_prompt: "You are a Pull Request Reviewer. You review code changes for correctness, security, performance, and adherence to project standards. You provide clear, actionable feedback and approve only code that meets the bar.",
  },
  "Data Scientist": {
    role: "Data Scientist",
    specialty: "Data analysis, ML models, and insight generation",
    system_prompt: "You are a Data Scientist. You analyze data to extract insights, build and evaluate machine learning models, and translate findings into actionable recommendations for the team.",
  },
  DevOps: {
    role: "DevOps",
    specialty: "CI/CD, infrastructure, deployment automation, and monitoring",
    system_prompt: "You are a DevOps Engineer. You manage CI/CD pipelines, infrastructure as code, containerization, and deployment strategies. You ensure systems are reliable, observable, and easy to operate in production.",
  },
  Custom: {
    role: "",
    specialty: "",
    system_prompt: "",
  },
};

const PRESET_KEYS = Object.keys(ROLE_PRESETS);

interface Props {
  onClose: () => void;
  /** Called with the persisted agent after a successful POST. */
  onCreate: (agent: BackendAgent) => void;
  /** Called with the API error message; the modal stays open. */
  onError?: (message: string) => void;
}

export default function CreateAgentModal({ onClose, onCreate, onError }: Props) {
  const [preset, setPreset] = useState("CEO");
  const [role, setRole] = useState(ROLE_PRESETS.CEO.role);
  const [specialty, setSpecialty] = useState(ROLE_PRESETS.CEO.specialty);
  const [systemPrompt, setSystemPrompt] = useState(ROLE_PRESETS.CEO.system_prompt);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [submitting, setSubmitting] = useState(false);

  function handlePresetChange(key: string) {
    setPreset(key);
    const p = ROLE_PRESETS[key];
    setRole(p.role);
    setSpecialty(p.specialty);
    setSystemPrompt(p.system_prompt);
  }

  async function handleCreate() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const agent = await createAgent({
        name: name.trim(),
        role: role.trim() || "Agent",
        specialty,
        avatar_color: color,
        system_prompt: systemPrompt,
      });
      onCreate(agent);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = {
    background: "#0d0d0d",
    borderColor: "#1f1f1f",
    color: "#f5f5f5",
  };

  function focusBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    e.target.style.borderColor = "#f59e0b";
  }
  function blurBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    e.target.style.borderColor = "#1f1f1f";
  }

  const inputClass = "w-full px-3 py-2.5 rounded-lg text-sm outline-none border transition-colors duration-150";

  return (
    <div
      className="modal-overlay fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-[540px] rounded-2xl border shadow-2xl max-h-[90vh] flex flex-col"
        style={{ background: "#111111", borderColor: "#1f1f1f" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b shrink-0" style={{ borderColor: "#1f1f1f" }}>
          <h2 className="text-base font-semibold" style={{ color: "#f5f5f5" }}>Create Agent</h2>
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
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
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
              className={inputClass}
              style={inputStyle}
              onFocus={focusBorder}
              onBlur={blurBorder}
            />
          </div>

          {/* Preset selector */}
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: "#71717a" }}>Role Preset</label>
            <select
              value={preset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className={`${inputClass} cursor-pointer`}
              style={inputStyle}
              onFocus={focusBorder}
              onBlur={blurBorder}
            >
              {PRESET_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <p className="text-xs mt-1" style={{ color: "#3f3f46" }}>
              Pre-fills role, specialty, and system prompt — all fields remain editable.
            </p>
          </div>

          {/* Role title (editable text input) */}
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: "#71717a" }}>Role Title</label>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Senior Frontend Engineer"
              className={inputClass}
              style={inputStyle}
              onFocus={focusBorder}
              onBlur={blurBorder}
            />
          </div>

          {/* Specialty */}
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: "#71717a" }}>Specialty</label>
            <input
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="e.g. React, Next.js, and UI/UX implementation"
              className={inputClass}
              style={inputStyle}
              onFocus={focusBorder}
              onBlur={blurBorder}
            />
          </div>

          {/* Model note */}
          <div
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs border"
            style={{ background: "#0d0d0d", borderColor: "#1f1f1f", color: "#71717a" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "#f59e0b" }}>
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Model determined by provider. Configure providers in Settings.
          </div>

          {/* System Prompt */}
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: "#71717a" }}>System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Describe this agent's persona and instructions..."
              rows={5}
              className={`${inputClass} resize-none`}
              style={inputStyle}
              onFocus={focusBorder}
              onBlur={blurBorder}
            />
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
            onClick={handleCreate}
            disabled={!name.trim() || submitting}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-150"
            style={{
              background: name.trim() && !submitting ? "#f59e0b" : "#2a2a2a",
              color: name.trim() && !submitting ? "#0a0a0a" : "#3f3f46",
            }}
          >
            {submitting ? "Creating…" : "Create Agent"}
          </button>
        </div>
      </div>
    </div>
  );
}
