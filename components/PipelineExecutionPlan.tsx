"use client";

import ReactMarkdown from "react-markdown";

interface Props {
  planMd: string;
  collapsed: boolean;
  onToggle: () => void;
}

export default function PipelineExecutionPlan({ planMd, collapsed, onToggle }: Props) {
  return (
    <div
      className="relative flex flex-col shrink-0 border-r transition-all duration-200"
      style={{
        width: collapsed ? "0px" : "280px",
        background: "#111111",
        borderColor: "#1f1f1f",
        overflow: "hidden",
      }}
    >
      {/* Toggle button — always visible, pinned to the right edge */}
      <button
        onClick={onToggle}
        className="absolute top-4 -right-7 z-10 w-6 h-6 flex items-center justify-center rounded-r-lg text-xs transition-colors duration-150"
        style={{ background: "#1f1f1f", color: "#71717a", border: "1px solid #2a2a2a", borderLeft: "none" }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#f5f5f5")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#71717a")}
        title={collapsed ? "Expand plan" : "Collapse plan"}
      >
        {collapsed ? "▶" : "◀"}
      </button>

      {!collapsed && (
        <>
          <div className="px-4 py-4 border-b shrink-0" style={{ borderColor: "#1f1f1f" }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#71717a" }}>
              Execution Plan
            </p>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {planMd ? (
              <div className="text-xs leading-relaxed markdown-body" style={{ color: "#a1a1aa" }}>
                <ReactMarkdown>{planMd}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-xs" style={{ color: "#3f3f46" }}>No execution plan yet.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
