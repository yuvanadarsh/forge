"use client";

import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

interface Props {
  planMd: string;
  collapsed: boolean;
  onToggle: () => void;
}

export default function PipelineExecutionPlan({ planMd, collapsed, onToggle }: Props) {
  return (
    <div className="relative flex shrink-0" style={{ width: collapsed ? "0px" : "280px", transition: "width 200ms" }}>
      {/* Panel content — overflow:hidden only wraps the content, not the toggle button */}
      <div
        className="flex flex-col border-r"
        style={{
          width: collapsed ? "0px" : "280px",
          background: "#111111",
          borderColor: "#1f1f1f",
          overflow: "hidden",
          transition: "width 200ms",
          flexShrink: 0,
        }}
      >
        <div className="px-4 py-4 border-b shrink-0" style={{ borderColor: "#1f1f1f" }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#71717a" }}>
            Execution Plan
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {planMd ? (
            <div className="text-xs leading-relaxed" style={{ color: "#a1a1aa" }}>
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

      {/* Toggle button — sibling to the overflow:hidden div, always visible */}
      <button
        onClick={onToggle}
        className="absolute top-4 -right-6 z-10 w-6 h-6 flex items-center justify-center rounded-r-lg text-xs transition-colors duration-150"
        style={{ background: "#1f1f1f", color: "#71717a", border: "1px solid #2a2a2a", borderLeft: "none" }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#f5f5f5")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#71717a")}
        title={collapsed ? "Expand plan" : "Collapse plan"}
      >
        {collapsed ? "▶" : "◀"}
      </button>
    </div>
  );
}
