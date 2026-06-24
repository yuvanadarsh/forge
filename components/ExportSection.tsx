"use client";

import { mockAgents, mockTasks, mockConversations } from "@/lib/mock-data";

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
  { label: "Export Agents", fn: () => downloadJson(mockAgents, "forge-agents.json") },
  { label: "Export Tasks", fn: () => downloadJson(mockTasks, "forge-tasks.json") },
  { label: "Export Conversations", fn: () => downloadJson(mockConversations, "forge-conversations.json") },
];

export default function ExportSection() {
  return (
    <div className="flex flex-wrap gap-3">
      {EXPORTS.map(({ label, fn }) => (
        <button
          key={label}
          onClick={fn}
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
          {label}
        </button>
      ))}
    </div>
  );
}
