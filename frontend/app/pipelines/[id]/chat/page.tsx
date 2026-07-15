"use client";

import { use, useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import PipelineChatMessage, { type PipelineChatMsg } from "@/components/PipelineChatMessage";
import ApprovalGateCard from "@/components/ApprovalGateCard";
import PipelineChatInput from "@/components/PipelineChatInput";
import PipelineParticipants from "@/components/PipelineParticipants";
import PipelineExecutionPlan from "@/components/PipelineExecutionPlan";
import Toast from "@/components/Toast";
import {
  ApiError,
  approveGate,
  approvePipeline,
  createConversation,
  createPipelineSocket,
  getPipeline,
  listConversations,
  listMessages,
  parsePipelineEvent,
  sendMessage,
} from "@/lib/api";
import { useForge } from "@/lib/store";
import type { BackendMessage, BackendPipelineDetail, PipelineRun } from "@/types";

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  pending_approval: { label: "Pending Approval", color: "#f59e0b", bg: "#2a1a00" },
  approved: { label: "Approved", color: "#3b82f6", bg: "#0a1a2a" },
  running: { label: "Running", color: "#22c55e", bg: "#0a1a0a" },
  paused_for_approval: { label: "Paused — Approval", color: "#f59e0b", bg: "#2a1a00" },
  completed: { label: "Completed", color: "#71717a", bg: "#1a1a1a" },
  failed: { label: "Failed", color: "#ef4444", bg: "#1a0a0a" },
  cancelled: { label: "Cancelled", color: "#71717a", bg: "#1a1a1a" },
};

const ACTIVE_RUN_STATUSES: PipelineRun["status"][] = ["running", "paused_for_approval", "approved"];

// Items produced by the live WebSocket this session (persisted history comes
// from the conversation; on 'complete' the DB copy replaces the live view).
type LiveItem =
  | { kind: "stream"; id: string; agentId: string | null; text: string }
  | { kind: "tool"; id: string; agentId: string | null; tool: string; args: Record<string, unknown>; result?: string }
  | { kind: "gate"; id: string; gateId: string; summary: string; status: "pending" | "approved" }
  | { kind: "note"; id: string; text: string; tone: "info" | "error" };

let liveIdCounter = 0;
const nextLiveId = () => `live-${++liveIdCounter}`;

export default function PipelineChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { state } = useForge();

  const [pipeline, setPipeline] = useState<BackendPipelineDetail | null>(null);
  const [fetchState, setFetchState] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<BackendMessage[]>([]);
  const [liveItems, setLiveItems] = useState<LiveItem[]>([]);
  const [run, setRun] = useState<PipelineRun | null>(null);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [input, setInput] = useState("");
  const [planCollapsed, setPlanCollapsed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const participants = (pipeline?.agent_sequence ?? [])
    .map((aid) => state.agents.find((a) => a.id === aid))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  const agentById = (agentId: string | null) =>
    agentId ? state.agents.find((a) => a.id === agentId) : undefined;

  const reloadMessages = useCallback(async (convId: string) => {
    try {
      const first = await listMessages(convId, 1);
      const lastPage = Math.max(1, Math.ceil(first.total / first.page_size));
      const page = lastPage === 1 ? first : await listMessages(convId, lastPage);
      setMessages(page.items);
    } catch {
      // non-fatal — live stream still renders
    }
  }, []);

  const connectSocket = useCallback(
    (runId: string) => {
      socketRef.current?.close();
      const socket = createPipelineSocket(runId);
      socketRef.current = socket;

      socket.onmessage = (frame: MessageEvent<string>) => {
        const event = parsePipelineEvent(frame.data);
        if (!event) return;
        switch (event.type) {
          case "token":
            setLiveItems((prev) => {
              const last = prev[prev.length - 1];
              if (last?.kind === "stream" && last.agentId === event.agent_id) {
                return [
                  ...prev.slice(0, -1),
                  { ...last, text: last.text + event.payload.token },
                ];
              }
              return [
                ...prev,
                { kind: "stream", id: nextLiveId(), agentId: event.agent_id, text: event.payload.token },
              ];
            });
            break;
          case "tool_call":
            setLiveItems((prev) => [
              ...prev,
              {
                kind: "tool",
                id: nextLiveId(),
                agentId: event.agent_id,
                tool: event.payload.tool,
                args: event.payload.args,
              },
            ]);
            break;
          case "tool_result":
            setLiveItems((prev) => {
              const idx = [...prev].reverse().findIndex((it) => it.kind === "tool" && it.result === undefined);
              if (idx === -1) return prev;
              const realIdx = prev.length - 1 - idx;
              const item = prev[realIdx] as Extract<LiveItem, { kind: "tool" }>;
              return [
                ...prev.slice(0, realIdx),
                { ...item, result: event.payload.result },
                ...prev.slice(realIdx + 1),
              ];
            });
            break;
          case "status":
            setLiveStatus(event.payload.status);
            break;
          case "gate":
            setLiveStatus("paused_for_approval");
            setLiveItems((prev) => [
              ...prev,
              {
                kind: "gate",
                id: nextLiveId(),
                gateId: event.payload.gate_id,
                summary: event.payload.summary,
                status: "pending",
              },
            ]);
            break;
          case "complete":
            setLiveStatus("completed");
            setLiveItems([{ kind: "note", id: nextLiveId(), text: "Pipeline run completed ✓", tone: "info" }]);
            socket.close();
            // The executor persisted everything — swap live view for DB truth.
            setConversationId((convId) => {
              if (convId) void reloadMessages(convId);
              return convId;
            });
            break;
          case "error":
            setLiveStatus("failed");
            setLiveItems((prev) => [
              ...prev,
              { kind: "note", id: nextLiveId(), text: `Pipeline error: ${event.payload.error}`, tone: "error" },
            ]);
            socket.close();
            break;
        }
      };
    },
    [reloadMessages],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const detail = await getPipeline(id);
        if (cancelled) return;
        setPipeline(detail);
        setFetchState("ready");
        if (detail.current_run && ACTIVE_RUN_STATUSES.includes(detail.current_run.status)) {
          setRun(detail.current_run);
          setLiveStatus(detail.current_run.status);
          connectSocket(detail.current_run.id);
        }
        const convos = await listConversations({ pipeline_id: id });
        if (cancelled) return;
        // Mirror the orchestrator: it writes into the OLDEST pipeline conversation.
        const oldest = [...convos].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        )[0];
        if (oldest) {
          setConversationId(oldest.id);
          await reloadMessages(oldest.id);
        }
      } catch (err) {
        if (cancelled) return;
        setFetchState(err instanceof ApiError && err.status === 404 ? "notfound" : "error");
      }
    })();
    return () => {
      cancelled = true;
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [id, connectSocket, reloadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, liveItems]);

  async function handleApproveAndStart() {
    if (!pipeline || approving) return;
    setApproving(true);
    try {
      const newRun = await approvePipeline(pipeline.id);
      setRun(newRun);
      setLiveStatus(newRun.status);
      setLiveItems([]);
      connectSocket(newRun.id);
      setToast("Pipeline started");
    } catch (err) {
      setToast(`Could not start: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setApproving(false);
    }
  }

  async function handleApproveGate(): Promise<boolean> {
    if (!pipeline || !run) return false;
    try {
      const updated = await approveGate(pipeline.id, run.id);
      setRun(updated);
      setLiveStatus("running");
      setLiveItems((prev) =>
        prev.map((it) => (it.kind === "gate" ? { ...it, status: "approved" as const } : it)),
      );
      setMessages((prev) =>
        prev.map((m) => (m.role === "approval_gate" && m.gate_status === "pending" ? { ...m, gate_status: "approved" as const } : m)),
      );
      return true;
    } catch (err) {
      setToast(`Approve failed: ${err instanceof Error ? err.message : "unknown error"}`);
      return false;
    }
  }

  async function sendUserMessage(text: string) {
    if (!pipeline) return;
    let convId = conversationId;
    try {
      if (!convId) {
        const created = await createConversation({ title: pipeline.title, pipeline_id: pipeline.id });
        convId = created.id;
        setConversationId(convId);
      }
      const result = await sendMessage(convId, text);
      setMessages((prev) => [...prev, result.user_message]);
    } catch (err) {
      setToast(`Send failed: ${err instanceof Error ? err.message : "backend unreachable"}`);
    }
  }

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    void sendUserMessage(text);
  }

  if (fetchState === "notfound") notFound();

  if (fetchState === "loading") {
    return (
      <div className="flex h-screen items-center justify-center text-sm" style={{ color: "#71717a" }}>
        Loading pipeline…
      </div>
    );
  }

  if (fetchState === "error" || pipeline === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-sm font-medium" style={{ color: "#ef4444" }}>Failed to load pipeline</div>
          <div className="text-xs mt-1" style={{ color: "#71717a" }}>
            Check that the backend is running, then refresh.
          </div>
        </div>
      </div>
    );
  }

  const displayStatus = liveStatus ?? pipeline.status;
  const s = STATUS_STYLES[displayStatus] ?? STATUS_STYLES.completed;
  const runIsActive = run !== null && liveStatus !== null && ACTIVE_RUN_STATUSES.includes(liveStatus as PipelineRun["status"]);

  const historyMsgs: PipelineChatMsg[] = messages
    .filter((m) => m.role === "user" || m.role === "assistant" || m.role === "approval_gate")
    .map((m) => {
      const agent = agentById(m.agent_id);
      const relayTarget = m.sender_agent_id ? agentById(m.sender_agent_id) : undefined;
      return {
        id: m.id,
        role: m.role === "user" ? ("user" as const) : ("assistant" as const),
        content: m.content,
        agentName: agent?.name,
        agentColor: agent?.avatar_color,
        sender_agent_id: m.sender_agent_id ?? undefined,
        relay_to_agent_name: relayTarget && relayTarget.id !== agent?.id ? relayTarget.name : undefined,
        created_at: m.created_at,
        type: m.role === "approval_gate" ? ("approval_gate" as const) : ("message" as const),
        approvalSummary: m.content,
        approvalWhatNext: "Approve to resume the pipeline from this gate.",
        gateStatus: m.gate_status,
      } as PipelineChatMsg & { gateStatus?: string | null };
    });

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left panel — execution plan */}
      <PipelineExecutionPlan
        planMd={pipeline.plan_md || "# Execution Plan\n\nNo plan provided for this pipeline."}
        collapsed={planCollapsed}
        onToggle={() => setPlanCollapsed((v) => !v)}
      />

      {/* Center — chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b shrink-0" style={{ borderColor: "#1f1f1f" }}>
          <Link
            href="/pipelines"
            className="text-xs transition-colors duration-150 shrink-0"
            style={{ color: "#71717a" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#f5f5f5")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#71717a")}
          >
            ← Back to Pipelines
          </Link>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="text-sm font-semibold truncate" style={{ color: "#f5f5f5" }}>
              {pipeline.title}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
              style={{ color: s.color, background: s.bg }}
            >
              {s.label}
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {historyMsgs.length === 0 && liveItems.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full" style={{ color: "#3f3f46" }}>
              <div className="text-4xl mb-3">⚙️</div>
              <p className="text-sm">No activity yet. Start the pipeline to watch agents work.</p>
            </div>
          )}

          {historyMsgs.map((msg) =>
            msg.type === "approval_gate" ? (
              <ApprovalGateCard
                key={msg.id}
                summary={msg.approvalSummary ?? ""}
                whatNext={msg.approvalWhatNext ?? ""}
                status={
                  (msg as PipelineChatMsg & { gateStatus?: string | null }).gateStatus === "approved"
                    ? "approved"
                    : "pending"
                }
                onApprove={handleApproveGate}
                onSendFeedback={(feedback) => void sendUserMessage(feedback)}
              />
            ) : (
              <PipelineChatMessage key={msg.id} msg={msg} participants={participants} />
            ),
          )}

          {/* Live socket items */}
          {liveItems.map((item) => {
            if (item.kind === "stream") {
              const agent = agentById(item.agentId);
              return (
                <PipelineChatMessage
                  key={item.id}
                  msg={{
                    id: item.id,
                    role: "assistant",
                    content: item.text,
                    agentName: agent?.name ?? "Agent",
                    agentColor: agent?.avatar_color,
                    created_at: new Date().toISOString(),
                  }}
                  participants={participants}
                />
              );
            }
            if (item.kind === "tool") {
              const agent = agentById(item.agentId);
              const argSummary =
                typeof item.args.path === "string"
                  ? item.args.path
                  : typeof item.args.command === "string"
                    ? item.args.command
                    : typeof item.args.query === "string"
                      ? item.args.query
                      : "";
              return (
                <div
                  key={item.id}
                  className="rounded-xl border px-4 py-2.5 text-xs font-mono"
                  style={{ background: "#141414", borderColor: "#1f1f1f", color: "#71717a" }}
                >
                  🔧 {agent?.name ?? "Agent"} is calling{" "}
                  <span style={{ color: "#f59e0b" }}>{item.tool}</span>
                  {argSummary && <span style={{ color: "#a1a1aa" }}> on {argSummary}</span>}
                  {item.result !== undefined && (
                    <div className="mt-1.5 truncate" style={{ color: "#52525b" }}>
                      ↳ {item.result.slice(0, 200)}
                    </div>
                  )}
                </div>
              );
            }
            if (item.kind === "gate") {
              return (
                <ApprovalGateCard
                  key={item.id}
                  summary={item.summary}
                  whatNext="Approve to resume the pipeline from this gate."
                  status={item.status}
                  onApprove={handleApproveGate}
                  onSendFeedback={(feedback) => void sendUserMessage(feedback)}
                />
              );
            }
            return (
              <div
                key={item.id}
                className="text-center text-xs py-2"
                style={{ color: item.tone === "error" ? "#ef4444" : "#22c55e" }}
              >
                {item.text}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Not-running banner */}
        {!runIsActive && (
          <div
            className="mx-6 mb-3 px-4 py-3 rounded-xl border flex items-center justify-between gap-3 shrink-0"
            style={{ background: "#141414", borderColor: "#2a2a2a" }}
          >
            <span className="text-xs" style={{ color: "#71717a" }}>
              {displayStatus === "completed"
                ? "Last run completed. Start a new run to continue."
                : displayStatus === "failed"
                  ? "Last run failed. You can start a new run."
                  : "Pipeline not running."}
            </span>
            <button
              onClick={handleApproveAndStart}
              disabled={approving}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors duration-150 shrink-0"
              style={{ background: "#22c55e", color: "#0a0a0a" }}
            >
              {approving ? "Starting…" : "Approve & Start"}
            </button>
          </div>
        )}

        {/* Input */}
        <PipelineChatInput value={input} onChange={setInput} onSend={handleSend} participants={participants} />
      </div>

      {/* Right panel — participants */}
      <PipelineParticipants agents={participants} />

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
