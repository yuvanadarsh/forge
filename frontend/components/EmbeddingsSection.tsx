"use client";

import { useState } from "react";
import { reembedAllData } from "@/lib/api";

interface Props {
  showToast: (msg: string) => void;
}

export default function EmbeddingsSection({ showToast }: Props) {
  const [reembedding, setReembedding] = useState(false);

  async function handleReembed() {
    if (reembedding) return;
    setReembedding(true);
    try {
      await reembedAllData();
      showToast("Coming soon — re-embedding not yet implemented.");
    } catch {
      showToast("Could not reach the backend.");
    } finally {
      setReembedding(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium block mb-1.5" style={{ color: "#71717a" }}>
          Embedding Model
        </label>
        <div className="relative">
          <div
            className="w-full px-3 py-2.5 rounded-lg text-sm border"
            style={{ background: "#0d0d0d", borderColor: "#1f1f1f", color: "#a1a1aa" }}
          >
            all-MiniLM-L6-v2 (local, no API key required)
          </div>
          <div
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs px-2 py-0.5 rounded-full pointer-events-none"
            style={{ background: "#1a1a1a", color: "#22c55e" }}
          >
            local
          </div>
        </div>
        <p className="text-xs mt-1.5" style={{ color: "#71717a" }}>
          Embeddings run locally. No API key or internet required.
        </p>
      </div>
      <button
        onClick={handleReembed}
        disabled={reembedding}
        className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150"
        style={{ background: "#1f1f1f", color: "#71717a" }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#f5f5f5"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#71717a"; }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 .49-3" />
        </svg>
        {reembedding ? "Requesting…" : "Re-embed All Data"}
      </button>
    </div>
  );
}
