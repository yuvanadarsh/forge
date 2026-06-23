"use client";

import { use, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { mockAgents, mockConversations, mockMessages, mockTasks } from "@/lib/mock-data";
import type { Message } from "@/types";
import { notFound } from "next/navigation";

function timeStr(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ConversationPage({
  params,
}: {
  params: Promise<{ id: string; convId: string }>;
}) {
  const { id, convId } = use(params);
  const agent = mockAgents.find((a) => a.id === id);
  if (!agent) notFound();

  const conversation = mockConversations.find((c) => c.id === convId);
  if (!conversation && convId !== "new") notFound();

  const agentConvos = mockConversations.filter((c) => c.agent_id === id);
  const initialMessages = convId !== "new" ? mockMessages.filter((m) => m.conversation_id === convId) : [];

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    const newMsg: Message = {
      id: `msg-tmp-${Date.now()}`,
      conversation_id: convId,
      agent_id: id,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newMsg]);
    setInput("");
  }

  const task = conversation?.task_id
    ? mockTasks.find((t) => t.id === conversation.task_id)
    : null;

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
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full" style={{ color: "#3f3f46" }}>
              <div className="text-4xl mb-3">💬</div>
              <p className="text-sm">No messages yet. Say something!</p>
            </div>
          )}
          {messages.map((msg) => {
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
                    className="px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                    style={
                      isUser
                        ? { background: "#1f1f1f", color: "#f5f5f5", borderRadius: "18px 4px 18px 18px" }
                        : { background: "#111111", color: "#f5f5f5", border: "1px solid #1f1f1f", borderRadius: "4px 18px 18px 18px" }
                    }
                  >
                    {msg.content}
                  </div>
                  <div className="text-[10px] px-1" style={{ color: "#3f3f46" }}>
                    {timeStr(msg.created_at)}
                  </div>
                </div>
              </div>
            );
          })}
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
              disabled={!input.trim()}
              className="px-4 py-3 rounded-xl text-sm font-semibold transition-colors duration-150"
              style={{ background: input.trim() ? "#f59e0b" : "#1f1f1f", color: input.trim() ? "#0a0a0a" : "#3f3f46" }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
