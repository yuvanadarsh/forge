"use client";

// Top-level dismissible banner for store.error (set when any initial
// ForgeProvider fetch fails). Rendered once in the root layout.

import { useForge } from "@/lib/store";

export default function ErrorBanner() {
  const { state, dispatch, reload } = useForge();

  if (!state.error) return null;

  return (
    <div
      className="sticky top-0 z-40 flex items-center gap-3 px-4 py-2.5 border-b text-xs"
      style={{ background: "#1a0a0a", borderColor: "#3a1515", color: "#fca5a5" }}
    >
      <span className="font-bold shrink-0">⚠</span>
      <span className="flex-1 truncate">{state.error}</span>
      <button
        onClick={() => void reload()}
        className="shrink-0 px-2.5 py-1 rounded-lg font-semibold transition-colors duration-150"
        style={{ background: "#3a1515", color: "#fecaca" }}
      >
        Retry
      </button>
      <button
        onClick={() => dispatch({ type: "SET_ERROR", error: null })}
        className="shrink-0 px-1.5 transition-opacity duration-150 opacity-60 hover:opacity-100"
        style={{ color: "#fca5a5" }}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
