"use client";

import { useState } from "react";
import AgentCard from "@/components/AgentCard";
import CreateAgentModal from "@/components/CreateAgentModal";
import EmptyState from "@/components/EmptyState";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import Toast from "@/components/Toast";
import { useForge } from "@/lib/store";
import type { BackendAgent } from "@/types";

export default function AgentsPage() {
  const { state, dispatch } = useForge();
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { agents, tasks, loading } = state;

  function getCurrentTask(agentId: string) {
    return tasks.find((t) => t.assigned_to === agentId && t.status === "in_progress");
  }

  function handleCreated(agent: BackendAgent) {
    dispatch({ type: "ADD_AGENT", agent });
    setShowModal(false);
    setToast(`Agent "${agent.name}" created`);
  }

  return (
    <div className="px-8 py-8 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#f5f5f5" }}>Agent Registry</h1>
          <p className="text-sm mt-1" style={{ color: "#71717a" }}>
            {loading.agents ? "Loading agents…" : `${agents.length} agents registered`}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-150"
          style={{ background: "#f59e0b", color: "#0a0a0a" }}
          onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.background = "#d97706")}
          onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.background = "#f59e0b")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Create Agent
        </button>
      </div>

      {loading.agents ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 items-stretch">
          <LoadingSkeleton variant="card" count={9} />
        </div>
      ) : agents.length === 0 ? (
        <EmptyState
          icon="🤖"
          title="No agents yet."
          description="Create your first agent."
          action={{ label: "Create Agent", onClick: () => setShowModal(true) }}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4 items-stretch">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              currentTask={getCurrentTask(agent.id)}
              onDeleted={setToast}
              onError={setToast}
            />
          ))}
        </div>
      )}

      {showModal && (
        <CreateAgentModal
          onClose={() => setShowModal(false)}
          onCreate={handleCreated}
          onError={(message) => setToast(`Could not create agent: ${message}`)}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
