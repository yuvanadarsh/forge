"use client";

import { useState } from "react";
import type { Provider } from "@/types";

interface Props {
  provider: Provider;
  onSaveKey: (id: string, key: string) => void;
  onDelete: (id: string) => void;
  onTest: () => void;
}

const inputClass =
  "flex-1 px-3 py-2 rounded-lg text-sm outline-none border font-mono transition-colors duration-150";
const inputStyle = { background: "#0d0d0d", borderColor: "#1f1f1f", color: "#a1a1aa" };

export default function ProviderRow({ provider: p, onSaveKey, onDelete, onTest }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingKey, setEditingKey] = useState("");

  function startEdit() {
    setIsEditing(true);
    setEditingKey("");
  }

  function saveKey() {
    onSaveKey(p.id, editingKey);
    setIsEditing(false);
    setEditingKey("");
  }

  function cancel() {
    setIsEditing(false);
    setEditingKey("");
  }

  return (
    <div className="flex items-center gap-3">
      {/* Initial badge */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
        style={{ background: "#1a1a1a", color: "#a1a1aa" }}
      >
        {p.name.charAt(0).toUpperCase()}
      </div>

      {/* Name + optional base URL */}
      <div className="shrink-0 w-[130px]">
        <span className="text-sm font-medium block" style={{ color: "#f5f5f5" }}>
          {p.name}
        </span>
        {p.baseUrl && (
          <span className="text-[10px] truncate block max-w-[128px]" style={{ color: "#3f3f46" }}>
            {p.baseUrl}
          </span>
        )}
      </div>

      {/* Key display / edit input */}
      {isEditing ? (
        <input
          autoFocus
          type="password"
          value={editingKey}
          onChange={(e) => setEditingKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && saveKey()}
          placeholder="Paste API key..."
          className={inputClass}
          style={{ ...inputStyle, borderColor: "#f59e0b", color: "#f5f5f5" }}
        />
      ) : (
        <div className={`${inputClass} cursor-default`} style={inputStyle}>
          {p.apiKey
            ? "••••••••••••••••••••••••"
            : <span style={{ color: "#3f3f46" }}>Not configured</span>}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 shrink-0">
        {isEditing ? (
          <>
            <button
              onClick={cancel}
              className="text-xs px-2.5 py-1.5 rounded-lg transition-colors duration-150"
              style={{ background: "#1f1f1f", color: "#71717a" }}
            >
              Cancel
            </button>
            <button
              onClick={saveKey}
              className="text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-colors duration-150"
              style={{ background: "#f59e0b", color: "#0a0a0a" }}
            >
              Save
            </button>
          </>
        ) : (
          <>
            <button
              onClick={startEdit}
              className="text-xs px-2.5 py-1.5 rounded-lg transition-colors duration-150"
              style={{ background: "#1f1f1f", color: "#71717a" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#f5f5f5"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#71717a"; }}
            >
              {p.apiKey ? "Update" : "Add"}
            </button>
            <button
              onClick={onTest}
              className="text-xs px-2.5 py-1.5 rounded-lg transition-colors duration-150"
              style={{ background: "#1f1f1f", color: "#71717a" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#3b82f6"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#71717a"; }}
            >
              Test
            </button>
            {!p.isDefault && (
              <button
                onClick={() => onDelete(p.id)}
                className="text-xs px-2.5 py-1.5 rounded-lg transition-colors duration-150"
                style={{ background: "#1f1f1f", color: "#71717a" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#71717a"; }}
              >
                Delete
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
