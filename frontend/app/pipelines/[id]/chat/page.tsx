"use client";

import { use, useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import PipelineChatMessage, { type PipelineChatMsg } from "@/components/PipelineChatMessage";
import { type ChatImage } from "@/components/chat/ImageAttachment";
import ToolCallCard, { summarizeToolArgs } from "@/components/ToolCallCard";
import ApprovalGateCard from "@/components/ApprovalGateCard";
import PipelineChatInput from "@/components/PipelineChatInput";
import PipelineParticipants, { type AgentActivity } from "@/components/PipelineParticipants";
import PipelineExecutionPlan from "@/components/PipelineExecutionPlan";
import ErrorState from "@/components/ErrorState";
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
  // Set the instant a gate is approved: suppresses the not-running banner
  // until the WebSocket confirms the resumed status (next 'status' event).
  const [isResuming, setIsResuming] = useState(false);
  const [input, setInput] = useState("");
  const [chatImage, setChatImage] = useState<ChatImage | null>(null);
  const [planCollapsed, setPlanCollapsed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [agentActivity, setAgentActivity] = useState<AgentActivity>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const activityTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Live status dots: streaming (blue) reverts to idle shortly after tokens
  // stop; executing (green) gets a long failsafe in case no event follows.
  const markActivity = useCallback(
    (agentId: string | null, state: "executing" | "streaming" | null, revertMs?: number) => {
      if (!agentId) return;
      const timers = activityTimers.current;
      if (timers[agentId]) {
        clearTimeout(timers[agentId]);
        delete timers[agentId];
      }
      setAgentActivity((prev) => {
        const next = { ...prev };
        if (state === null) delete next[agentId];
        else next[agentId] = state;
        return next;
      });
      if (state !== null && revertMs) {
        timers[agentId] = setTimeout(() => {
          delete timers[agentId];
          setAgentActivity((prev) => {
            const next = { ...prev };
            delete next[agentId];
            return next;
          });
        }, revertMs);
      }
    },
    [],
  );

  const clearAllActivity = useCallback(() => {
    for (const timer of Object.values(activityTimers.current)) clearTimeout(timer);
    activityTimers.current = {};
    setAgentActivity({});
  }, []);

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
            // Blue pulsing + typing dots while tokens flow; revert to idle
            // once they stop for a beat.
            markActivity(event.agent_id, "streaming", 3000);
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
            // Green pulsing while a tool runs (60s failsafe covers the
            // command timeout).
            markActivity(event.agent_id, "executing", 65_000);
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
            markActivity(event.agent_id, "executing", 3000);
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
            setIsResuming(false); // backend confirmed the post-approval status
            markActivity(event.agent_id, "executing", 65_000);
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
            clearAllActivity();
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
            clearAllActivity();
            setLiveItems((prev) => [
              ...prev,
              { kind: "note", id: nextLiveId(), text: `Pipeline error: ${event.payload.error}`, tone: "error" },
            ]);
            socket.close();
            break;
        }
      };
    },
    [reloadMessages, markActivity, clearAllActivity],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const detail = await getPipeline(id);
        if (cancelled) return;
        setPipeline(detail);
        setFetchState("ready");
        if (detail.current_run) {
          setRun(detail.current_run);
          if (ACTIVE_RUN_STATUSES.includes(detail.current_run.status)) {
            setLiveStatus(detail.current_run.status);
            connectSocket(detail.current_run.id);
          }
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
      for (const timer of Object.values(activityTimers.current)) clearTimeout(timer);
      activityTimers.current = {};
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
      setIsResuming(true);
      // Reconnect right away if the socket dropped — don't wait for a poll.
      const socket = socketRef.current;
      if (!socket || socket.readyState === WebSocket.CLOSING || socket.readyState === WebSocket.CLOSED) {
        connectSocket(run.id);
      }
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

  async function sendUserMessage(text: string, image?: ChatImage) {
    if (!pipeline) return;
    let convId = conversationId;
    try {
      if (!convId) {
        const created = await createConversation({ title: pipeline.title, pipeline_id: pipeline.id });
        convId = created.id;
        setConversationId(convId);
      }
      const result = await sendMessage(convId, text, image);
      setMessages((prev) => [
        ...prev,
        result.user_message,
        ...(result.assistant_message ? [result.assistant_message] : []),
      ]);
      if (result.error) setToast(result.error);
    } catch (err) {
      setToast(`Send failed: ${err instanceof Error ? err.message : "backend unreachable"}`);
    }
  }

  function handleSend() {
    const text = input.trim();
    const image = chatImage;
    if (!text && !image) return;
    setInput("");
    setChatImage(null);
    void sendUserMessage(text, image ?? undefined);
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
      <div className="flex h-screen items-center justify-center px-8">
        <div className="w-full max-w-[480px]">
          <ErrorState
            message="Failed to load pipeline — check that the backend is running."
            onRetry={() => window.location.reload()}
          />
        </div>
      </div>
    );
  }

  const displayStatus = liveStatus ?? pipeline.status;
  const s = STATUS_STYLES[displayStatus] ?? STATUS_STYLES.completed;
  const runIsActive = run !== null && liveStatus !== null && ACTIVE_RUN_STATUSES.includes(liveStatus as PipelineRun["status"]);

  // A finished pipeline is a living project — chat stays open so the user can
  // keep working with the agents. Running keeps it closed (agents are busy).
  const inputEnabled =
    displayStatus === "completed" ||
    displayStatus === "failed" ||
    displayStatus === "paused_for_approval";
  const inputPlaceholder =
    displayStatus === "completed"
      ? "Continue working with your agents... (use @AgentName)"
      : displayStatus === "failed"
        ? "Ask your agents what went wrong... (use @AgentName)"
        : displayStatus === "running"
          ? "Agents are working — wait for this run to finish"
          : displayStatus === "paused_for_approval"
            ? undefined
            : "Start the pipeline to send messages";

  // Persisted tool_call messages carry a JSON body written by the executor.
  const parseToolCall = (m: BackendMessage) => {
    try {
      const data = JSON.parse(m.content) as {
        tool_name?: string;
        args?: Record<string, unknown>;
        status?: string;
        result_summary?: string;
      };
      return {
        tool: data.tool_name ?? "tool",
        argSummary: summarizeToolArgs(data.args ?? {}),
        resultSummary: data.result_summary,
        running: data.status === "running",
      };
    } catch {
      return { tool: "tool", argSummary: m.content.slice(0, 80), resultSummary: undefined, running: false };
    }
  };

  type HistoryItem =
    | { kind: "chat"; msg: PipelineChatMsg & { gateStatus?: string | null } }
    | {
        kind: "tool_call";
        id: string;
        agentName: string;
        tool: string;
        argSummary: string;
        resultSummary?: string;
        running: boolean;
      };

  const historyItems: HistoryItem[] = messages
    .filter(
      (m) =>
        m.role === "user" || m.role === "assistant" || m.role === "approval_gate" || m.role === "tool_call",
    )
    .map((m) => {
      const agent = agentById(m.agent_id);
      if (m.role === "tool_call") {
        return {
          kind: "tool_call" as const,
          id: m.id,
          agentName: agent?.name ?? "Agent",
          ...parseToolCall(m),
        };
      }
      const relayTarget = m.sender_agent_id ? agentById(m.sender_agent_id) : undefined;
      return {
        kind: "chat" as const,
        msg: {
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
          imageData: m.image_data ?? undefined,
          imageMediaType: m.image_media_type ?? undefined,
        } as PipelineChatMsg & { gateStatus?: string | null },
      };
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
            <div className="min-w-0">
              <div className="flex items-center gap-3">
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
              <span className="text-xs font-mono truncate block" style={{ color: "#3f3f46" }}>
                {pipeline.workspace_path}
              </span>
            </div>
          </div>
        </div>

        {/* Pipeline-not-running notice — only for idle states where chat is closed */}
        {!inputEnabled && displayStatus !== "running" && !isResuming && (
          <div
            className="mx-6 mt-3 px-4 py-2 rounded-lg text-xs shrink-0"
            style={{ background: "#141414", color: "#71717a", border: "1px solid #2a2a2a" }}
          >
            Pipeline is not running. Start it to enable agent responses.
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {historyItems.length === 0 && liveItems.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full" style={{ color: "#3f3f46" }}>
              <div className="text-4xl mb-3">⚙️</div>
              <p className="text-sm">No activity yet. Start the pipeline to watch agents work.</p>
            </div>
          )}

          {historyItems.map((item) => {
            if (item.kind === "tool_call") {
              return (
                <ToolCallCard
                  key={item.id}
                  agentName={item.agentName}
                  tool={item.tool}
                  argSummary={item.argSummary}
                  resultSummary={item.resultSummary}
                  running={item.running}
                />
              );
            }
            const msg = item.msg;
            return msg.type === "approval_gate" ? (
              <ApprovalGateCard
                key={msg.id}
                summary={msg.approvalSummary ?? ""}
                whatNext={msg.approvalWhatNext ?? ""}
                status={msg.gateStatus === "approved" ? "approved" : "pending"}
                onApprove={handleApproveGate}
                onSendFeedback={(feedback) => void sendUserMessage(feedback)}
              />
            ) : (
              <PipelineChatMessage key={msg.id} msg={msg} participants={participants} />
            );
          })}

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
              return (
                <ToolCallCard
                  key={item.id}
                  agentName={agent?.name ?? "Agent"}
                  tool={item.tool}
                  argSummary={summarizeToolArgs(item.args)}
                  resultSummary={item.result}
                  running={item.result === undefined}
                />
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

        {/* Not-running banner (no run started yet) */}
        {!runIsActive && !isResuming && displayStatus !== "completed" && displayStatus !== "failed" && (
          <div
            className="mx-6 mb-3 px-4 py-3 rounded-xl border flex items-center justify-between gap-3 shrink-0"
            style={{ background: "#141414", borderColor: "#2a2a2a" }}
          >
            <span className="text-xs" style={{ color: "#71717a" }}>
              Pipeline not running.
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

        {/* Input — a finished pipeline stays chattable: it's a living project */}
        <PipelineChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          participants={participants}
          disabled={!inputEnabled}
          placeholder={inputPlaceholder}
          image={chatImage}
          onImageChange={setChatImage}
          onImageError={setToast}
        />
      </div>

      {/* Right panel — participants */}
      <PipelineParticipants agents={participants} activity={agentActivity} />

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
