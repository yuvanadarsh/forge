"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import AgentStatCards from "@/components/AgentStatCards";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import Toast from "@/components/Toast";
import TokenUsageGraph from "@/components/TokenUsageGraph";
import { ApiError, getAgent, listAgentRuns, listConversations, updateAgent } from "@/lib/api";
import { useForge } from "@/lib/store";
import type { AgentRun, BackendAgentDetail, BackendConversation } from "@/types";

function timeAgo(iso: string | null) {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const RING_COLORS: Record<string, [string, string]> = {
  "#6366f1": ["#6366f1", "#8b5cf6"],
  "#f59e0b": ["#f59e0b", "#ef4444"],
  "#3b82f6": ["#3b82f6", "#06b6d4"],
  "#22c55e": ["#22c55e", "#10b981"],
  "#ec4899": ["#ec4899", "#f43f5e"],
  "#f97316": ["#f97316", "#eab308"],
};

const RUN_STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  completed: { label: "Success", color: "#22c55e", bg: "#0a1a0a" },
  failed: { label: "Error", color: "#ef4444", bg: "#1a0a0a" },
  running: { label: "Running", color: "#f59e0b", bg: "#1a140a" },
  paused_for_approval: { label: "Paused", color: "#f59e0b", bg: "#1a140a" },
  approved: { label: "Resuming", color: "#f59e0b", bg: "#1a140a" },
  cancelled: { label: "Cancelled", color: "#71717a", bg: "#161616" },
};

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { state, dispatch } = useForge();

  const [agent, setAgent] = useState<BackendAgentDetail | null>(null);
  const [fetchState, setFetchState] = useState<"loading" | "ready" | "notfound" | "error">(
    "loading",
  );
  const [conversations, setConversations] = useState<BackendConversation[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);

  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptDraft, setPromptDraft] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [runHistoryOpen, setRunHistoryOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFetchState("loading");
    getAgent(id)
      .then((detail) => {
        if (cancelled) return;
        setAgent(detail);
        setFetchState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setFetchState(err instanceof ApiError && err.status === 404 ? "notfound" : "error");
      });
    // Secondary sections load independently; their failure isn't fatal.
    listConversations({ agent_id: id })
      .then((convos) => {
        if (!cancelled) setConversations(convos);
      })
      .catch(() => {});
    listAgentRuns(id)
      .then((history) => {
        if (!cancelled) setRuns(history);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (fetchState === "notfound") notFound();

  if (fetchState === "loading") {
    return (
      <div className="px-8 py-8 max-w-[900px] mx-auto space-y-4">
        <LoadingSkeleton variant="card" count={1} />
        <LoadingSkeleton variant="text" count={2} />
        <LoadingSkeleton variant="row" count={3} />
      </div>
    );
  }

  if (fetchState === "error" || agent === null) {
    return (
      <div className="px-8 py-8 max-w-[900px] mx-auto">
        <div
          className="rounded-xl border flex flex-col items-center py-16 text-center"
          style={{ background: "#111111", borderColor: "#1f1f1f" }}
        >
          <div className="text-sm font-medium" style={{ color: "#ef4444" }}>
            Failed to load agent
          </div>
          <div className="text-xs mt-1" style={{ color: "#71717a" }}>
            Check that the backend is running, then try again.
          </div>
        </div>
      </div>
    );
  }

  const taskConvos = conversations.filter((c) => c.task_id !== null);
  const getTask = (taskId: string | null) => state.tasks.find((t) => t.id === taskId);

  const statusColor =
    { idle: "#71717a", working: "#22c55e", error: "#ef4444" }[agent.status] ?? "#71717a";
  const statusLabel = { idle: "Idle", working: "Working", error: "Error" }[agent.status] ?? agent.status;

  const pair = RING_COLORS[agent.avatar_color] ?? [agent.avatar_color, agent.avatar_color];
  const gradient = `linear-gradient(to right, ${pair[0]}, ${pair[1]})`;

  function startEdit() {
    if (agent) {
      setPromptDraft(agent.system_prompt);
      setEditingPrompt(true);
    }
  }

  async function savePrompt() {
    if (!agent) return;
    const previous = agent.system_prompt;
    const draft = promptDraft;
    // Optimistic: reflect the edit immediately, revert if the PATCH fails.
    setAgent((prev) => (prev ? { ...prev, system_prompt: draft } : prev));
    setEditingPrompt(false);
    setSaveState("saving");
    try {
      const updated = await updateAgent(id, { system_prompt: draft });
      dispatch({ type: "UPDATE_AGENT", agent: updated });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch (err) {
      setAgent((prev) => (prev ? { ...prev, system_prompt: previous } : prev));
      setSaveState("idle");
      setToast(
        `Failed to save prompt: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    }
  }

  return (
    <div className="px-8 py-8 max-w-[900px] mx-auto">
      <Link
        href="/agents"
        className="text-xs flex items-center gap-1 mb-6 transition-colors duration-150"
        style={{ color: "#71717a" }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#f5f5f5")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#71717a")}
      >
        ← Back to Agents
      </Link>

      {/* Agent header */}
      <div className="rounded-xl overflow-hidden mb-8" style={{ padding: "1px", background: gradient }}>
        <div className="rounded-xl p-6 flex items-start gap-5" style={{ background: "#111111" }}>
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold shrink-0"
            style={{ background: agent.avatar_color, color: "#fff" }}
          >
            {agent.name[0]}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold" style={{ color: "#f5f5f5" }}>{agent.name}</h1>
              <span
                className="text-xs px-2 py-1 rounded-full font-medium border"
                style={{ color: statusColor, borderColor: statusColor, background: `${statusColor}15` }}
              >
                {statusLabel}
              </span>
            </div>
            <p className="text-sm mt-0.5" style={{ color: "#71717a" }}>{agent.role} · {agent.specialty}</p>
            <div className="flex items-center gap-4 mt-3 text-xs" style={{ color: "#71717a" }}>
              <span className="px-2 py-1 rounded-lg" style={{ background: "#1a1a1a" }}>{agent.model}</span>
              <span>{(agent.tokens_used / 1000).toFixed(0)}k tokens</span>
              <span>${agent.cost_usd.toFixed(2)} spent</span>
              <span>Active {timeAgo(agent.last_active)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* System Prompt */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#71717a" }}>
            System Prompt
          </h2>
          {!editingPrompt ? (
            <button
              onClick={startEdit}
              disabled={saveState === "saving"}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors duration-150"
              style={{
                background: "#1f1f1f",
                color: saveState === "saved" ? "#22c55e" : "#71717a",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#f5f5f5"; }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color =
                  saveState === "saved" ? "#22c55e" : "#71717a";
              }}
            >
              {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : "Edit"}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setEditingPrompt(false)}
                className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors duration-150"
                style={{ background: "#1f1f1f", color: "#71717a" }}
              >
                Cancel
              </button>
              <button
                onClick={savePrompt}
                className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors duration-150"
                style={{ background: "#f59e0b", color: "#0a0a0a" }}
              >
                Save
              </button>
            </div>
          )}
        </div>
        {editingPrompt ? (
          <textarea
            value={promptDraft}
            onChange={(e) => setPromptDraft(e.target.value)}
            rows={8}
            className="w-full px-4 py-3 rounded-xl text-sm leading-relaxed outline-none border resize-none transition-colors duration-150"
            style={{ background: "#111111", borderColor: "#f59e0b", color: "#f5f5f5" }}
          />
        ) : (
          <div
            className="p-4 rounded-xl border text-sm leading-relaxed"
            style={{ background: "#111111", borderColor: "#1f1f1f", color: "#a1a1aa" }}
          >
            {agent.system_prompt || <span style={{ color: "#3f3f46" }}>No system prompt set.</span>}
          </div>
        )}
      </section>

      {/* Token Usage Graph */}
      <section className="mb-8">
        <AgentStatCards usage={agent.usage} />
        <TokenUsageGraph agentId={id} accentColor={pair[0]} />
      </section>

      {/* Task Conversations */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#71717a" }}>
            Task Conversations
          </h2>
          <Link
            href={`/agents/${id}/conversations/new`}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors duration-150"
            style={{ background: "#1f1f1f", color: "#f59e0b" }}
          >
            + General Chat
          </Link>
        </div>

        {taskConvos.length === 0 && (
          <p className="text-sm" style={{ color: "#71717a" }}>No task conversations yet.</p>
        )}

        <div className="flex flex-col gap-2">
          {taskConvos.map((conv) => {
            const task = getTask(conv.task_id);
            return (
              <Link
                key={conv.id}
                href={`/agents/${id}/conversations/${conv.id}`}
                className="flex items-start justify-between gap-4 p-4 rounded-xl border transition-colors duration-150 hover:border-[#2a2a2a]"
                style={{ background: "#111111", borderColor: "#1f1f1f" }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium mb-1" style={{ color: "#f5f5f5" }}>
                    {conv.title}
                  </div>
                  {task && (
                    <div className="text-xs mb-1" style={{ color: "#f59e0b" }}>
                      Task: {task.title}
                    </div>
                  )}
                  {conv.last_message && (
                    <div className="text-xs truncate" style={{ color: "#71717a" }}>
                      {conv.last_message}
                    </div>
                  )}
                </div>
                <div className="text-xs shrink-0 mt-0.5" style={{ color: "#3f3f46" }}>
                  {timeAgo(conv.last_active)}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Run History */}
      <section className="mb-8">
        <button
          onClick={() => setRunHistoryOpen((v) => !v)}
          className="flex items-center justify-between w-full mb-4 group"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "#71717a" }}>
            Run History
          </h2>
          <span className="text-xs transition-colors duration-150" style={{ color: "#3f3f46" }}>
            {runHistoryOpen ? "▲ Collapse" : "▼ Expand"}
          </span>
        </button>

        {runHistoryOpen && runs.length === 0 && (
          <p className="text-sm" style={{ color: "#71717a" }}>No pipeline runs yet.</p>
        )}

        {runHistoryOpen && (
          <div className="flex flex-col gap-1">
            {runs.map((run) => {
              const style = RUN_STATUS_STYLES[run.status] ?? {
                label: run.status,
                color: "#71717a",
                bg: "#161616",
              };
              const isError = run.status === "failed";
              return (
                <div
                  key={run.id}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl border transition-colors duration-150 cursor-pointer"
                  style={{
                    background: "#111111",
                    borderColor: "#1f1f1f",
                    borderLeft: isError ? "3px solid #ef4444" : "3px solid transparent",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = isError ? "#ef4444" : "#2a2a2a")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = isError ? "#ef4444" : "#1f1f1f")}
                >
                  <div className="text-[10px] shrink-0" style={{ color: "#52525b", width: "80px" }}>
                    {new Date(run.started_at).toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
                    {new Date(run.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="flex-1 text-xs truncate" style={{ color: "#a1a1aa" }}>
                    {run.pipeline_title}
                  </div>
                  <div className="text-[10px] shrink-0" style={{ color: "#52525b" }}>
                    {(run.tokens / 1000).toFixed(1)}k tok
                  </div>
                  <div className="text-[10px] shrink-0" style={{ color: "#52525b" }}>
                    ${run.cost_usd.toFixed(2)}
                  </div>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0"
                    style={{ color: style.color, background: style.bg }}
                  >
                    {style.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
