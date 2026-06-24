"use client";

import { useState } from "react";
import Toast from "@/components/Toast";
import AddProviderModal from "@/components/AddProviderModal";
import ProviderRow from "@/components/ProviderRow";
import { mockAgents, mockTasks, mockConversations } from "@/lib/mock-data";
import type { Provider } from "@/types";

const EMBEDDING_MODELS = [
  { id: "voyage-3", label: "voyage-3 (VoyageAI)" },
  { id: "voyage-3-lite", label: "voyage-3-lite (VoyageAI)" },
  { id: "text-embedding-3-small", label: "text-embedding-3-small (OpenAI)" },
];

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
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

const DEFAULT_PROVIDERS: Provider[] = [
  { id: "anthropic", name: "Anthropic", isDefault: true },
];

export default function SettingsPage() {
  const [providers, setProviders] = useState<Provider[]>(DEFAULT_PROVIDERS);
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [embeddingModel] = useState("voyage-3");
  const [toast, setToast] = useState<string | null>(null);

  function saveKey(id: string, key: string) {
    if (key.trim()) {
      setProviders((prev) =>
        prev.map((p) => (p.id === id ? { ...p, apiKey: key.trim() } : p))
      );
    }
  }

  function deleteProvider(id: string) {
    setProviders((prev) => prev.filter((p) => p.id !== id));
  }

  function handleAddProvider(provider: Provider) {
    setProviders((prev) => [...prev, provider]);
    setShowAddProvider(false);
  }

  const card = "rounded-xl border p-6 mb-6";
  const cardSt = { background: "#111111", borderColor: "#1f1f1f" };

  return (
    <div className="px-8 py-8 max-w-[720px] mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "#f5f5f5" }}>Settings</h1>
        <p className="text-sm mt-1" style={{ color: "#71717a" }}>
          Manage API keys, embedding models, and data exports.
        </p>
      </div>

      {/* Section 1: API Keys — Provider Vault */}
      <div className={card} style={cardSt}>
        <SectionHeader
          title="API Keys"
          subtitle="Keys are stored encrypted in the database — not in .env files"
        />
        <div className="space-y-3">
          {providers.map((p) => (
            <ProviderRow
              key={p.id}
              provider={p}
              onSaveKey={saveKey}
              onDelete={deleteProvider}
              onTest={() => setToast("Coming soon — API key testing not yet wired.")}
            />
          ))}
        </div>
        <button
          onClick={() => setShowAddProvider(true)}
          className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150"
          style={{ background: "#1a1a00", color: "#f59e0b", border: "1px solid #3a2a00" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#2a2000"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#1a1a00"; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Provider
        </button>
      </div>

      {/* Section 2: Embeddings */}
      <div className={card} style={cardSt}>
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
            <label className="text-xs font-medium block mb-1.5" style={{ color: "#71717a" }}>Embedding Model</label>
            <div className="relative">
              <select
                value={embeddingModel}
                disabled
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none border cursor-not-allowed"
                style={{ background: "#0d0d0d", borderColor: "#1f1f1f", color: "#3f3f46" }}
              >
                {EMBEDDING_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <div
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs px-2 py-0.5 rounded-full pointer-events-none"
                style={{ background: "#1a1a1a", color: "#71717a" }}
              >
                locked
              </div>
            </div>
            <p className="text-xs mt-1.5" style={{ color: "#3f3f46" }}>Changing models requires re-embedding all data</p>
          </div>
          <button
            onClick={() => setToast("Coming soon — re-embedding not yet implemented.")}
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
      <div className={card} style={cardSt}>
        <SectionHeader title="Export Data" subtitle="Download all your data as formatted JSON files" />
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Export Agents", fn: () => downloadJson(mockAgents, "forge-agents.json") },
            { label: "Export Tasks", fn: () => downloadJson(mockTasks, "forge-tasks.json") },
            { label: "Export Conversations", fn: () => downloadJson(mockConversations, "forge-conversations.json") },
          ].map(({ label, fn }) => (
            <button
              key={label} onClick={fn}
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

      {showAddProvider && (
        <AddProviderModal onClose={() => setShowAddProvider(false)} onAdd={handleAddProvider} />
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
