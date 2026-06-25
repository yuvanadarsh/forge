"use client";

import { useRef } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
}

export default function PipelineChatInput({ value, onChange, onSend }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <div className="px-6 py-4 border-t shrink-0" style={{ borderColor: "#1f1f1f" }}>
      {/* TODO: add @mention inline amber highlighting via contenteditable overlay if needed */}
      <div className="flex gap-3 items-end">
        <textarea
          ref={ref}
          value={value}
          rows={2}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message the pipeline... (use @AgentName to direct a message)"
          className="flex-1 px-4 py-3 rounded-xl text-sm outline-none border transition-colors duration-150 resize-none"
          style={{ background: "#111111", borderColor: "#1f1f1f", color: "#f5f5f5" }}
          onFocus={(e) => (e.target.style.borderColor = "#f59e0b")}
          onBlur={(e) => (e.target.style.borderColor = "#1f1f1f")}
        />
        <button
          onClick={onSend}
          disabled={!value.trim()}
          className="px-4 py-3 rounded-xl text-sm font-semibold transition-colors duration-150 shrink-0"
          style={{
            background: value.trim() ? "#f59e0b" : "#1f1f1f",
            color: value.trim() ? "#0a0a0a" : "#3f3f46",
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
