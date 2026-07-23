"use client";

import { useRef, useState, useEffect } from "react";
import {
  AttachImageButton,
  imageFilesFromDrop,
  ImagePreviewRow,
  fileToChatImage,
  MAX_IMAGES_PER_MESSAGE,
  type ChatImage,
} from "@/components/chat/ImageAttachment";
import type { BackendAgent } from "@/types";

const MAX_TEXTAREA_LINES = 6;
const LINE_HEIGHT_PX = 20;

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  participants?: BackendAgent[];
  disabled?: boolean;
  placeholder?: string;
  /** Staged image attachments (up to 4); omit to hide the attach button. */
  images?: ChatImage[];
  onImagesChange?: (images: ChatImage[]) => void;
  onImageError?: (message: string) => void;
}

export default function PipelineChatInput({
  value,
  onChange,
  onSend,
  participants = [],
  disabled = false,
  placeholder = "Message the pipeline... (type @ to mention an agent)",
  images = [],
  onImagesChange,
  onImageError,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [focused, setFocused] = useState(false);
  // Escape hides the picker for the value it was pressed on; typing anything
  // (value changes) brings it back — same behavior the old effect had.
  const [dismissedForValue, setDismissedForValue] = useState<string | null>(null);

  // @mention detection is derived from the input value, not synced state.
  const atIdx = value.lastIndexOf("@");
  const afterAt = atIdx === -1 ? null : value.slice(atIdx + 1);
  // A space after the @ ends the mention
  const detectedQuery =
    afterAt === null || afterAt.includes(" ") ? null : afterAt.toLowerCase();
  const mentionQuery = dismissedForValue === value ? null : detectedQuery;

  // Reset the highlighted row whenever the query changes — render-phase
  // state adjustment (React's documented pattern), not a setState-in-effect.
  const [prevQuery, setPrevQuery] = useState(mentionQuery);
  if (prevQuery !== mentionQuery) {
    setPrevQuery(mentionQuery);
    setMentionIndex(0);
  }

  // Auto-resize up to MAX_TEXTAREA_LINES, then scroll internally.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = MAX_TEXTAREA_LINES * LINE_HEIGHT_PX;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [value]);

  const filtered = mentionQuery !== null
    ? participants.filter((a) => a.name.toLowerCase().startsWith(mentionQuery))
    : [];

  function insertMention(agent: BackendAgent) {
    // The trailing space after the inserted name ends the mention, so the
    // derived query is null for the new value — no explicit dismissal needed.
    const before = value.slice(0, value.lastIndexOf("@"));
    onChange(before + `@${agent.name} `);
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
        setDismissedForValue(value);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  const remainingSlots = MAX_IMAGES_PER_MESSAGE - images.length;

  async function addFiles(files: File[]) {
    if (!onImagesChange || files.length === 0) return;
    const accepted = files.slice(0, Math.max(0, remainingSlots));
    try {
      const added = await Promise.all(accepted.map(fileToChatImage));
      onImagesChange([...images, ...added]);
    } catch (err) {
      onImageError?.(err instanceof Error ? err.message : "Could not attach image");
    }
  }

  return (
    <div
      className="px-6 py-4 border-t shrink-0 relative"
      style={{
        borderColor: dragActive ? "#f59e0b" : "#1f1f1f",
        borderStyle: dragActive ? "dashed" : "solid",
      }}
      onDragOver={(e) => {
        if (!onImagesChange || disabled) return;
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        if (!onImagesChange || disabled) return;
        e.preventDefault();
        setDragActive(false);
        void addFiles(imageFilesFromDrop(e));
      }}
    >
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

      {onImagesChange && (
        <ImagePreviewRow
          images={images}
          onRemove={(index) => onImagesChange(images.filter((_, i) => i !== index))}
        />
      )}
      <div className="flex gap-3 items-end">
        {onImagesChange && (
          <AttachImageButton
            onSelect={(added) => onImagesChange([...images, ...added])}
            onError={(message) => onImageError?.(message)}
            disabled={disabled}
            remainingSlots={remainingSlots}
          />
        )}
        <textarea
          ref={ref}
          value={value}
          rows={1}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className="flex-1 px-4 py-3 rounded-xl text-sm outline-none border transition-colors duration-150 resize-none disabled:cursor-not-allowed"
          style={{ background: "#111111", borderColor: focused ? "#f59e0b" : "#1f1f1f", color: "#f5f5f5", lineHeight: `${LINE_HEIGHT_PX}px` }}
        />
        <button
          onClick={onSend}
          disabled={disabled || (!value.trim() && images.length === 0)}
          className="px-4 py-3 rounded-xl text-sm font-semibold transition-colors duration-150 shrink-0 disabled:cursor-not-allowed"
          style={{
            background: !disabled && (value.trim() || images.length > 0) ? "#f59e0b" : "#1f1f1f",
            color: !disabled && (value.trim() || images.length > 0) ? "#0a0a0a" : "#3f3f46",
          }}
        >
          Send
        </button>
      </div>
      {focused && (
        <div className="text-[10px] px-1 pt-1.5" style={{ color: "#3f3f46" }}>
          Enter to send · Shift+Enter for new line
        </div>
      )}
    </div>
  );
}
