"use client";

import { useEffect, useState } from "react";
import { browseWorkspace } from "@/lib/api";
import type { WorkspaceBrowseResult } from "@/types";

interface Props {
  onSelect: (path: string) => void;
  onClose: () => void;
}

// Nests inside CreatePipelineModal (z-40) — needs a higher stacking
// context, same "nested modal over modal" pattern ConfirmDialog uses.
const NESTED_Z_INDEX = 9999;

export default function WorkspaceBrowserModal({ onSelect, onClose }: Props) {
  const [listing, setListing] = useState<WorkspaceBrowseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function load(path?: string) {
    setLoading(true);
    setError(null);
    browseWorkspace(path)
      .then(setListing)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to list directory"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    // loading/error already default correctly (true/null) — inline the
    // fetch instead of calling load() so no setState runs synchronously
    // in the effect body (react-hooks/set-state-in-effect).
    browseWorkspace()
      .then(setListing)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to list directory"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div
      className="modal-overlay flex items-center justify-center p-4"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: NESTED_Z_INDEX,
        background: "rgba(0,0,0,0.6)",
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border p-5 flex flex-col"
        style={{
          background: "#111111",
          borderColor: "#1f1f1f",
          maxHeight: "80vh",
          zIndex: NESTED_Z_INDEX,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold" style={{ color: "#f5f5f5" }}>
            Browse workspace
          </h2>
          <button
            onClick={onClose}
            className="text-xs px-2 py-1 rounded-md transition-colors duration-150"
            style={{ color: "#71717a" }}
          >
            ✕
          </button>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => listing?.parent_path && load(listing.parent_path)}
            disabled={!listing?.parent_path}
            className="px-2.5 py-1.5 rounded-md text-xs font-medium border shrink-0 transition-colors duration-150 disabled:opacity-40"
            style={{ background: "#1a1a1a", color: "#f5f5f5", borderColor: "#1f1f1f" }}
          >
            ↑ Up
          </button>
          <p
            className="text-xs font-mono truncate flex-1 px-2 py-1.5 rounded-md"
            style={{ background: "#0d0d0d", color: "#a1a1aa", borderColor: "#1f1f1f" }}
            title={listing?.current_path}
          >
            {listing?.current_path ?? "…"}
          </p>
        </div>

        <div
          className="flex-1 overflow-y-auto rounded-lg border"
          style={{ borderColor: "#1f1f1f", minHeight: "220px" }}
        >
          {loading ? (
            <p className="text-xs p-4" style={{ color: "#71717a" }}>
              Loading…
            </p>
          ) : error ? (
            <div className="p-4">
              <p className="text-xs mb-3" style={{ color: "#ef4444" }}>
                {error}
              </p>
              <button
                onClick={() => load()}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150"
                style={{ background: "#1a1a1a", color: "#f5f5f5" }}
              >
                Go to workspace root
              </button>
            </div>
          ) : listing && listing.entries.length === 0 ? (
            <p className="text-xs p-4" style={{ color: "#71717a" }}>
              No subfolders here.
            </p>
          ) : (
            <ul>
              {listing?.entries.map((entry) => (
                <li key={entry.path}>
                  <button
                    type="button"
                    onClick={() => load(entry.path)}
                    className="w-full text-left px-3 py-2 text-sm transition-colors duration-150"
                    style={{ color: "#f5f5f5" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#1a1a1a")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    📁 {entry.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-150"
            style={{ background: "#1a1a1a", color: "#a1a1aa" }}
          >
            Cancel
          </button>
          <button
            onClick={() => listing && onSelect(listing.current_path)}
            disabled={!listing}
            className="px-3 py-2 rounded-lg text-xs font-semibold transition-colors duration-150 disabled:opacity-40"
            style={{ background: "#f59e0b", color: "#0a0a0a" }}
          >
            Select this folder
          </button>
        </div>
      </div>
    </div>
  );
}
