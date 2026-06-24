"use client";

import { useState } from "react";
import Toast from "@/components/Toast";
import AddProviderModal from "@/components/AddProviderModal";
import ProviderRow from "@/components/ProviderRow";
import EmbeddingsSection from "@/components/EmbeddingsSection";
import ExportSection from "@/components/ExportSection";
import type { Provider } from "@/types";

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

      {/* Section 1: API Keys */}
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
        <EmbeddingsSection showToast={setToast} />
      </div>

      {/* Section 3: Export Data */}
      <div className={card} style={cardSt}>
        <SectionHeader title="Export Data" subtitle="Download all your data as formatted JSON files" />
        <ExportSection />
      </div>

      {showAddProvider && (
        <AddProviderModal onClose={() => setShowAddProvider(false)} onAdd={handleAddProvider} />
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
