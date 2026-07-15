"use client";

import { use, useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { notFound } from "next/navigation";
import Toast from "@/components/Toast";
import { createConversation, listConversations, listMessages, sendMessage } from "@/lib/api";
import { useForge } from "@/lib/store";
import type { BackendConversation, BackendMessage } from "@/types";

const PAGE_SIZE = 50;

function timeStr(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ConversationPage({
  params,
}: {
  params: Promise<{ id: string; convId: string }>;
}) {
  const { id, convId } = use(params);
  const router = useRouter();
  const { state } = useForge();

  const agent = state.agents.find((a) => a.id === id) ?? null;
  const agentsLoading = state.loading.agents;

  const isNew = convId === "new";
  const [agentConvos, setAgentConvos] = useState<BackendConversation[]>([]);
  const [messages, setMessages] = useState<BackendMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(!isNew);
  const [oldestLoadedPage, setOldestLoadedPage] = useState(1);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [input, setInput] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversation = agentConvos.find((c) => c.id === convId) ?? null;

  useEffect(() => {
    let cancelled = false;
    listConversations({ agent_id: id })
      .then((convos) => {
        if (!cancelled) setAgentConvos(convos);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Chronological pages (page 1 = oldest): fetch page 1 for the total, then
  // jump to the last page so the chat opens at the latest messages; "Load
  // older" prepends earlier pages.
  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    setMessagesLoading(true);
    (async () => {
      try {
        const first = await listMessages(convId, 1);
        if (cancelled) return;
        const lastPage = Math.max(1, Math.ceil(first.total / first.page_size));
        if (lastPage === 1) {
          setMessages(first.items);
          setOldestLoadedPage(1);
        } else {
          const latest = await listMessages(convId, lastPage);
          if (cancelled) return;
          setMessages(latest.items);
          setOldestLoadedPage(lastPage);
        }
      } catch {
        if (!cancelled) setToast("Could not load messages — is the backend running?");
      } finally {
        if (!cancelled) setMessagesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [convId, isNew]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingText, thinking]);

  const loadOlder = useCallback(async () => {
    if (loadingOlder || oldestLoadedPage <= 1) return;
    setLoadingOlder(true);
    try {
      const page = await listMessages(convId, oldestLoadedPage - 1);
      setMessages((prev) => [...page.items, ...prev]);
      setOldestLoadedPage((p) => p - 1);
    } catch {
      setToast("Could not load older messages.");
    } finally {
      setLoadingOlder(false);
    }
  }, [convId, loadingOlder, oldestLoadedPage]);

  async function handleSend() {
    const text = input.trim();
    if (!text || pendingText !== null) return;
    setInput("");
    setPendingText(text);
    setThinking(true);
    try {
      let targetId = convId;
      if (isNew) {
        const created = await createConversation({ title: "General Chat", agent_id: id });
        targetId = created.id;
      }
      const result = await sendMessage(targetId, text);
      setMessages((prev) => [
        ...prev,
        result.user_message,
        ...(result.assistant_message ? [result.assistant_message] : []),
      ]);
      setPendingText(null);
      if (result.error) setToast(result.error);
      if (isNew) {
        router.replace(`/agents/${id}/conversations/${targetId}`);
      } else {
        // refresh sidebar previews
        listConversations({ agent_id: id }).then(setAgentConvos).catch(() => {});
      }
    } catch (err) {
      setPendingText(null);
      setInput(text); // give the draft back
      setToast(`Send failed: ${err instanceof Error ? err.message : "backend unreachable"}`);
    } finally {
      setThinking(false);
    }
  }

  if (!agentsLoading && agent === null) notFound();

  if (agent === null) {
    return (
      <div className="flex h-screen items-center justify-center text-sm" style={{ color: "#71717a" }}>
        Loading…
      </div>
    );
  }

  const task = conversation?.task_id
    ? state.tasks.find((t) => t.id === conversation.task_id)
    : null;

  const visibleMessages = messages.filter((m) => m.role === "user" || m.role === "assistant");
  const hasOlder = oldestLoadedPage > 1;

  return (
    <div className="flex h-screen">
      {/* Conversation sidebar */}
      <div className="w-[240px] shrink-0 border-r flex flex-col" style={{ background: "#0d0d0d", borderColor: "#1f1f1f" }}>
        <div className="p-4 border-b" style={{ borderColor: "#1f1f1f" }}>
          <Link href={`/agents/${id}`} className="text-xs flex items-center gap-1 mb-3 transition-colors duration-150" style={{ color: "#71717a" }}>
            ← {agent.name}
          </Link>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#71717a" }}>Conversations</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {agentConvos.map((c) => {
            const active = c.id === convId;
            return (
              <Link
                key={c.id}
                href={`/agents/${id}/conversations/${c.id}`}
                className="block px-3 py-2.5 rounded-lg text-xs transition-colors duration-150"
                style={{
                  background: active ? "rgba(245,158,11,0.08)" : "transparent",
                  color: active ? "#f59e0b" : "#71717a",
                  borderLeft: active ? "3px solid #f59e0b" : "3px solid transparent",
                }}
              >
                <div className="font-medium truncate">{c.title}</div>
                {c.last_message && (
                  <div className="truncate mt-0.5 opacity-70">{c.last_message}</div>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b shrink-0" style={{ borderColor: "#1f1f1f" }}>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
            style={{ background: agent.avatar_color, color: "#fff" }}
          >
            {agent.name[0]}
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: "#f5f5f5" }}>
              {conversation?.title ?? "General Chat"}
            </div>
            <div className="text-xs" style={{ color: "#71717a" }}>
              {task ? `Task: ${task.title}` : "General · " + agent.name}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {hasOlder && (
            <div className="flex justify-center">
              <button
                onClick={loadOlder}
                disabled={loadingOlder}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors duration-150"
                style={{ background: "#1a1a1a", color: "#71717a" }}
              >
                {loadingOlder ? "Loading…" : "Load older messages"}
              </button>
            </div>
          )}
          {messagesLoading && (
            <div className="flex flex-col items-center justify-center h-full text-sm" style={{ color: "#3f3f46" }}>
              Loading messages…
            </div>
          )}
          {!messagesLoading && visibleMessages.length === 0 && pendingText === null && (
            <div className="flex flex-col items-center justify-center h-full" style={{ color: "#3f3f46" }}>
              <div className="text-4xl mb-3">💬</div>
              <p className="text-sm">No messages yet. Say something!</p>
            </div>
          )}
          {visibleMessages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div key={msg.id} className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1"
                  style={isUser ? { background: "#1f1f1f", color: "#71717a" } : { background: agent.avatar_color, color: "#fff" }}
                >
                  {isUser ? "Y" : agent.name[0]}
                </div>
                <div className={`max-w-[70%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  <div
                    className="px-4 py-3 text-sm leading-relaxed markdown-body"
                    style={
                      isUser
                        ? { background: "#1f1f1f", color: "#f5f5f5", borderRadius: "18px 4px 18px 18px" }
                        : { background: "#111111", color: "#f5f5f5", border: "1px solid #1f1f1f", borderRadius: "4px 18px 18px 18px" }
                    }
                  >
                    {isUser ? (
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    ) : (
                      <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                        {msg.content}
                      </ReactMarkdown>
                    )}
                  </div>
                  <div className="text-[10px] px-1" style={{ color: "#3f3f46" }}>
                    {timeStr(msg.created_at)}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Optimistic pending user message */}
          {pendingText !== null && (
            <div className="flex gap-3 flex-row-reverse" style={{ opacity: 0.6 }}>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1"
                style={{ background: "#1f1f1f", color: "#71717a" }}
              >
                Y
              </div>
              <div className="max-w-[70%] items-end flex flex-col gap-1">
                <div
                  className="px-4 py-3 text-sm leading-relaxed"
                  style={{ background: "#1f1f1f", color: "#f5f5f5", borderRadius: "18px 4px 18px 18px" }}
                >
                  <span className="whitespace-pre-wrap">{pendingText}</span>
                </div>
                <div className="text-[10px] px-1" style={{ color: "#3f3f46" }}>sending…</div>
              </div>
            </div>
          )}

          {/* Agent thinking indicator */}
          {thinking && (
            <div className="flex gap-3 flex-row">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1"
                style={{ background: agent.avatar_color, color: "#fff" }}
              >
                {agent.name[0]}
              </div>
              <div
                className="px-4 py-3 text-sm animate-pulse"
                style={{ background: "#111111", color: "#71717a", border: "1px solid #1f1f1f", borderRadius: "4px 18px 18px 18px" }}
              >
                {agent.name} is thinking…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t shrink-0" style={{ borderColor: "#1f1f1f" }}>
          <div className="flex gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder={`Message ${agent.name}...`}
              className="flex-1 px-4 py-3 rounded-xl text-sm outline-none border transition-colors duration-150"
              style={{ background: "#111111", borderColor: "#1f1f1f", color: "#f5f5f5" }}
              onFocus={(e) => (e.target.style.borderColor = "#f59e0b")}
              onBlur={(e) => (e.target.style.borderColor = "#1f1f1f")}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || pendingText !== null}
              className="px-4 py-3 rounded-xl text-sm font-semibold transition-colors duration-150"
              style={{ background: input.trim() && pendingText === null ? "#f59e0b" : "#1f1f1f", color: input.trim() && pendingText === null ? "#0a0a0a" : "#3f3f46" }}
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
