"use client";

import { useEffect, useRef, useState } from "react";
import { createPipeline } from "@/lib/api";
import { useForge } from "@/lib/store";
import WorkspaceBrowserModal from "@/components/WorkspaceBrowserModal";
import type { BackendPipeline } from "@/types";

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

type ExecutionModeChoice = "default" | "full_auto" | "supervised" | "strict";

const EXECUTION_MODE_OPTIONS: { value: ExecutionModeChoice; label: string; description: string }[] = [
  {
    value: "default",
    label: "Use global settings (default)",
    description: "Follows your Security & Execution settings — the same behavior every pipeline had before.",
  },
  {
    value: "full_auto",
    label: "Full Auto",
    description: "Runs start to finish without interruption after you approve it. Best for well-defined, trusted tasks.",
  },
  {
    value: "supervised",
    label: "Supervised",
    description: "Pauses between each agent for your review before the next one starts.",
  },
  {
    value: "strict",
    label: "Strict",
    description: "Requires approval for every file and command an agent runs. Slowest, most controlled.",
  },
];

export interface ContinueFrom {
  /** workspace_path of the completed pipeline being continued. */
  workspacePath: string;
  /** Title of that pipeline — shown in the "Continuing from" note. */
  fromTitle: string;
}

interface Props {
  onClose: () => void;
  /** Called with the persisted pipeline after a successful POST. */
  onCreate: (pipeline: BackendPipeline) => void;
  /** Called with the API error message; the modal stays open. */
  onError?: (message: string) => void;
  /** Pre-fills the workspace from a previous pipeline ("continue this project"). */
  continueFrom?: ContinueFrom;
}

export default function CreatePipelineModal({ onClose, onCreate, onError, continueFrom }: Props) {
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
  const [workspaceMode, setWorkspaceMode] = useState<"new" | "existing">(
    continueFrom ? "existing" : "new",
  );
  const [existingPath, setExistingPath] = useState(continueFrom?.workspacePath ?? "");
  const [folderName, setFolderName] = useState("");
  const [folderNameEdited, setFolderNameEdited] = useState(false);
  const [executionMode, setExecutionMode] = useState<ExecutionModeChoice>("default");
  const [submitting, setSubmitting] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!folderNameEdited) setFolderName(slugify(value));
  }

  function handleFolderNameChange(value: string) {
    setFolderNameEdited(true);
    setFolderName(value);
  }

  // The native <input type="file" webkitdirectory> picker only ever
  // returns a path on the browser's HOST machine — it has no way to know
  // the backend container's mount point, so it's structurally incapable
  // of returning a path the backend can use. WorkspaceBrowserModal lists
  // directories from inside the container instead, so every path it
  // returns is already correct.
  function handleBrowse() {
    setBrowserOpen(true);
  }

  const agents = state.agents;
  // Auto-plan defaults on whenever any workable (non-eternal) agent exists —
  // the backend falls back to the best available planner, no CEO required.
  const [autoSuggest, setAutoSuggest] = useState(
    () => state.agents.some((a) => !a.is_eternal),
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
        execution_mode: executionMode === "default" ? undefined : executionMode,
      });
      onCreate(pipeline);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Failed to create pipeline");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
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
              ref={titleRef}
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
                Auto-plan with Forge
              </span>
            </button>
            {autoSuggest && (
              <p className="text-xs mt-2 leading-relaxed" style={{ color: "#71717a" }}>
                Forge will analyze your available agents and build the best pipeline for
                this task — creating any missing specialists automatically. You&apos;ll
                review and approve before anything runs.
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
                    placeholder="/root/forge-workspace/my-existing-project"
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
                  Browse lists folders from inside the backend container, so the path it picks is always one your agents can actually read.
                </p>
              </div>
            )}
            {continueFrom && workspaceMode === "existing" && (
              <p className="text-xs mt-2 leading-relaxed" style={{ color: "#a1793a" }}>
                Continuing from: <span style={{ color: "#f59e0b" }}>{continueFrom.fromTitle}</span> —
                agents will see all existing files in this workspace.
              </p>
            )}
          </div>

          {/* Execution Mode */}
          <div>
            <label className="text-xs font-medium block mb-2" style={{ color: "#71717a" }}>
              Execution Mode
            </label>
            <div className="space-y-1.5">
              {EXECUTION_MODE_OPTIONS.map((option) => {
                const selected = executionMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setExecutionMode(option.value)}
                    className="flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors duration-150"
                    style={{
                      background: selected ? "#2a1a00" : "#0d0d0d",
                      borderColor: selected ? "#f59e0b" : "#1f1f1f",
                    }}
                  >
                    <span
                      className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border"
                      style={{ borderColor: selected ? "#f59e0b" : "#3f3f46" }}
                    >
                      {selected && <span className="h-2 w-2 rounded-full" style={{ background: "#f59e0b" }} />}
                    </span>
                    <span>
                      <span className="block text-sm" style={{ color: selected ? "#f5f5f5" : "#71717a" }}>
                        {option.label}
                      </span>
                      {selected && (
                        <span className="mt-0.5 block text-xs leading-relaxed" style={{ color: "#71717a" }}>
                          {option.description}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
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
    {browserOpen && (
      <WorkspaceBrowserModal
        onClose={() => setBrowserOpen(false)}
        onSelect={(path) => {
          setExistingPath(path);
          setBrowserOpen(false);
        }}
      />
    )}
    </>
  );
}
