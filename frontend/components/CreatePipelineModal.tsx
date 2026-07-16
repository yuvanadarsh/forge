"use client";

import { useEffect, useState } from "react";
import { createPipeline } from "@/lib/api";
import { useForge } from "@/lib/store";
import type { BackendPipeline } from "@/types";

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

interface Props {
  onClose: () => void;
  /** Called with the persisted pipeline after a successful POST. */
  onCreate: (pipeline: BackendPipeline) => void;
  /** Called with the API error message; the modal stays open. */
  onError?: (message: string) => void;
}

export default function CreatePipelineModal({ onClose, onCreate, onError }: Props) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const { state } = useForge();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [workspaceMode, setWorkspaceMode] = useState<"new" | "existing">("new");
  const [existingPath, setExistingPath] = useState("");
  const [folderName, setFolderName] = useState("");
  const [folderNameEdited, setFolderNameEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!folderNameEdited) setFolderName(slugify(value));
  }

  function handleFolderNameChange(value: string) {
    setFolderNameEdited(true);
    setFolderName(value);
  }

  function handleBrowse() {
    const input = document.createElement("input");
    input.type = "file";
    // webkitdirectory is a non-standard but widely-supported attribute for
    // picking a folder; browsers only ever expose files' paths relative to
    // the picked root, never an absolute filesystem path.
    (input as HTMLInputElement & { webkitdirectory: boolean }).webkitdirectory = true;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const relativePath = file.webkitRelativePath || file.name;
      const folder = relativePath.split("/")[0];
      if (folder) setExistingPath(`/Users/username/${folder}`);
    };
    input.click();
  }

  const agents = state.agents;
  // Auto-suggest defaults on when a CEO-role agent exists to do the choosing.
  const [autoSuggest, setAutoSuggest] = useState(
    () => state.agents.some((a) => a.role.trim().toLowerCase() === "ceo"),
  );

  function toggleAgent(agentId: string) {
    setSelectedAgents((prev) =>
      prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId],
    );
  }

  const canSubmit =
    title.trim().length > 0 &&
    (autoSuggest || selectedAgents.length > 0) &&
    (workspaceMode === "existing"
      ? existingPath.trim().length > 0
      : folderName.trim().length > 0);

  async function handleCreate() {
    if (submitting || !canSubmit) return;
    setSubmitting(true);
    try {
      const pipeline = await createPipeline({
        title: title.trim(),
        description,
        agent_sequence: autoSuggest ? [] : selectedAgents,
        auto_suggest: autoSuggest,
        workspace_path:
          workspaceMode === "existing" && existingPath.trim() ? existingPath.trim() : undefined,
        folder_name: workspaceMode === "new" ? folderName.trim() : undefined,
      });
      onCreate(pipeline);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Failed to create pipeline");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="modal-overlay fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-[560px] rounded-2xl border shadow-2xl"
        style={{ background: "#111111", borderColor: "#1f1f1f" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "#1f1f1f" }}>
          <h2 className="text-base font-semibold" style={{ color: "#f5f5f5" }}>New Pipeline</h2>
          <button onClick={onClose} className="transition-colors duration-150" style={{ color: "#71717a" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#f5f5f5")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#71717a")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Title */}
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: "#71717a" }}>Title</label>
            <input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. Ship the billing dashboard"
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none border transition-colors duration-150"
              style={{ background: "#0d0d0d", borderColor: "#1f1f1f", color: "#f5f5f5" }}
              onFocus={(e) => (e.target.style.borderColor = "#f59e0b")}
              onBlur={(e) => (e.target.style.borderColor = "#1f1f1f")}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: "#71717a" }}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this pipeline building?"
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none border transition-colors duration-150 resize-none"
              style={{ background: "#0d0d0d", borderColor: "#1f1f1f", color: "#f5f5f5" }}
              onFocus={(e) => (e.target.style.borderColor = "#f59e0b")}
              onBlur={(e) => (e.target.style.borderColor = "#1f1f1f")}
            />
          </div>

          {/* Auto-suggest toggle */}
          <div>
            <button
              onClick={() => setAutoSuggest((v) => !v)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg border w-full transition-colors duration-150"
              style={{ background: "#0d0d0d", borderColor: autoSuggest ? "#f59e0b" : "#1f1f1f" }}
            >
              <span
                className="relative inline-block w-11 h-6 rounded-full overflow-hidden transition-colors duration-150 shrink-0"
                style={{ background: autoSuggest ? "#f59e0b" : "#2a2a2a" }}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform duration-150 ${
                    autoSuggest ? "translate-x-5" : "translate-x-0"
                  }`}
                  style={{ background: autoSuggest ? "#0a0a0a" : "#71717a" }}
                />
              </span>
              <span className="text-sm" style={{ color: autoSuggest ? "#f5f5f5" : "#71717a" }}>
                Let CEO suggest the pipeline
              </span>
            </button>
            {autoSuggest && (
              <p className="text-xs mt-2 leading-relaxed" style={{ color: "#71717a" }}>
                CEO will select the best agents for this task — and Atlas will create any
                that are missing. You&apos;ll review and approve before anything runs.
              </p>
            )}
          </div>

          {/* Agents (manual mode only) */}
          {!autoSuggest && (
          <div>
            <label className="text-xs font-medium block mb-2" style={{ color: "#71717a" }}>
              Agents (in run order)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {agents.length === 0 && (
                <p className="col-span-4 text-xs" style={{ color: "#3f3f46" }}>
                  No agents yet — create one first.
                </p>
              )}
              {agents.map((agent) => {
                const idx = selectedAgents.indexOf(agent.id);
                const selected = idx !== -1;
                return (
                  <button
                    key={agent.id}
                    onClick={() => toggleAgent(agent.id)}
                    className="relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-center transition-all duration-150"
                    style={{
                      background: selected ? `${agent.avatar_color}15` : "#0d0d0d",
                      borderColor: selected ? agent.avatar_color : "#1f1f1f",
                    }}
                  >
                    {selected && (
                      <span
                        className="absolute top-1 right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                        style={{ background: agent.avatar_color, color: "#fff" }}
                      >
                        {idx + 1}
                      </span>
                    )}
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: agent.avatar_color, color: "#fff" }}
                    >
                      {agent.name[0]}
                    </div>
                    <div className="text-[10px] leading-tight" style={{ color: selected ? "#f5f5f5" : "#71717a" }}>
                      <div className="font-medium">{agent.name}</div>
                      <div className="opacity-70">{agent.role}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          )}

          {/* Workspace */}
          <div>
            <label className="text-xs font-medium block mb-2" style={{ color: "#71717a" }}>Workspace</label>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setWorkspaceMode("new")}
                className="flex-1 py-2 rounded-lg text-xs font-medium border transition-all duration-150"
                style={{
                  color: workspaceMode === "new" ? "#f59e0b" : "#71717a",
                  borderColor: workspaceMode === "new" ? "#f59e0b" : "#1f1f1f",
                  background: workspaceMode === "new" ? "#2a1a00" : "#0d0d0d",
                }}
              >
                New project
              </button>
              <button
                onClick={() => setWorkspaceMode("existing")}
                className="flex-1 py-2 rounded-lg text-xs font-medium border transition-all duration-150"
                style={{
                  color: workspaceMode === "existing" ? "#f59e0b" : "#71717a",
                  borderColor: workspaceMode === "existing" ? "#f59e0b" : "#1f1f1f",
                  background: workspaceMode === "existing" ? "#2a1a00" : "#0d0d0d",
                }}
              >
                Existing folder
              </button>
            </div>
            {workspaceMode === "new" ? (
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: "#71717a" }}>
                  Workspace folder name
                </label>
                <input
                  value={folderName}
                  onChange={(e) => handleFolderNameChange(e.target.value)}
                  placeholder="pipeline-folder-name"
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none border transition-colors duration-150"
                  style={{ background: "#0d0d0d", borderColor: "#1f1f1f", color: "#f5f5f5" }}
                  onFocus={(e) => (e.target.style.borderColor = "#f59e0b")}
                  onBlur={(e) => (e.target.style.borderColor = "#1f1f1f")}
                />
                <p className="text-xs mt-1.5" style={{ color: "#3f3f46" }}>
                  ~/forge-workspace/{folderName.trim() || "[folder-name]"}/
                </p>
              </div>
            ) : (
              <div>
                <div className="flex gap-2">
                  <input
                    value={existingPath}
                    onChange={(e) => setExistingPath(e.target.value)}
                    placeholder="/Users/username/my-existing-project"
                    className="flex-1 min-w-0 px-3 py-2.5 rounded-lg text-sm outline-none border transition-colors duration-150"
                    style={{ background: "#0d0d0d", borderColor: "#1f1f1f", color: "#f5f5f5" }}
                    onFocus={(e) => (e.target.style.borderColor = "#f59e0b")}
                    onBlur={(e) => (e.target.style.borderColor = "#1f1f1f")}
                  />
                  <button
                    type="button"
                    onClick={handleBrowse}
                    className="px-3 py-2.5 rounded-lg text-xs font-medium border transition-colors duration-150 shrink-0"
                    style={{ background: "#1f1f1f", color: "#f5f5f5", borderColor: "#1f1f1f" }}
                  >
                    Browse…
                  </button>
                </div>
                <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "#3f3f46" }}>
                  Select any file inside your project folder — Forge will use the containing directory.
                </p>
              </div>
            )}
          </div>
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
            onClick={handleCreate}
            disabled={!canSubmit || submitting}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-150"
            style={{
              background: canSubmit && !submitting ? "#f59e0b" : "#2a2a2a",
              color: canSubmit && !submitting ? "#0a0a0a" : "#3f3f46",
            }}
          >
            {submitting ? "Creating…" : "Create Pipeline"}
          </button>
        </div>
      </div>
    </div>
  );
}
