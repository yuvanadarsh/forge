"use client";

import { useEffect, useState } from "react";
import { COLOR_PRESETS, PROVIDER_MODELS } from "@/components/CreateAgentModal";
import { listApiKeys, updateAgent } from "@/lib/api";
import { useForge } from "@/lib/store";
import type { AgentUpdatePayload, ApiKeyInfo, BackendAgent } from "@/types";

interface Props {
  agent: BackendAgent;
  onClose: () => void;
  /** Called with the persisted agent after a successful PATCH. */
  onSaved?: (agent: BackendAgent, message: string) => void;
  /** Called with the API error message; the modal stays open. */
  onError?: (message: string) => void;
}

export default function EditAgentModal({ agent, onClose, onSaved, onError }: Props) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const { dispatch } = useForge();
  const readOnly = agent.is_eternal;

  const [name, setName] = useState(agent.name);
  const [role, setRole] = useState(agent.role);
  const [specialty, setSpecialty] = useState(agent.specialty);
  const [systemPrompt, setSystemPrompt] = useState(agent.system_prompt);
  const [color, setColor] = useState(agent.avatar_color);
  const [model, setModel] = useState(agent.model);
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listApiKeys()
      .then(setApiKeys)
      .catch(() => setApiKeys([]));
  }, []);

  const availableGroups = PROVIDER_MODELS.filter((g) =>
    apiKeys?.some((k) => k.provider.toLowerCase() === g.provider),
  );
  // The agent's current model stays selectable even if its provider has no
  // configured key anymore — otherwise the select would lie about the truth.
  const modelIsListed = availableGroups.some((g) => g.models.includes(model));

  const canSave =
    !readOnly &&
    !saving &&
    name.trim().length > 0 &&
    role.trim().length > 0;

  async function handleSave() {
    if (!canSave) return;
    const payload: AgentUpdatePayload = {};
    if (name.trim() !== agent.name) payload.name = name.trim();
    if (role.trim() !== agent.role) payload.role = role.trim();
    if (specialty !== agent.specialty) payload.specialty = specialty;
    if (systemPrompt !== agent.system_prompt) payload.system_prompt = systemPrompt;
    if (color !== agent.avatar_color) payload.avatar_color = color;
    if (model !== agent.model) payload.model = model;
    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      const updated = await updateAgent(agent.id, payload);
      dispatch({ type: "UPDATE_AGENT", agent: updated });
      onSaved?.(updated, `Agent "${updated.name}" updated`);
      onClose();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Failed to update agent");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = { background: "#0d0d0d", borderColor: "#1f1f1f", color: "#f5f5f5" };
  const inputClass =
    "w-full px-3 py-2.5 rounded-lg text-sm outline-none border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60";

  function focusBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    if (!readOnly) e.target.style.borderColor = "#f59e0b";
  }
  function blurBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    e.target.style.borderColor = "#1f1f1f";
  }

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
          <h2 className="text-base font-semibold" style={{ color: "#f5f5f5" }}>
            {readOnly ? `${agent.name} — Configuration` : `Edit ${agent.name}`}
          </h2>
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
          {readOnly && (
            <div
              className="px-3 py-2.5 rounded-lg text-xs leading-relaxed border"
              style={{ background: "#2a1a00", borderColor: "#f59e0b40", color: "#f59e0b" }}
            >
              ⚡ {agent.name} is an eternal agent. Its configuration is permanent.
            </div>
          )}

          {/* Avatar color */}
          <div>
            <label className="text-xs font-medium block mb-2" style={{ color: "#71717a" }}>Avatar Color</label>
            <div className="flex gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() => !readOnly && setColor(c)}
                  disabled={readOnly}
                  className="w-8 h-8 rounded-full transition-transform duration-150 hover:scale-110 disabled:cursor-not-allowed disabled:hover:scale-100"
                  style={{
                    background: c,
                    outline: color === c ? `3px solid ${c}` : "3px solid transparent",
                    outlineOffset: "2px",
                    opacity: readOnly && color !== c ? 0.4 : 1,
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
              disabled={readOnly}
              className={inputClass}
              style={inputStyle}
              onFocus={focusBorder}
              onBlur={blurBorder}
            />
          </div>

          {/* Role title */}
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: "#71717a" }}>Role Title</label>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={readOnly}
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
              disabled={readOnly}
              className={inputClass}
              style={inputStyle}
              onFocus={focusBorder}
              onBlur={blurBorder}
            />
          </div>

          {/* Model */}
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: "#71717a" }}>Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={readOnly || apiKeys === null}
              className={`${inputClass} cursor-pointer`}
              style={inputStyle}
              onFocus={focusBorder}
              onBlur={blurBorder}
            >
              {!modelIsListed && <option value={model}>{model} (current)</option>}
              {availableGroups.map((g) => (
                <optgroup key={g.provider} label={g.label}>
                  {g.models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {apiKeys !== null && availableGroups.length === 0 && (
              <p className="text-xs mt-1" style={{ color: "#3f3f46" }}>
                No providers configured — add an API key in Settings to switch models.
              </p>
            )}
          </div>

          {/* System prompt */}
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: "#71717a" }}>System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={7}
              disabled={readOnly}
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
            {readOnly ? "Close" : "Cancel"}
          </button>
          {!readOnly && (
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-150"
              style={{
                background: canSave ? "#f59e0b" : "#2a2a2a",
                color: canSave ? "#0a0a0a" : "#3f3f46",
              }}
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
