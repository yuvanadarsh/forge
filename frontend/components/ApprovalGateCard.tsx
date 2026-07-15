"use client";

import { useState } from "react";

interface Props {
  summary: string;
  whatNext: string;
  onApprove?: () => void;
}

export default function ApprovalGateCard({ summary, whatNext, onApprove }: Props) {
  const [state, setState] = useState<"pending" | "approved" | "changes">("pending");
  const [feedback, setFeedback] = useState("");

  function handleApprove() {
    setState("approved");
    onApprove?.();
  }

  return (
    <div
      className="rounded-xl border-l-4 px-5 py-4 my-2"
      style={{
        background: "#141414",
        borderTop: "1px solid #2a2a2a",
        borderRight: "1px solid #2a2a2a",
        borderBottom: "1px solid #2a2a2a",
        borderLeft: `4px solid ${state === "approved" ? "#22c55e" : "#f59e0b"}`,
      }}
    >
      {state === "approved" ? (
        <div className="flex items-center gap-2">
          <span className="text-lg">✓</span>
          <span className="text-sm font-semibold" style={{ color: "#22c55e" }}>Approved — pipeline continuing to Phase 2</span>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">⏸</span>
            <span className="text-sm font-semibold" style={{ color: "#f59e0b" }}>Awaiting Your Approval</span>
          </div>

          <div className="text-xs leading-relaxed mb-1" style={{ color: "#a1a1aa" }}>
            <span className="font-medium" style={{ color: "#e4e4e7" }}>Completed: </span>{summary}
          </div>
          <div className="text-xs leading-relaxed mb-4" style={{ color: "#a1a1aa" }}>
            <span className="font-medium" style={{ color: "#e4e4e7" }}>Up next: </span>{whatNext}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleApprove}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-150"
              style={{ background: "#166534", color: "#86efac", border: "1px solid #15803d" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#14532d")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#166534")}
            >
              Approve →
            </button>
            <button
              onClick={() => setState("changes")}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-150"
              style={{ background: "transparent", color: "#a1a1aa", border: "1px solid #2a2a2a" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#3f3f46"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#2a2a2a"; }}
            >
              Request Changes
            </button>
          </div>

          {state === "changes" && (
            <div className="mt-3">
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                placeholder="Describe the changes you'd like before proceeding..."
                className="w-full px-3 py-2.5 rounded-lg text-xs outline-none border resize-none transition-colors duration-150"
                style={{ background: "#0a0a0a", borderColor: "#2a2a2a", color: "#f5f5f5" }}
                onFocus={(e) => (e.target.style.borderColor = "#f59e0b")}
                onBlur={(e) => (e.target.style.borderColor = "#2a2a2a")}
              />
              <button
                disabled={!feedback.trim()}
                className="mt-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors duration-150"
                style={{
                  background: feedback.trim() ? "#f59e0b" : "#1f1f1f",
                  color: feedback.trim() ? "#0a0a0a" : "#3f3f46",
                }}
              >
                Send Feedback
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
