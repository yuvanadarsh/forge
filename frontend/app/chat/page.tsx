"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import ConversationMenu from "@/components/ConversationMenu";
import Toast from "@/components/Toast";
import { listConversations, updateConversation } from "@/lib/api";
import { useForge } from "@/lib/store";

function timeAgo(iso: string | null) {
  if (!iso) return "";
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

export default function ChatPage() {
  const { state, dispatch } = useForge();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const agents = state.agents;
  const conversations = state.conversations;

  useEffect(() => {
    let cancelled = false;
    listConversations()
      .then((convos) => {
        if (cancelled) return;
        dispatch({ type: "SET_CONVERSATIONS", conversations: convos });
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  // Agent conversations only — pipeline-level threads (agent_id null) live
  // in the pipeline chat view.
  const agentConversations = conversations.filter((c) => c.agent_id !== null);

  const filtered = agentConversations.filter(
    (c) =>
      search === "" ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.last_message?.toLowerCase().includes(search.toLowerCase()),
  );

  const rows = agents.flatMap((agent) => {
    const pair = RING_COLORS[agent.avatar_color] ?? [agent.avatar_color, agent.avatar_color];
    return filtered
      .filter((c) => c.agent_id === agent.id)
      .map((conv) => ({ agent, conv, pair }));
  });

  const busy = loading || state.loading.agents;

  async function commitRename(conversationId: string) {
    const title = titleDraft.trim();
    setRenamingId(null);
    const current = conversations.find((c) => c.id === conversationId);
    if (!title || !current || title === current.title) return;
    // Optimistic: update the store immediately, revert + toast if the PATCH fails.
    dispatch({ type: "UPDATE_CONVERSATION", conversation: { ...current, title } });
    try {
      const updated = await updateConversation(conversationId, title);
      dispatch({ type: "UPDATE_CONVERSATION", conversation: updated });
    } catch (err) {
      dispatch({ type: "UPDATE_CONVERSATION", conversation: current });
      setToast(`Rename failed: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  return (
    <div className="px-8 py-8 max-w-[860px] mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "#f5f5f5" }}>Chat</h1>
        <p className="text-sm mt-1" style={{ color: "#71717a" }}>
          {busy
            ? "Loading conversations…"
            : `${agentConversations.length} conversations across ${agents.length} agents`}
        </p>
      </div>

      {/* Search */}
      <div className="mb-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search conversations..."
          className="w-full px-4 py-3 rounded-xl text-sm outline-none border transition-colors duration-150"
          style={{ background: "#111111", borderColor: "#1f1f1f", color: "#f5f5f5" }}
          onFocus={(e) => (e.target.style.borderColor = "#f59e0b")}
          onBlur={(e) => (e.target.style.borderColor = "#1f1f1f")}
        />
      </div>

      {busy ? (
        <div className="space-y-2">
          <LoadingSkeleton variant="row" count={4} />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-center py-16" style={{ color: "#71717a" }}>
          {search
            ? "No conversations match your search."
            : "No conversations yet — open an agent and start a general chat."}
        </div>
      ) : (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: "#1f1f1f" }}
        >
          {rows.map(({ agent, conv, pair }, i) => (
            <div
              key={conv.id}
              className="relative flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-[#161616]"
              style={{
                borderLeft: `3px solid ${pair[0]}`,
                borderBottom: i < rows.length - 1 ? "1px solid #1a1a1a" : "none",
                background: "#111111",
              }}
            >
              <Link
                href={`/agents/${agent.id}/conversations/${conv.id}`}
                className="flex items-center gap-3 flex-1 min-w-0"
              >
                {/* Avatar */}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: `linear-gradient(to right, ${pair[0]}, ${pair[1]})`, color: "#fff" }}
                >
                  {agent.name[0]}
                </div>

                {/* Agent name · role */}
                <div className="shrink-0 flex items-center gap-1 min-w-[160px]">
                  <span className="text-xs font-semibold truncate" style={{ color: "#f5f5f5" }}>
                    {agent.name}
                  </span>
                  <span className="text-xs" style={{ color: "#3f3f46" }}>·</span>
                  <span className="text-xs truncate" style={{ color: "#71717a" }}>
                    {agent.role}
                  </span>
                </div>

                {/* Separator */}
                <span className="text-xs shrink-0" style={{ color: "#2a2a2a" }}>—</span>

                {/* Conversation title */}
                {renamingId === conv.id ? (
                  <input
                    autoFocus
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onBlur={() => commitRename(conv.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(conv.id);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    className="text-xs font-medium shrink-0 max-w-[160px] outline-none border-b bg-transparent"
                    style={{ color: "#f5f5f5", borderColor: "#f59e0b" }}
                  />
                ) : (
                  <span className="text-xs font-medium shrink-0 truncate max-w-[160px]" style={{ color: "#a1a1aa" }}>
                    {conv.title}
                  </span>
                )}

                {/* Separator */}
                <span className="text-xs shrink-0" style={{ color: "#2a2a2a" }}>—</span>

                {/* Last message preview */}
                <span className="text-xs truncate flex-1 min-w-0" style={{ color: "#71717a" }}>
                  {conv.last_message ?? "No messages yet"}
                </span>

                {/* Timestamp */}
                <span className="text-xs shrink-0 ml-auto" style={{ color: "#3f3f46" }}>
                  {timeAgo(conv.last_active)}
                </span>
              </Link>

              <ConversationMenu
                conversationId={conv.id}
                onRename={() => {
                  setTitleDraft(conv.title);
                  setRenamingId(conv.id);
                }}
                onDeleted={() => {}}
              />
            </div>
          ))}
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
