"use client";

import { useRef, useState, useEffect } from "react";
import type { BackendAgent } from "@/types";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  participants?: BackendAgent[];
  disabled?: boolean;
  placeholder?: string;
}

export default function PipelineChatInput({
  value,
  onChange,
  onSend,
  participants = [],
  disabled = false,
  placeholder = "Message the pipeline... (type @ to mention an agent)",
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  // Detect @mention as user types
  useEffect(() => {
    const atIdx = value.lastIndexOf("@");
    if (atIdx === -1) {
      setMentionQuery(null);
      return;
    }
    const afterAt = value.slice(atIdx + 1);
    // Dismiss if space typed after @
    if (afterAt.includes(" ")) {
      setMentionQuery(null);
      return;
    }
    setMentionQuery(afterAt.toLowerCase());
    setMentionIndex(0);
  }, [value]);

  const filtered = mentionQuery !== null
    ? participants.filter((a) => a.name.toLowerCase().startsWith(mentionQuery))
    : [];

  function insertMention(agent: BackendAgent) {
    const atIdx = value.lastIndexOf("@");
    const before = value.slice(0, atIdx);
    onChange(before + `@${agent.name} `);
    setMentionQuery(null);
    ref.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (filtered.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % filtered.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        insertMention(filtered[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        setMentionQuery(null);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <div className="px-6 py-4 border-t shrink-0 relative" style={{ borderColor: "#1f1f1f" }}>
      {/* @mention picker */}
      {filtered.length > 0 && (
        <div
          className="absolute bottom-full left-6 mb-2 rounded-xl border overflow-hidden z-30"
          style={{ background: "#161616", borderColor: "#2a2a2a", minWidth: "220px", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}
        >
          {filtered.map((agent, idx) => (
            <button
              key={agent.id}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors duration-100"
              style={{
                background: idx === mentionIndex ? "rgba(245,158,11,0.1)" : "transparent",
                color: idx === mentionIndex ? "#f5f5f5" : "#a1a1aa",
              }}
              onMouseEnter={() => setMentionIndex(idx)}
              onClick={() => insertMention(agent)}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                style={{ background: agent.avatar_color, color: "#fff" }}
              >
                {agent.name[0]}
              </div>
              <div>
                <div className="font-medium text-xs" style={{ color: idx === mentionIndex ? "#f5f5f5" : "#e4e4e7" }}>
                  {agent.name}
                </div>
                <div className="text-[10px]" style={{ color: "#52525b" }}>{agent.role}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-3 items-end">
        <textarea
          ref={ref}
          value={value}
          rows={2}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 px-4 py-3 rounded-xl text-sm outline-none border transition-colors duration-150 resize-none disabled:cursor-not-allowed"
          style={{ background: "#111111", borderColor: "#1f1f1f", color: "#f5f5f5" }}
          onFocus={(e) => (e.target.style.borderColor = "#f59e0b")}
          onBlur={(e) => (e.target.style.borderColor = "#1f1f1f")}
        />
        <button
          onClick={onSend}
          disabled={disabled || !value.trim()}
          className="px-4 py-3 rounded-xl text-sm font-semibold transition-colors duration-150 shrink-0 disabled:cursor-not-allowed"
          style={{
            background: !disabled && value.trim() ? "#f59e0b" : "#1f1f1f",
            color: !disabled && value.trim() ? "#0a0a0a" : "#3f3f46",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
