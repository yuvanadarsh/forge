"use client";

import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

const OPEN_WIDTH = 280;
const COLLAPSED_WIDTH = 32;

interface Props {
  planMd: string;
  collapsed: boolean;
  onToggle: () => void;
}

export default function PipelineExecutionPlan({ planMd, collapsed, onToggle }: Props) {
  return (
    <div
      className="relative shrink-0 border-r z-10"
      style={{
        width: collapsed ? COLLAPSED_WIDTH : OPEN_WIDTH,
        transition: "width 200ms ease",
        background: "#111111",
        borderColor: "#1f1f1f",
        overflow: "hidden",
      }}
    >
      {/* Open panel — full width content that slides out to the left */}
      <div
        className="absolute inset-y-0 left-0 flex flex-col"
        style={{
          width: OPEN_WIDTH,
          transform: collapsed ? `translateX(-${OPEN_WIDTH}px)` : "translateX(0)",
          transition: "transform 200ms ease",
        }}
        aria-hidden={collapsed}
      >
        <div
          className="px-4 py-4 border-b shrink-0 flex items-center justify-between"
          style={{ borderColor: "#1f1f1f" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#71717a" }}>
            Execution Plan
          </p>
          <button
            onClick={onToggle}
            aria-label="Collapse execution plan"
            title="Collapse plan"
            className="w-6 h-6 flex items-center justify-center rounded-lg text-sm transition-colors duration-150"
            style={{ color: "#71717a", border: "1px solid #2a2a2a" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#f5f5f5")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#71717a")}
          >
            ‹
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {planMd ? (
            <div className="markdown-body text-xs leading-relaxed" style={{ color: "#a1a1aa" }}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  h1: ({ children }) => <h1 className="font-bold mb-2 mt-3 first:mt-0" style={{ color: "#f5f5f5", fontSize: "0.8rem" }}>{children}</h1>,
                  h2: ({ children }) => <h2 className="font-semibold mb-1.5 mt-3 first:mt-0" style={{ color: "#e4e4e7", fontSize: "0.75rem" }}>{children}</h2>,
                  h3: ({ children }) => <h3 className="font-medium mb-1 mt-2" style={{ color: "#d4d4d8", fontSize: "0.7rem" }}>{children}</h3>,
                  strong: ({ children }) => <strong style={{ color: "#f5f5f5", fontWeight: 600 }}>{children}</strong>,
                  li: ({ children }) => <li className="mb-0.5 ml-3" style={{ listStyleType: "disc" }}>{children}</li>,
                  ul: ({ children }) => <ul className="mb-2 space-y-0.5">{children}</ul>,
                  hr: () => (
                    <hr style={{ border: "none", borderTop: "1px solid #2a2a2a", margin: "0.75em 0" }} />
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "#2a2a2a" }}>
                      <table>{children}</table>
                    </div>
                  ),
                  input: ({ checked }) => (
                    <input
                      type="checkbox"
                      checked={checked ?? false}
                      disabled
                      className="mr-1.5 align-middle"
                      style={{ accentColor: "#f59e0b" }}
                      readOnly
                    />
                  ),
                }}
              >
                {planMd}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-xs" style={{ color: "#3f3f46" }}>No execution plan yet.</p>
          )}
        </div>
      </div>

      {/* Collapsed tab — thin strip with 📋 and a rotated "Plan" label */}
      <button
        onClick={onToggle}
        aria-label="Open execution plan"
        title="Open plan"
        className="absolute inset-0 flex flex-col items-center gap-2 pt-4 transition-colors duration-150"
        style={{
          opacity: collapsed ? 1 : 0,
          pointerEvents: collapsed ? "auto" : "none",
          transition: "opacity 200ms ease",
          color: "#71717a",
          background: "transparent",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#f5f5f5")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#71717a")}
      >
        <span className="text-sm" aria-hidden>📋</span>
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ writingMode: "vertical-rl" }}
        >
          Plan
        </span>
      </button>
    </div>
  );
}
