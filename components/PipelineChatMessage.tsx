"use client";

import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";

export interface PipelineChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  agentName?: string;
  agentColor?: string;
  created_at: string;
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
}

export default function PipelineChatMessage({ msg }: Props) {
  const isUser = msg.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1"
        style={
          isUser
            ? { background: "#1f1f1f", color: "#71717a" }
            : { background: msg.agentColor ?? "#3b82f6", color: "#fff" }
        }
      >
        {isUser ? "Y" : (msg.agentName?.[0] ?? "A")}
      </div>

      <div className={`max-w-[70%] flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}>
        {!isUser && msg.agentName && (
          <div className="text-[10px] font-medium px-1" style={{ color: "#71717a" }}>
            {msg.agentName}
          </div>
        )}
        <div
          className="px-4 py-3 text-sm leading-relaxed markdown-body"
          style={
            isUser
              ? { background: "#1f1f1f", color: "#f5f5f5", borderRadius: "18px 4px 18px 18px" }
              : { background: "#1a1a1a", color: "#f5f5f5", border: "1px solid #1f1f1f", borderRadius: "4px 18px 18px 18px" }
          }
        >
          {isUser ? (
            <span className="whitespace-pre-wrap">{renderWithMentions(msg.content)}</span>
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
}
