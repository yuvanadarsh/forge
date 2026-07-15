"use client";

import { useEffect, useRef, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { deleteConversation } from "@/lib/api";
import { useForge } from "@/lib/store";

export default function ConversationMenu({
  conversationId,
  onRename,
  onDeleted,
}: {
  conversationId: string;
  onRename: () => void;
  onDeleted: () => void;
}) {
  const { dispatch } = useForge();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteConversation(conversationId);
      dispatch({ type: "DELETE_CONVERSATION", conversationId });
      onDeleted();
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <div className="relative" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors duration-150"
        style={{ color: "#71717a", background: open ? "#1a1a1a" : "transparent" }}
        aria-label="Conversation options"
      >
        ⋯
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-36 rounded-lg border py-1 z-20"
          style={{ background: "#161616", borderColor: "#1f1f1f" }}
        >
          <button
            onClick={() => {
              setOpen(false);
              onRename();
            }}
            className="w-full text-left px-3 py-2 text-xs transition-colors duration-150 hover:bg-[#1f1f1f]"
            style={{ color: "#f5f5f5" }}
          >
            Rename
          </button>
          <button
            onClick={() => {
              setOpen(false);
              setConfirming(true);
            }}
            className="w-full text-left px-3 py-2 text-xs transition-colors duration-150 hover:bg-[#1f1f1f]"
            style={{ color: "#ef4444" }}
          >
            Delete
          </button>
        </div>
      )}
      {confirming && (
        <ConfirmDialog
          title="Delete this conversation?"
          message="This cannot be undone."
          confirmLabel={deleting ? "Deleting…" : "Delete"}
          onConfirm={handleDelete}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
