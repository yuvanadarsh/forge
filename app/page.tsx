"use client";

import { useState } from "react";
import AgentCard from "@/components/AgentCard";
import TaskCard from "@/components/TaskCard";
import Toast from "@/components/Toast";
import { mockAgents, mockTasks } from "@/lib/mock-data";
import type { Task } from "@/types";

const COLUMNS: { key: Task["status"]; label: string }[] = [
  { key: "backlog", label: "Backlog" },
  { key: "in_progress", label: "In Progress" },
  { key: "review", label: "Review" },
  { key: "completed", label: "Completed" },
];

export default function DashboardPage() {
  const [toast, setToast] = useState(false);
  const [tasks, setTasks] = useState(mockTasks);

  function getAgent(id: string) {
    return mockAgents.find((a) => a.id === id);
  }

  function getCurrentTask(agentId: string) {
    return tasks.find((t) => t.assigned_to === agentId && t.status === "in_progress");
  }

  return (
    <div className="px-8 py-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "#f5f5f5" }}>Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: "#71717a" }}>
          {mockAgents.filter((a) => a.status === "working").length} agents working ·{" "}
          {tasks.filter((t) => t.status === "in_progress").length} tasks in progress
        </p>
      </div>

      {/* Agent Grid */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: "#71717a" }}>
          Agents
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {mockAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              currentTask={getCurrentTask(agent.id)}
            />
          ))}
        </div>
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
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                    style={{ background: "#1a1a1a", color: "#71717a" }}
                  >
                    {colTasks.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2 min-h-[120px]">
                  {colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      agent={getAgent(task.assigned_to)}
                      onRun={() => setToast(true)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {toast && <Toast message="Coming soon — agent execution not yet wired." onClose={() => setToast(false)} />}
    </div>
  );
}
