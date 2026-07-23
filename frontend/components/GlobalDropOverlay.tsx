"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Toast from "@/components/Toast";
import { ACCEPTED_IMAGE_TYPES } from "@/components/chat/ImageAttachment";

const ALLOWED_TYPES = ACCEPTED_IMAGE_TYPES.split(",");

// Matches the chat-input pages that listen for 'forge:image-dropped'.
const CHAT_PAGE_PATTERNS = [/^\/agents\/[^/]+\/conversations\/[^/]+$/, /^\/pipelines\/[^/]+\/chat$/];

function imageFilesFromDataTransfer(dt: DataTransfer | null): File[] {
  return Array.from(dt?.files ?? []).filter((f) => ALLOWED_TYPES.includes(f.type));
}

/** Page-wide drag-and-drop target for image attachments (Discord/Slack-style). */
export default function GlobalDropOverlay() {
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    function onDragOver(e: DragEvent) {
      e.preventDefault();
      setDragging(true);
    }
    function onDragLeave(e: DragEvent) {
      // Only hide once the drag has actually left the viewport, not just
      // moved between child elements (which also fire dragleave).
      if (!e.relatedTarget) setDragging(false);
    }
    function onDrop(e: DragEvent) {
      e.preventDefault();
      setDragging(false);
      const files = imageFilesFromDataTransfer(e.dataTransfer);
      if (files.length === 0) return;

      const onChatPage = CHAT_PAGE_PATTERNS.some((re) => re.test(pathname ?? ""));
      if (onChatPage) {
        window.dispatchEvent(new CustomEvent("forge:image-dropped", { detail: { files } }));
      } else {
        setToast("Navigate to a chat to attach images");
      }
    }

    document.addEventListener("dragover", onDragOver);
    document.addEventListener("dragleave", onDragLeave);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("dragleave", onDragLeave);
      document.removeEventListener("drop", onDrop);
    };
  }, [pathname]);

  return (
    <>
      {dragging && (
        <div
          className="fixed inset-0 flex items-center justify-center pointer-events-none"
          style={{ background: "rgba(0,0,0,0.7)", zIndex: 9999 }}
        >
          <div
            className="flex flex-col items-center justify-center gap-3 px-16 py-12 rounded-2xl border-2 border-dashed"
            style={{ borderColor: "#f59e0b" }}
          >
            <span style={{ fontSize: "48px", lineHeight: 1 }}>📎</span>
            <div className="text-2xl font-semibold" style={{ color: "#f5f5f5" }}>
              Drop image to attach
            </div>
            <div className="text-sm" style={{ color: "#71717a" }}>
              Supports PNG, JPG, GIF, WebP
            </div>
          </div>
        </div>
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </>
  );
}
