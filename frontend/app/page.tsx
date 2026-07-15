"use client";

import { useState } from "react";
import AgentCard from "@/components/AgentCard";
import TaskCard from "@/components/TaskCard";
import Toast from "@/components/Toast";
import CreateTaskModal from "@/components/CreateTaskModal";
import CreateAgentModal from "@/components/CreateAgentModal";
import TaskSlideOver from "@/components/TaskSlideOver";
import CostAnalyticsGraph from "@/components/CostAnalyticsGraph";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import { updateTask } from "@/lib/api";
import { useForge } from "@/lib/store";
import type { BackendAgent, BackendTask, Task } from "@/types";

const COLUMNS: { key: Task["status"]; label: string }[] = [
  { key: "backlog", label: "Backlog" },
  { key: "in_progress", label: "In Progress" },
  { key: "review", label: "Review" },
  { key: "completed", label: "Completed" },
];

export default function DashboardPage() {
  const { state, dispatch } = useForge();
  const [toast, setToast] = useState<string | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [modalStatus, setModalStatus] = useState<Task["status"]>("backlog");
  const [selectedTask, setSelectedTask] = useState<BackendTask | null>(null);

  const { agents, tasks, loading } = state;

  function getAgent(id: string | null) {
    return id ? agents.find((a) => a.id === id) : undefined;
  }

  function getCurrentTask(agentId: string) {
    return tasks.find((t) => t.assigned_to === agentId && t.status === "in_progress");
  }

  function handleCreateAgent(agent: BackendAgent) {
    dispatch({ type: "ADD_AGENT", agent });
    setShowAgentModal(false);
    setToast(`Agent "${agent.name}" created`);
  }

  async function handleMoveTask(task: BackendTask, status: Task["status"]) {
    const previous = task;
    const optimistic = { ...task, status };
    // Optimistic: move the card immediately, revert if the PATCH fails.
    dispatch({ type: "UPDATE_TASK", task: optimistic });
    if (selectedTask?.id === task.id) setSelectedTask(optimistic);
    try {
      const updated = await updateTask(task.id, { status });
      dispatch({ type: "UPDATE_TASK", task: updated });
      if (selectedTask?.id === task.id) setSelectedTask(updated);
    } catch (err) {
      dispatch({ type: "UPDATE_TASK", task: previous });
      if (selectedTask?.id === task.id) setSelectedTask(previous);
      setToast(`Failed to move task: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  function openTaskModal(status: Task["status"]) {
    setModalStatus(status);
    setShowTaskModal(true);
  }

  return (
    <div className="px-8 py-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#f5f5f5" }}>Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: "#71717a" }}>
            {agents.filter((a) => a.status === "working").length} agents working ·{" "}
            {tasks.filter((t) => t.status === "in_progress").length} tasks in progress
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAgentModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-150"
            style={{ background: "#1f1f1f", color: "#f5f5f5" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#2a2a2a")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#1f1f1f")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create Agent
          </button>
          <button
            onClick={() => openTaskModal("backlog")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-150"
            style={{ background: "#f59e0b", color: "#0a0a0a" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#d97706")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#f59e0b")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Task
          </button>
        </div>
      </div>

      {/* Agent Grid */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: "#71717a" }}>
          Agents
        </h2>
        {loading.agents ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4 items-stretch">
            <LoadingSkeleton variant="card" count={4} />
          </div>
        ) : agents.length === 0 ? (
          <div
            className="rounded-xl border flex flex-col items-center justify-center py-12 text-center"
            style={{ background: "#111111", borderColor: "#1f1f1f" }}
          >
            <div className="text-sm font-medium" style={{ color: "#f5f5f5" }}>No agents yet.</div>
            <div className="text-sm mt-1" style={{ color: "#71717a" }}>
              Create your first agent to get started.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4 items-stretch">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                currentTask={getCurrentTask(agent.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Analytics */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: "#71717a" }}>
          Analytics
        </h2>
        <CostAnalyticsGraph />
      </section>

      {/* Kanban */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: "#71717a" }}>
          Operations
        </h2>
        <div className="grid grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.key);
            return (
              <div key={col.key} className="flex flex-col gap-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#71717a" }}>
                    {col.label}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                      style={{ background: "#1a1a1a", color: "#71717a" }}
                    >
                      {colTasks.length}
                    </span>
                    <button
                      onClick={() => openTaskModal(col.key)}
                      className="text-xs w-5 h-5 rounded flex items-center justify-center transition-colors duration-150"
                      style={{ color: "#71717a" }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#f59e0b")}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#71717a")}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-2 min-h-[120px]">
                  {loading.tasks ? (
                    <LoadingSkeleton variant="row" count={2} />
                  ) : (
                    colTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        agent={getAgent(task.assigned_to)}
                        onRun={() => setToast("Coming soon — agent execution not yet wired.")}
                        onClick={() => setSelectedTask(task)}
                        onMove={(status) => handleMoveTask(task, status)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {showTaskModal && (
        <CreateTaskModal
          initialStatus={modalStatus}
          onClose={() => setShowTaskModal(false)}
          onCreate={(task) => {
            dispatch({ type: "ADD_TASK", task });
            setShowTaskModal(false);
            setToast(`Task "${task.title}" created`);
          }}
          onError={(message) => setToast(`Could not create task: ${message}`)}
        />
      )}

      {showAgentModal && (
        <CreateAgentModal
          onClose={() => setShowAgentModal(false)}
          onCreate={handleCreateAgent}
          onError={(message) => setToast(`Could not create agent: ${message}`)}
        />
      )}

      {selectedTask && (
        <TaskSlideOver
          task={selectedTask}
          agent={getAgent(selectedTask.assigned_to)}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
