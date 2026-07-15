"use client";

import { useState } from "react";
import { listAgents, listConversations, listTasks } from "@/lib/api";

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const EXPORTS = [
  { label: "Export Agents", filename: "forge-agents.json", fetcher: () => listAgents() },
  { label: "Export Tasks", filename: "forge-tasks.json", fetcher: () => listTasks() },
  {
    label: "Export Conversations",
    filename: "forge-conversations.json",
    fetcher: () => listConversations(),
  },
] as const;

interface Props {
  showToast?: (msg: string) => void;
}

export default function ExportSection({ showToast }: Props) {
  const [exporting, setExporting] = useState<string | null>(null);

  async function handleExport(label: string, filename: string, fetcher: () => Promise<unknown>) {
    if (exporting) return;
    setExporting(label);
    try {
      downloadJson(await fetcher(), filename);
    } catch (err) {
      showToast?.(
        `Export failed: ${err instanceof Error ? err.message : "backend unreachable"}`,
      );
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      {EXPORTS.map(({ label, filename, fetcher }) => (
        <button
          key={label}
          onClick={() => handleExport(label, filename, fetcher)}
          disabled={exporting !== null}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150"
          style={{ background: "#1f1f1f", color: "#f5f5f5" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#2a2a2a"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#1f1f1f"; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {exporting === label ? "Exporting…" : label}
        </button>
      ))}
    </div>
  );
}
