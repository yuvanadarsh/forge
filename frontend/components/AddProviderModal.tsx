"use client";

import { useState } from "react";
import { addApiKey } from "@/lib/api";
import type { ApiKeyInfo } from "@/types";

interface Props {
  onClose: () => void;
  /** Called with the persisted key after a successful POST. */
  onAdd: (key: ApiKeyInfo) => void;
  /** Called with the API error message; the modal stays open. */
  onError?: (message: string) => void;
}

const inputCls =
  "w-full px-3 py-2.5 rounded-lg text-sm outline-none border transition-colors duration-150";
const inputSt = { background: "#0d0d0d", borderColor: "#1f1f1f", color: "#f5f5f5" };
const hoverAmber = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = "#f59e0b"; };
const resetBorder = (e: React.FocusEvent<HTMLInputElement>) => { e.target.style.borderColor = "#1f1f1f"; };

function Field({ label, optional, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; optional?: boolean }) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1.5" style={{ color: "#71717a" }}>
        {label}{optional && <span style={{ color: "#3f3f46" }}> (optional)</span>}
      </label>
      <input onFocus={hoverAmber} onBlur={resetBorder} {...props} className={inputCls} style={inputSt} />
    </div>
  );
}

export default function AddProviderModal({ onClose, onAdd, onError }: Props) {
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd() {
    if (!canAdd || submitting) return;
    setSubmitting(true);
    try {
      const created = await addApiKey({
        provider: name.trim().toLowerCase(),
        name: name.trim(),
        base_url: baseUrl.trim() || undefined,
        api_key: apiKey.trim(),
      });
      onAdd(created);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Failed to add provider");
    } finally {
      setSubmitting(false);
    }
  }

  // The vault stores encrypted keys, so a key is required (min 4 chars,
  // matching the backend's validation).
  const canAdd = name.trim().length > 0 && apiKey.trim().length >= 4;

  return (
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-[480px] rounded-2xl border shadow-2xl"
        style={{ background: "#111111", borderColor: "#1f1f1f" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "#1f1f1f" }}>
          <h2 className="text-base font-semibold" style={{ color: "#f5f5f5" }}>Add Provider</h2>
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
        <div className="px-6 py-5 space-y-4">
          <Field
            label="Provider Name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. DeepSeek, My Ollama, Azure OpenAI"
          />
          <Field
            label="Base URL"
            optional
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.example.com/v1 — leave blank for standard providers"
          />
          <Field
            label="API Key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste your API key..."
          />
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
            onClick={handleAdd}
            disabled={!canAdd || submitting}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-150"
            style={{ background: canAdd && !submitting ? "#f59e0b" : "#2a2a2a", color: canAdd && !submitting ? "#0a0a0a" : "#3f3f46" }}
          >
            {submitting ? "Adding…" : "Add Provider"}
          </button>
        </div>
      </div>
    </div>
  );
}
