"use client";

import { useState } from "react";
import AgentCard from "@/components/AgentCard";
import { mockAgents, mockTasks } from "@/lib/mock-data";
import type { Agent } from "@/types";
import CreateAgentModal from "@/components/CreateAgentModal";

export default function AgentsPage() {
  const [agents, setAgents] = useState(mockAgents);
  const [showModal, setShowModal] = useState(false);

  function getCurrentTask(agentId: string) {
    return mockTasks.find((t) => t.assigned_to === agentId && t.status === "in_progress");
  }

  function handleCreateAgent(agent: Agent) {
    setAgents((prev) => [...prev, agent]);
    setShowModal(false);
  }

  return (
    <div className="px-8 py-8 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#f5f5f5" }}>Agent Registry</h1>
          <p className="text-sm mt-1" style={{ color: "#71717a" }}>
            {agents.length} agents registered
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} currentTask={getCurrentTask(agent.id)} />
        ))}
      </div>

      {showModal && (
        <CreateAgentModal onClose={() => setShowModal(false)} onCreate={handleCreateAgent} />
      )}
    </div>
  );
}
