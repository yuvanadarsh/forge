"use client";

import { useEffect, useRef, useState } from "react";
import {
  downloadMarkdown,
  exportAsPdf,
  type ConversationExportInput,
} from "@/lib/export";

interface Props {
  input: ConversationExportInput;
  onError?: (message: string) => void;
}

/** "Export ↓" dropdown in the pipeline chat header — Markdown download or
 *  print-to-PDF via a new window. */
export default function ExportMenu({ input, onError }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function handleMarkdown() {
    setOpen(false);
    downloadMarkdown(input);
  }

  function handlePdf() {
    setOpen(false);
    if (!exportAsPdf(input)) {
      onError?.("Popup blocked — allow popups for this site to export as PDF.");
    }
  }

  const item =
    "w-full text-left px-3 py-2.5 text-xs transition-colors duration-150";

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs px-3 py-1.5 rounded-lg border transition-colors duration-150"
        style={{
          color: open ? "#f5f5f5" : "#a1a1aa",
          borderColor: open ? "#3f3f46" : "#2a2a2a",
          background: "transparent",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#f5f5f5")}
        onMouseLeave={(e) => {
          if (!open) (e.currentTarget as HTMLButtonElement).style.color = "#a1a1aa";
        }}
      >
        Export ↓
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 rounded-xl border overflow-hidden z-30"
          style={{
            background: "#161616",
            borderColor: "#2a2a2a",
            minWidth: "180px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}
        >
          <button
            className={item}
            style={{ color: "#e4e4e7" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(245,158,11,0.1)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
            onClick={handlePdf}
          >
            Export as PDF
          </button>
          <button
            className={item}
            style={{ color: "#e4e4e7" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "rgba(245,158,11,0.1)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "transparent")}
            onClick={handleMarkdown}
          >
            Export as Markdown
          </button>
        </div>
      )}
    </div>
  );
}
