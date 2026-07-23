"use client";

import { use, useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { notFound } from "next/navigation";
import { chatMarkdownComponents } from "@/components/chat/CodeBlock";
import {
  AttachImageButton,
  fileToChatImage,
  ImageAttachmentGroup,
  ImagePreviewRow,
  MAX_IMAGES_PER_MESSAGE,
  type ChatImage,
} from "@/components/chat/ImageAttachment";
import Toast from "@/components/Toast";
import ConversationMenu from "@/components/ConversationMenu";
import {
  createConversation,
  listAgents,
  listConversations,
  listMessages,
  listTasks,
  sendMessage,
  updateConversation,
} from "@/lib/api";
import { useForge } from "@/lib/store";
import type { BackendConversation, BackendMessage } from "@/types";

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
  const { state, dispatch } = useForge();

  const agent = state.agents.find((a) => a.id === id) ?? null;
  const agentsLoading = state.loading.agents;

  const isNew = convId === "new";
  const [agentConvos, setAgentConvos] = useState<BackendConversation[]>([]);
  const [messages, setMessages] = useState<BackendMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(!isNew);
  const [oldestLoadedPage, setOldestLoadedPage] = useState(1);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [pendingImages, setPendingImages] = useState<ChatImage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<ChatImage[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const conversation = agentConvos.find((c) => c.id === convId) ?? null;

  // Reset paging state when navigating between conversations — render-phase
  // state adjustment (React's documented pattern), not a setState-in-effect.
  const [prevConvId, setPrevConvId] = useState(convId);
  if (prevConvId !== convId) {
    setPrevConvId(convId);
    setMessages([]);
    setOldestLoadedPage(1);
    setMessagesLoading(!isNew);
  }

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

  // Files dropped anywhere on the page (see GlobalDropOverlay) land here.
  useEffect(() => {
    if (pendingText !== null) return;
    function onGlobalDrop(e: Event) {
      const files = (e as CustomEvent<{ files: File[] }>).detail?.files ?? [];
      const accepted = files.slice(0, Math.max(0, MAX_IMAGES_PER_MESSAGE - images.length));
      if (accepted.length === 0) return;
      Promise.all(accepted.map(fileToChatImage))
        .then((added) => setImages((prev) => [...prev, ...added]))
        .catch((err) => setToast(err instanceof Error ? err.message : "Could not attach image"));
    }
    window.addEventListener("forge:image-dropped", onGlobalDrop);
    return () => window.removeEventListener("forge:image-dropped", onGlobalDrop);
  }, [pendingText, images.length]);

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
    const attachments = images;
    if ((!text && attachments.length === 0) || pendingText !== null) return;
    setInput("");
    setImages([]);
    setPendingText(text);
    setPendingImages(attachments);
    setThinking(true);
    try {
      let targetId = convId;
      if (isNew) {
        const created = await createConversation({ title: "General Chat", agent_id: id });
        targetId = created.id;
      }
      const result = await sendMessage(targetId, text, attachments.length > 0 ? attachments : undefined);
      setMessages((prev) => [
        ...prev,
        result.user_message,
        ...(result.assistant_message ? [result.assistant_message] : []),
      ]);
      setPendingText(null);
      setPendingImages([]);
      if (result.error) setToast(result.error);
      if (isNew) {
        router.replace(`/agents/${id}/conversations/${targetId}`);
      } else {
        // refresh sidebar previews
        listConversations({ agent_id: id }).then(setAgentConvos).catch(() => {});
      }
      // Eternal agents (Atlas) can create agents mid-chat: refresh the
      // roster so new agents appear everywhere without a reload.
      if (agent?.is_eternal) {
        try {
          const known = new Set(state.agents.map((a) => a.id));
          const refreshed = await listAgents();
          dispatch({ type: "SET_AGENTS", agents: refreshed });
          const created = refreshed.filter((a) => !known.has(a.id));
          if (created.length > 0) {
            setToast(`Agent ${created.map((a) => a.name).join(", ")} created successfully`);
          }
        } catch {
          // Roster refresh is best-effort — the reply itself already landed.
        }
      }
    } catch (err) {
      setPendingText(null);
      setPendingImages([]);
      setInput(text); // give the draft back
      setImages(attachments);
      setToast(`Send failed: ${err instanceof Error ? err.message : "backend unreachable"}`);
    } finally {
      setThinking(false);
    }
  }

  function startRename() {
    if (!conversation) return;
    setTitleDraft(conversation.title);
    setRenaming(true);
  }

  async function commitRename() {
    const title = titleDraft.trim();
    setRenaming(false);
    if (!conversation || !title || title === conversation.title) return;
    try {
      const updated = await updateConversation(conversation.id, title);
      dispatch({ type: "UPDATE_CONVERSATION", conversation: updated });
      setAgentConvos((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err) {
      setToast(`Rename failed: ${err instanceof Error ? err.message : "backend unreachable"}`);
    }
  }

  // While this conversation's task is executing in the background, poll for
  // new messages every 3s so the agent's reply appears without a refresh.
  const pollTask = conversation?.task_id
    ? state.tasks.find((t) => t.id === conversation.task_id)
    : null;
  const taskRunning = pollTask?.status === "in_progress";

  useEffect(() => {
    if (!taskRunning || isNew) return;
    const interval = setInterval(async () => {
      try {
        const first = await listMessages(convId, 1);
        const lastPage = Math.max(1, Math.ceil(first.total / first.page_size));
        const latest = lastPage === 1 ? first : await listMessages(convId, lastPage);
        // Also fetch the page before the tail in case new messages crossed a
        // page boundary since the last poll.
        const before = lastPage > 1 ? await listMessages(convId, lastPage - 1) : null;
        setMessages((prev) => {
          const known = new Set(prev.map((m) => m.id));
          const incoming = [...(before?.items ?? []), ...latest.items].filter(
            (m) => !known.has(m.id),
          );
          return incoming.length > 0 ? [...prev, ...incoming] : prev;
        });
        // Refresh tasks so the poll stops once the run finishes.
        const tasks = await listTasks();
        dispatch({ type: "SET_TASKS", tasks });
      } catch {
        // Transient poll failure — the next tick retries.
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [taskRunning, convId, isNew, dispatch]);

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
          <div className="flex-1 min-w-0">
            {renaming ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setRenaming(false);
                }}
                className="text-sm font-semibold outline-none border-b bg-transparent"
                style={{ color: "#f5f5f5", borderColor: "#f59e0b" }}
              />
            ) : (
              <div
                className="text-sm font-semibold cursor-text"
                style={{ color: "#f5f5f5" }}
                onClick={startRename}
              >
                {conversation?.title ?? "General Chat"}
              </div>
            )}
            <div className="text-xs" style={{ color: "#71717a" }}>
              {task ? `Task: ${task.title}` : "General · " + agent.name}
            </div>
          </div>
          {conversation && !isNew && (
            <ConversationMenu
              conversationId={conversation.id}
              onRename={startRename}
              onDeleted={() => {
                sessionStorage.setItem("forge:toast", "Conversation deleted");
                router.push(`/agents/${id}`);
              }}
            />
          )}
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
                <div className={`group max-w-[70%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  <div
                    className="px-4 py-3 text-sm leading-relaxed markdown-body"
                    style={
                      isUser
                        ? { background: "#1f1f1f", color: "#f5f5f5", borderRadius: "18px 4px 18px 18px" }
                        : { background: "#111111", color: "#f5f5f5", border: "1px solid #1f1f1f", borderRadius: "4px 18px 18px 18px" }
                    }
                  >
                    {(msg.images.length > 0 || (msg.image_data && msg.image_media_type)) && (
                      <div className="mb-2">
                        <ImageAttachmentGroup
                          images={
                            msg.images.length > 0
                              ? msg.images.map((img) => ({ data: img.image_data, mediaType: img.media_type }))
                              : [{ data: msg.image_data as string, mediaType: msg.image_media_type as string }]
                          }
                        />
                      </div>
                    )}
                    {isUser ? (
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    ) : (
                      <ReactMarkdown rehypePlugins={[rehypeHighlight]} remarkPlugins={[remarkGfm]} components={chatMarkdownComponents}>
                        {msg.content}
                      </ReactMarkdown>
                    )}
                  </div>
                  <div
                    className="text-[10px] px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                    style={{ color: "#3f3f46" }}
                  >
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
                  {pendingImages.length > 0 && (
                    <div className="mb-2">
                      <ImageAttachmentGroup images={pendingImages} />
                    </div>
                  )}
                  <span className="whitespace-pre-wrap">{pendingText}</span>
                </div>
                <div className="text-[10px] px-1" style={{ color: "#3f3f46" }}>sending…</div>
              </div>
            </div>
          )}

          {/* Background task run indicator */}
          {taskRunning && !thinking && (
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
                {agent.name} is working on this task…
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
          <ImagePreviewRow images={images} onRemove={(index) => setImages((prev) => prev.filter((_, i) => i !== index))} />
          <div className="flex gap-3 items-end">
            <AttachImageButton
              onSelect={(added) => setImages((prev) => [...prev, ...added])}
              onError={setToast}
              disabled={pendingText !== null}
              remainingSlots={MAX_IMAGES_PER_MESSAGE - images.length}
            />
            <textarea
              ref={textareaRef}
              value={input}
              rows={1}
              onChange={(e) => {
                setInput(e.target.value);
                const el = textareaRef.current;
                if (!el) return;
                el.style.height = "auto";
                const maxHeight = 6 * 20;
                el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
                el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder={`Message ${agent.name}...`}
              className="flex-1 px-4 py-3 rounded-xl text-sm outline-none border transition-colors duration-150 resize-none"
              style={{ background: "#111111", borderColor: inputFocused ? "#f59e0b" : "#1f1f1f", color: "#f5f5f5", lineHeight: "20px" }}
            />
            <button
              onClick={handleSend}
              disabled={(!input.trim() && images.length === 0) || pendingText !== null}
              className="px-4 py-3 rounded-xl text-sm font-semibold transition-colors duration-150 shrink-0"
              style={{
                background: (input.trim() || images.length > 0) && pendingText === null ? "#f59e0b" : "#1f1f1f",
                color: (input.trim() || images.length > 0) && pendingText === null ? "#0a0a0a" : "#3f3f46",
              }}
            >
              Send
            </button>
          </div>
          {inputFocused && (
            <div className="text-[10px] px-1 pt-1.5" style={{ color: "#3f3f46" }}>
              Enter to send · Shift+Enter for new line
            </div>
          )}
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
