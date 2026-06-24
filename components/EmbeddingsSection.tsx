"use client";

const EMBEDDING_MODELS = [
  { id: "voyage-3", label: "voyage-3 (VoyageAI)" },
  { id: "voyage-3-lite", label: "voyage-3-lite (VoyageAI)" },
  { id: "text-embedding-3-small", label: "text-embedding-3-small (OpenAI)" },
];

interface Props {
  showToast: (msg: string) => void;
}

export default function EmbeddingsSection({ showToast }: Props) {
  const embeddingModel = "voyage-3";

  return (
    <>
      <div
        className="flex items-start gap-2.5 px-4 py-3 rounded-xl mb-5 text-xs leading-relaxed"
        style={{ background: "#2a1a00", borderLeft: "3px solid #f59e0b", color: "#a1a1aa" }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="shrink-0 mt-0.5"
          style={{ color: "#f59e0b" }}
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
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
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 .49-3" />
          </svg>
          Re-embed All Data
        </button>
      </div>
    </>
  );
}
