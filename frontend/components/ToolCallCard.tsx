"use client";

/** Dark monospace card for one agent tool invocation — used for both live
 *  WebSocket tool events and persisted role='tool_call' history messages. */

export function summarizeToolArgs(args: Record<string, unknown>): string {
  if (typeof args.path === "string") return args.path;
  if (typeof args.command === "string") return args.command;
  if (typeof args.query === "string") return args.query;
  return "";
}

interface Props {
  agentName: string;
  tool: string;
  argSummary?: string;
  resultSummary?: string;
  running?: boolean;
}

export default function ToolCallCard({
  agentName,
  tool,
  argSummary,
  resultSummary,
  running = false,
}: Props) {
  return (
    <div
      className={`rounded-xl border px-4 py-2.5 text-xs font-mono ${running ? "animate-pulse" : ""}`}
      style={{ background: "#141414", borderColor: "#1f1f1f", color: "#71717a" }}
    >
      🔧 {agentName} {running ? "is calling" : "called"}{" "}
      <span style={{ color: "#f59e0b" }}>{tool}</span>
      {argSummary && <span style={{ color: "#a1a1aa" }}> on {argSummary}</span>}
      {resultSummary !== undefined && (
        <div className="mt-1.5 truncate" style={{ color: "#52525b" }}>
          ↳ {resultSummary.slice(0, 200)}
        </div>
      )}
    </div>
  );
}
