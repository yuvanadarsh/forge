"use client";

import { useState } from "react";
import Toast from "@/components/Toast";
import { mockAgents, mockTasks, mockConversations } from "@/lib/mock-data";

type Provider = {
  id: string;
  name: string;
  icon: string;
};

const PROVIDERS: Provider[] = [
  { id: "anthropic", name: "Anthropic", icon: "A" },
  { id: "openai", name: "OpenAI", icon: "O" },
  { id: "gemini", name: "Google Gemini", icon: "G" },
  { id: "deepseek", name: "DeepSeek", icon: "D" },
  { id: "ollama", name: "Ollama", icon: "L" },
];

const EMBEDDING_MODELS = [
  { id: "voyage-3", label: "voyage-3 (VoyageAI)" },
  { id: "voyage-3-lite", label: "voyage-3-lite (VoyageAI)" },
  { id: "text-embedding-3-small", label: "text-embedding-3-small (OpenAI)" },
];

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-semibold" style={{ color: "#f5f5f5" }}>{title}</h2>
      {subtitle && <p className="text-xs mt-0.5" style={{ color: "#71717a" }}>{subtitle}</p>}
    </div>
  );
}

const inputClass = "flex-1 px-3 py-2 rounded-lg text-sm outline-none border font-mono transition-colors duration-150";
const inputStyle = { background: "#0d0d0d", borderColor: "#1f1f1f", color: "#a1a1aa" };

export default function SettingsPage() {
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [embeddingModel] = useState("voyage-3");
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
  }

  function startEdit(id: string) {
    setEditingId(id);
    setEditing((prev) => ({ ...prev, [id]: "" }));
  }

  function saveKey(id: string) {
    const val = editing[id]?.trim();
    if (val) setKeys((prev) => ({ ...prev, [id]: val }));
    setEditingId(null);
  }

  function deleteKey(id: string) {
    setKeys((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  const sectionCard = "rounded-xl border p-6 mb-6";
  const sectionCardStyle = { background: "#111111", borderColor: "#1f1f1f" };

  return (
    <div className="px-8 py-8 max-w-[720px] mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "#f5f5f5" }}>Settings</h1>
        <p className="text-sm mt-1" style={{ color: "#71717a" }}>
          Manage API keys, embedding models, and data exports.
        </p>
      </div>

      {/* Section 1: API Keys */}
      <div className={sectionCard} style={sectionCardStyle}>
        <SectionHeader
          title="API Keys"
          subtitle="Keys are stored encrypted in the database — not in .env files"
        />
        <div className="space-y-3">
          {PROVIDERS.map((p) => {
            const hasKey = Boolean(keys[p.id]);
            const isEditing = editingId === p.id;
            return (
              <div key={p.id} className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: "#1a1a1a", color: "#a1a1aa" }}
                >
                  {p.icon}
                </div>
                <span className="text-sm font-medium shrink-0 w-[130px]" style={{ color: "#f5f5f5" }}>
                  {p.name}
                </span>
                {isEditing ? (
                  <input
                    autoFocus
                    value={editing[p.id] ?? ""}
                    onChange={(e) => setEditing((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && saveKey(p.id)}
                    placeholder="Paste API key..."
                    className={inputClass}
                    style={{ ...inputStyle, borderColor: "#f59e0b", color: "#f5f5f5" }}
                  />
                ) : (
                  <div className={`${inputClass} cursor-default`} style={inputStyle}>
                    {hasKey
                      ? "••••••••••••••••••••••••"
                      : <span style={{ color: "#3f3f46" }}>Not configured</span>}
                  </div>
                )}
                <div className="flex items-center gap-1.5 shrink-0">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs px-2.5 py-1.5 rounded-lg transition-colors duration-150"
                        style={{ background: "#1f1f1f", color: "#71717a" }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => saveKey(p.id)}
                        className="text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-colors duration-150"
                        style={{ background: "#f59e0b", color: "#0a0a0a" }}
                      >
                        Save
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(p.id)}
                        className="text-xs px-2.5 py-1.5 rounded-lg transition-colors duration-150"
                        style={{ background: "#1f1f1f", color: "#71717a" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#f5f5f5"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#71717a"; }}
                      >
                        {hasKey ? "Update" : "Add"}
                      </button>
                      {hasKey && (
                        <button
                          onClick={() => deleteKey(p.id)}
                          className="text-xs px-2.5 py-1.5 rounded-lg transition-colors duration-150"
                          style={{ background: "#1f1f1f", color: "#71717a" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#71717a"; }}
                        >
                          Delete
                        </button>
                      )}
                      <button
                        onClick={() => showToast("Coming soon — API key testing not yet wired.")}
                        className="text-xs px-2.5 py-1.5 rounded-lg transition-colors duration-150"
                        style={{ background: "#1f1f1f", color: "#71717a" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#3b82f6"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#71717a"; }}
                      >
                        Test
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Embeddings */}
      <div className={sectionCard} style={sectionCardStyle}>
        <SectionHeader title="Embeddings" />
        <div
          className="flex items-start gap-2.5 px-4 py-3 rounded-xl mb-5 text-xs leading-relaxed"
          style={{ background: "#2a1a00", borderLeft: "3px solid #f59e0b", color: "#a1a1aa" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5" style={{ color: "#f59e0b" }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Switching embedding models will invalidate all existing vector data and require a full re-embed.
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: "#71717a" }}>
              Embedding Model
            </label>
            <div className="relative">
              <select
                value={embeddingModel}
                disabled
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none border cursor-not-allowed"
                style={{ background: "#0d0d0d", borderColor: "#1f1f1f", color: "#3f3f46" }}
                title="Changing models requires re-embedding all data"
              >
                {EMBEDDING_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
              <div
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs px-2 py-0.5 rounded-full pointer-events-none"
                style={{ background: "#1a1a1a", color: "#71717a" }}
              >
                locked
              </div>
            </div>
            <p className="text-xs mt-1.5" style={{ color: "#3f3f46" }}>
              Changing models requires re-embedding all data
            </p>
          </div>
          <button
            onClick={() => showToast("Coming soon — re-embedding not yet implemented.")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150"
            style={{ background: "#1f1f1f", color: "#71717a" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#f5f5f5"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#71717a"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3" />
            </svg>
            Re-embed All Data
          </button>
        </div>
      </div>

      {/* Section 3: Export Data */}
      <div className={sectionCard} style={sectionCardStyle}>
        <SectionHeader
          title="Export Data"
          subtitle="Download all your data as formatted JSON files"
        />
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Export Agents", fn: () => downloadJson(mockAgents, "forge-agents.json") },
            { label: "Export Tasks", fn: () => downloadJson(mockTasks, "forge-tasks.json") },
            { label: "Export Conversations", fn: () => downloadJson(mockConversations, "forge-conversations.json") },
          ].map(({ label, fn }) => (
            <button
              key={label}
              onClick={fn}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150"
              style={{ background: "#1f1f1f", color: "#f5f5f5" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#2a2a2a"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#1f1f1f"; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {label}
            </button>
          ))}
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
