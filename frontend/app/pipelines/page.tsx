"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ConfirmDialog";
import CreatePipelineModal from "@/components/CreatePipelineModal";
import EmptyState from "@/components/EmptyState";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import Toast from "@/components/Toast";
import {
  ApiError,
  approvePipeline,
  archivePipeline,
  deletePipeline,
  getPipeline,
  listAgents,
  restorePipeline,
} from "@/lib/api";
import { useForge } from "@/lib/store";
import type { BackendAgent, BackendPipeline } from "@/types";

const STATUS_STYLES: Record<BackendPipeline["status"], { label: string; color: string; bg: string }> = {
  pending_approval: { label: "Pending Approval", color: "#f59e0b", bg: "#2a1a00" },
  approved: { label: "Approved", color: "#3b82f6", bg: "#0a1a2a" },
  running: { label: "Running", color: "#22c55e", bg: "#0a1a0a" },
  paused_for_approval: { label: "Paused — Approval", color: "#f59e0b", bg: "#2a1a00" },
  completed: { label: "Completed", color: "#71717a", bg: "#1a1a1a" },
  failed: { label: "Failed", color: "#ef4444", bg: "#1a0a0a" },
  archived: { label: "Archived", color: "#71717a", bg: "#1a1a1a" },
};

// Statuses where destructive actions are blocked ("stop the pipeline first").
const ACTIVE_STATUSES: BackendPipeline["status"][] = ["running", "paused_for_approval", "approved"];

function MarkdownBlock({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="text-sm leading-relaxed space-y-1" style={{ color: "#a1a1aa" }}>
      {lines.map((line, i) => {
        if (line.startsWith("# ")) return <h1 key={i} className="text-base font-bold mt-4 mb-2" style={{ color: "#f5f5f5" }}>{line.slice(2)}</h1>;
        if (line.startsWith("## ")) return <h2 key={i} className="text-sm font-semibold mt-3 mb-1" style={{ color: "#f5f5f5" }}>{line.slice(3)}</h2>;
        if (line.startsWith("- [ ] ")) return <div key={i} className="flex items-start gap-2 py-0.5"><span className="mt-0.5 w-3.5 h-3.5 rounded border shrink-0" style={{ borderColor: "#3f3f46" }} /><span>{line.slice(6)}</span></div>;
        if (line.startsWith("- ")) return <div key={i} className="flex items-start gap-2 py-0.5"><span className="mt-2 w-1 h-1 rounded-full shrink-0" style={{ background: "#71717a" }} /><span>{line.slice(2)}</span></div>;
        if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-semibold" style={{ color: "#ef4444" }}>{line.slice(2, -2)}</p>;
        if (line === "") return <div key={i} className="h-1" />;
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

interface PipelineCardProps {
  pipeline: BackendPipeline;
  agents: BackendAgent[];
  isOpen: boolean;
  generating: boolean;
  approving: boolean;
  onToggleExpand: () => void;
  onApprove: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onRestore: () => void;
  onToast: (message: string) => void;
}

function PipelineCard({
  pipeline,
  agents,
  isOpen,
  generating,
  approving,
  onToggleExpand,
  onApprove,
  onArchive,
  onDelete,
  onRestore,
  onToast,
}: PipelineCardProps) {
  const s = STATUS_STYLES[pipeline.status] ?? STATUS_STYLES.completed;
  const isActive = ACTIVE_STATUSES.includes(pipeline.status);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [menuOpen]);

  const pipelineAgents = pipeline.agent_sequence
    .map((aid) => agents.find((a) => a.id === aid))
    .filter(Boolean);

  const blockedTitle = "Stop the pipeline first";
  const menuItem = "w-full text-left px-3 py-2 text-xs transition-colors duration-150";

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: "#111111", borderColor: "#1f1f1f" }}
    >
      {/* Header */}
      <div className="flex items-start gap-4 p-5">
        <button onClick={onToggleExpand} className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-base font-semibold" style={{ color: "#f5f5f5" }}>
              {pipeline.title}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ color: s.color, background: s.bg }}
            >
              {s.label}
            </span>
          </div>
          <p className="text-sm mb-2" style={{ color: "#71717a" }}>{pipeline.description}</p>
          <p className="text-xs mb-3 font-mono truncate" style={{ color: "#3f3f46" }}>
            {pipeline.workspace_path}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {generating && pipeline.agent_sequence.length === 0 ? (
              <span className="text-xs animate-pulse" style={{ color: "#f59e0b" }}>
                CEO is choosing agents…
              </span>
            ) : (
              pipelineAgents.map((agent, idx) => {
                if (!agent) return null;
                return (
                  <div key={agent.id} className="flex items-center gap-1">
                    <span
                      className="w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center"
                      style={{ background: agent.avatar_color, color: "#fff" }}
                    >
                      {agent.name[0]}
                    </span>
                    <span className="text-xs" style={{ color: "#71717a" }}>{agent.name}</span>
                    {idx < pipelineAgents.length - 1 && (
                      <span className="text-xs mx-0.5" style={{ color: "#3f3f46" }}>→</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </button>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          <Link
            href={`/pipelines/${pipeline.id}/chat`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors duration-150"
            style={{ background: "#1f1f1f", color: "#f59e0b" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#2a1a00"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#1f1f1f"; }}
          >
            Open Pipeline Chat →
          </Link>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            onClick={onToggleExpand}
            className="cursor-pointer transition-transform duration-150"
            style={{ color: "#71717a", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="w-6 h-6 rounded-md flex items-center justify-center text-xs transition-colors duration-150"
              style={{ background: "#1a1a1a", color: "#f5f5f5" }}
              aria-label="Pipeline options"
            >
              ⋯
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 mt-1 w-44 rounded-lg border py-1 z-30"
                style={{ background: "#161616", borderColor: "#1f1f1f" }}
              >
                <Link
                  href={`/pipelines/${pipeline.id}/chat`}
                  onClick={() => setMenuOpen(false)}
                  className={`block ${menuItem} hover:bg-[#1f1f1f]`}
                  style={{ color: "#f5f5f5" }}
                >
                  Open Pipeline Chat
                </Link>
                {pipeline.status === "archived" ? (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onRestore();
                    }}
                    className={`${menuItem} hover:bg-[#1f1f1f]`}
                    style={{ color: "#f5f5f5" }}
                  >
                    Restore
                  </button>
                ) : (
                  <button
                    disabled={isActive}
                    title={isActive ? blockedTitle : undefined}
                    onClick={() => {
                      setMenuOpen(false);
                      if (isActive) return;
                      onArchive();
                    }}
                    className={`${menuItem} ${isActive ? "cursor-not-allowed" : "hover:bg-[#1f1f1f]"}`}
                    style={{ color: isActive ? "#3f3f46" : "#f5f5f5" }}
                  >
                    Archive
                  </button>
                )}
                <button
                  disabled={isActive}
                  title={isActive ? blockedTitle : undefined}
                  onClick={() => {
                    setMenuOpen(false);
                    if (isActive) return;
                    setConfirmingDelete(true);
                  }}
                  className={`${menuItem} ${isActive ? "cursor-not-allowed" : "hover:bg-[#1f1f1f]"}`}
                  style={{ color: isActive ? "#3f3f46" : "#ef4444" }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expanded plan */}
      {isOpen && (
        <div className="border-t px-5 py-5" style={{ borderColor: "#1f1f1f" }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "#71717a" }}>
            Execution Plan
          </h3>
          {generating ? (
            <div className="flex items-center gap-2.5 text-sm animate-pulse py-2" style={{ color: "#f59e0b" }}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "#f59e0b" }} />
              {pipeline.agent_sequence.length === 0
                ? "CEO is choosing agents and drafting the plan…"
                : "Generating execution plan…"}
            </div>
          ) : (
            <>
              {pipeline.suggestion_reasoning && (
                <details className="mb-5">
                  <summary
                    className="text-xs font-semibold uppercase tracking-wider cursor-pointer select-none"
                    style={{ color: "#f59e0b" }}
                  >
                    CEO&apos;s Reasoning
                  </summary>
                  <p
                    className="text-sm mt-2 leading-relaxed whitespace-pre-wrap"
                    style={{ color: "#a1a1aa" }}
                  >
                    {pipeline.suggestion_reasoning}
                  </p>
                </details>
              )}
              <MarkdownBlock content={pipeline.plan_md || "*No execution plan provided.*"} />
            </>
          )}
          {pipeline.status === "pending_approval" && (() => {
            const planNotReady =
              generating || !pipeline.plan_md.trim() || pipeline.agent_sequence.length === 0;
            return (
            <div className="mt-6 flex gap-3">
              <button
                onClick={onApprove}
                disabled={approving || planNotReady}
                title={planNotReady ? "Waiting for execution plan…" : undefined}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-150"
                style={{
                  background: approving || planNotReady ? "#1f1f1f" : "#22c55e",
                  color: approving || planNotReady ? "#71717a" : "#0a0a0a",
                  cursor: planNotReady ? "not-allowed" : undefined,
                }}
              >
                {approving ? "Starting…" : "Approve Pipeline"}
              </button>
              <button
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150"
                style={{ background: "#1f1f1f", color: "#71717a" }}
                onClick={() => onToast("Edit the plan via the pipeline chat before approving.")}
              >
                Request Changes
              </button>
            </div>
            );
          })()}
        </div>
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title={`Delete "${pipeline.title}"?`}
          message="Delete this pipeline and all its history? This cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => {
            setConfirmingDelete(false);
            onDelete();
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}

export default function PipelinesPage() {
  const router = useRouter();
  const { state, dispatch } = useForge();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const { pipelines, agents, loading } = state;
  const activePipelines = pipelines.filter((p) => p.status !== "archived");
  const archivedPipelines = pipelines.filter((p) => p.status === "archived");

  // Pipelines whose execution plan the CEO is still drafting: poll every 3s
  // until plan_md lands (the backend always terminates in a non-empty plan).
  const [pendingPlanIds, setPendingPlanIds] = useState<string[]>([]);

  useEffect(() => {
    if (pendingPlanIds.length === 0) return;
    const interval = setInterval(() => {
      for (const pipelineId of pendingPlanIds) {
        getPipeline(pipelineId)
          .then((detail) => {
            if (detail.plan_md) {
              dispatch({ type: "UPDATE_PIPELINE", pipeline: detail });
              setPendingPlanIds((prev) => prev.filter((id) => id !== pipelineId));
              setToast("Execution plan ready for review");
              // Auto-suggest may have had Atlas create new agents — refresh
              // the roster so the sequence chips can render them.
              listAgents()
                .then((refreshed) => dispatch({ type: "SET_AGENTS", agents: refreshed }))
                .catch(() => {});
            }
          })
          .catch((err) => {
            // Stop polling only if the pipeline is gone; transient network
            // failures retry on the next tick.
            if (err instanceof ApiError && err.status === 404) {
              setPendingPlanIds((prev) => prev.filter((id) => id !== pipelineId));
            }
          });
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [pendingPlanIds, dispatch]);

  function handleCreated(pipeline: BackendPipeline) {
    dispatch({ type: "ADD_PIPELINE", pipeline });
    setShowCreateModal(false);
    setToast(`Pipeline "${pipeline.title}" created`);
    if (!pipeline.plan_md) {
      setPendingPlanIds((prev) => [...prev, pipeline.id]);
      setExpanded(pipeline.id); // surface the generating state right away
    }
  }

  async function handleApprove(pipeline: BackendPipeline) {
    if (approving) return;
    setApproving(pipeline.id);
    try {
      await approvePipeline(pipeline.id);
      dispatch({
        type: "UPDATE_PIPELINE",
        pipeline: { ...pipeline, status: "running" as const },
      });
      router.push(`/pipelines/${pipeline.id}/chat`);
    } catch (err) {
      setToast(
        `Could not approve pipeline: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    } finally {
      setApproving(null);
    }
  }

  async function handleArchive(pipeline: BackendPipeline) {
    try {
      const updated = await archivePipeline(pipeline.id);
      dispatch({ type: "ARCHIVE_PIPELINE", pipeline: updated });
      setToast(`Pipeline "${pipeline.title}" archived`);
    } catch (err) {
      setToast(`Could not archive: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  async function handleRestore(pipeline: BackendPipeline) {
    try {
      const updated = await restorePipeline(pipeline.id);
      dispatch({ type: "UPDATE_PIPELINE", pipeline: updated });
      setToast(`Pipeline "${pipeline.title}" restored`);
    } catch (err) {
      setToast(`Could not restore: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  async function handleDelete(pipeline: BackendPipeline) {
    try {
      await deletePipeline(pipeline.id);
      dispatch({ type: "DELETE_PIPELINE", pipelineId: pipeline.id });
      setPendingPlanIds((prev) => prev.filter((id) => id !== pipeline.id));
      setToast(`Pipeline "${pipeline.title}" deleted`);
    } catch (err) {
      setToast(`Could not delete: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  const renderCard = (pipeline: BackendPipeline) => (
    <PipelineCard
      key={pipeline.id}
      pipeline={pipeline}
      agents={agents}
      isOpen={expanded === pipeline.id}
      generating={pendingPlanIds.includes(pipeline.id)}
      approving={approving === pipeline.id}
      onToggleExpand={() => setExpanded(expanded === pipeline.id ? null : pipeline.id)}
      onApprove={() => handleApprove(pipeline)}
      onArchive={() => handleArchive(pipeline)}
      onDelete={() => handleDelete(pipeline)}
      onRestore={() => handleRestore(pipeline)}
      onToast={setToast}
    />
  );

  return (
    <div className="px-8 py-8 max-w-[900px] mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#f5f5f5" }}>Pipelines</h1>
          <p className="text-sm mt-1" style={{ color: "#71717a" }}>
            {loading.pipelines
              ? "Loading pipelines…"
              : `${activePipelines.length} pipelines · ${activePipelines.filter((p) => p.status === "running").length} running`}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-150"
          style={{ background: "#f59e0b", color: "#0a0a0a" }}
          onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.background = "#d97706")}
          onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.background = "#f59e0b")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Create Pipeline
        </button>
      </div>

      {loading.pipelines ? (
        <div className="flex flex-col gap-4">
          <LoadingSkeleton variant="card" count={3} />
        </div>
      ) : (
        <>
          {activePipelines.length === 0 ? (
            <EmptyState
              icon="⚙️"
              title="No pipelines yet."
              description="Describe a project to get started — the CEO plans it, agents build it, you approve every step."
              action={{ label: "Create Pipeline", onClick: () => setShowCreateModal(true) }}
            />
          ) : (
            <div className="flex flex-col gap-4">{activePipelines.map(renderCard)}</div>
          )}

          {archivedPipelines.length > 0 && (
            <div className="mt-10">
              <button
                onClick={() => setShowArchived((v) => !v)}
                className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider transition-colors duration-150"
                style={{ color: "#71717a" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#f5f5f5")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#71717a")}
              >
                <span
                  className="transition-transform duration-150"
                  style={{ transform: showArchived ? "rotate(90deg)" : "rotate(0deg)" }}
                >
                  ▶
                </span>
                {showArchived ? "Hide" : "Show"} archived ({archivedPipelines.length})
              </button>
              {showArchived && (
                <div className="flex flex-col gap-4 mt-4 opacity-75">
                  {archivedPipelines.map(renderCard)}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showCreateModal && (
        <CreatePipelineModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreated}
          onError={(message) => setToast(`Could not create pipeline: ${message}`)}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
