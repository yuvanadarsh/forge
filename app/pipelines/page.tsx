"use client";

import { useState } from "react";
import { mockPipelines, mockAgents } from "@/lib/mock-data";
import type { Pipeline } from "@/types";
import EditPipelineModal from "@/components/EditPipelineModal";

const STATUS_STYLES = {
  pending_approval: { label: "Pending Approval", color: "#f59e0b", bg: "#2a1a00" },
  approved: { label: "Approved", color: "#3b82f6", bg: "#0a1a2a" },
  running: { label: "Running", color: "#22c55e", bg: "#0a1a0a" },
  completed: { label: "Completed", color: "#71717a", bg: "#1a1a1a" },
};

function MarkdownBlock({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="text-sm leading-relaxed space-y-1" style={{ color: "#a1a1aa" }}>
      {lines.map((line, i) => {
        if (line.startsWith("# ")) return <h1 key={i} className="text-base font-bold mt-4 mb-2" style={{ color: "#f5f5f5" }}>{line.slice(2)}</h1>;
        if (line.startsWith("## ")) return <h2 key={i} className="text-sm font-semibold mt-3 mb-1" style={{ color: "#f5f5f5" }}>{line.slice(3)}</h2>;
        if (line.startsWith("- [ ] ")) return <div key={i} className="flex items-start gap-2 py-0.5"><span className="mt-0.5 w-3.5 h-3.5 rounded border shrink-0" style={{ borderColor: "#3f3f46" }} /><span>{line.slice(6)}</span></div>;
        if (line.startsWith("- ")) return <div key={i} className="flex items-start gap-2 py-0.5"><span className="mt-2 w-1 h-1 rounded-full shrink-0" style={{ background: "#71717a" }} /><span>{line.slice(2)}</span></div>;
        if (line.startsWith("**") && line.endsWith("**")) return <p key={i} className="font-semibold" style={{ color: "#ef4444" }}>{line.slice(2, -2)}</p>;
        if (line === "") return <div key={i} className="h-1" />;
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

export default function PipelinesPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>(mockPipelines);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null);

  function handleSavePipeline(updated: Pipeline) {
    setPipelines((prev) => prev.map((p) => p.id === updated.id ? updated : p));
    setEditingPipeline(null);
  }

  return (
    <div className="px-8 py-8 max-w-[900px] mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "#f5f5f5" }}>Pipelines</h1>
        <p className="text-sm mt-1" style={{ color: "#71717a" }}>
          {pipelines.length} pipelines · {pipelines.filter((p) => p.status === "running").length} running
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {pipelines.map((pipeline) => {
          const s = STATUS_STYLES[pipeline.status];
          const isOpen = expanded === pipeline.id;
          const pipelineAgents = pipeline.agents.map((aid) => mockAgents.find((a) => a.id === aid)).filter(Boolean);

          return (
            <div
              key={pipeline.id}
              className="rounded-xl border overflow-hidden"
              style={{ background: "#111111", borderColor: "#1f1f1f" }}
            >
              {/* Header */}
              <div className="flex items-start gap-4 p-5">
                <button
                  onClick={() => setExpanded(isOpen ? null : pipeline.id)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-base font-semibold" style={{ color: "#f5f5f5" }}>
                      {pipeline.title}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ color: s.color, background: s.bg }}
                    >
                      {s.label}
                    </span>
                  </div>
                  <p className="text-sm mb-3" style={{ color: "#71717a" }}>{pipeline.description}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {pipelineAgents.map((agent, idx) => {
                      if (!agent) return null;
                      return (
                        <div key={agent.id} className="flex items-center gap-1">
                          <span
                            className="w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center"
                            style={{ background: agent.avatar_color, color: "#fff" }}
                          >
                            {agent.name[0]}
                          </span>
                          <span className="text-xs" style={{ color: "#71717a" }}>{agent.name}</span>
                          {idx < pipelineAgents.length - 1 && (
                            <span className="text-xs mx-0.5" style={{ color: "#3f3f46" }}>→</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </button>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 mt-0.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingPipeline(pipeline); }}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors duration-150"
                    style={{ background: "#1f1f1f", color: "#71717a" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#f5f5f5"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#71717a"; }}
                  >
                    Edit
                  </button>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    onClick={() => setExpanded(isOpen ? null : pipeline.id)}
                    className="cursor-pointer transition-transform duration-150"
                    style={{ color: "#71717a", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              {/* Expanded plan */}
              {isOpen && (
                <div className="border-t px-5 py-5" style={{ borderColor: "#1f1f1f" }}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "#71717a" }}>
                    Execution Plan
                  </h3>
                  <MarkdownBlock content={pipeline.plan_md} />
                  {pipeline.status === "pending_approval" && (
                    <div className="mt-6 flex gap-3">
                      <button
                        className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-150"
                        style={{ background: "#22c55e", color: "#0a0a0a" }}
                      >
                        Approve Pipeline
                      </button>
                      <button
                        className="px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-150"
                        style={{ background: "#1f1f1f", color: "#71717a" }}
                      >
                        Request Changes
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editingPipeline && (
        <EditPipelineModal
          pipeline={editingPipeline}
          allAgents={mockAgents}
          onClose={() => setEditingPipeline(null)}
          onSave={handleSavePipeline}
        />
      )}
    </div>
  );
}
