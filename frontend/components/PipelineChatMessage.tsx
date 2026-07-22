"use client";

import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { chatMarkdownComponents } from "@/components/chat/CodeBlock";
import type { BackendAgent } from "@/types";

export interface PipelineChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  agentName?: string;
  agentColor?: string;
  sender_agent_id?: string;
  relay_to_agent_name?: string;
  created_at: string;
  type?: "message" | "approval_gate";
  approvalSummary?: string;
  approvalWhatNext?: string;
}

function timeStr(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderWithMentions(text: string) {
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, i) =>
    /^@\w+$/.test(part)
      ? <span key={i} style={{ color: "#f59e0b" }}>{part}</span>
      : <span key={i}>{part}</span>
  );
}

interface Props {
  msg: PipelineChatMsg;
  participants?: BackendAgent[];
}

export default function PipelineChatMessage({ msg, participants = [] }: Props) {
  const isUser = msg.role === "user";

  // Determine if this is a relay (agent sending to another agent)
  const isRelay = !isUser && !!msg.relay_to_agent_name;

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className="flex flex-col items-center gap-1 shrink-0">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-1"
          style={
            isUser
              ? { background: "#1e3a5f", color: "#fff" }
              : { background: msg.agentColor ?? "#3b82f6", color: "#fff" }
          }
        >
          {isUser ? "Y" : (msg.agentName?.[0] ?? "A")}
        </div>
        {isRelay && (
          <div className="text-[9px] leading-tight text-center px-0.5" style={{ color: "#52525b" }}>
            ↪ {msg.relay_to_agent_name}
          </div>
        )}
      </div>

      <div className={`max-w-[70%] flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
        {!isUser && msg.agentName && (
          <div className="flex items-center gap-2 px-1">
            <span className="text-[10px] font-medium" style={{ color: "#71717a" }}>
              {msg.agentName}
            </span>
            {isRelay && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: "#1a1a1a", color: "#52525b", border: "1px solid #2a2a2a" }}>
                → {msg.relay_to_agent_name}
              </span>
            )}
          </div>
        )}
        <div
          className="px-4 py-3 text-sm leading-relaxed markdown-body"
          style={
            isUser
              ? { background: "#1e3a5f", color: "#f5f5f5", borderRadius: "18px 4px 18px 18px" }
              : {
                  background: "#1a1a1a",
                  color: "#f5f5f5",
                  border: `1px solid ${isRelay ? "#2a2000" : "#1f1f1f"}`,
                  borderRadius: "4px 18px 18px 18px",
                }
          }
        >
          {isUser ? (
            <span className="whitespace-pre-wrap">{renderWithMentions(msg.content)}</span>
          ) : (
            <ReactMarkdown rehypePlugins={[rehypeHighlight]} components={chatMarkdownComponents}>
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
}
