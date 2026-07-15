"use client";

import { useState } from "react";
import { mockTasks, mockAgents } from "@/lib/mock-data";
import type { Task } from "@/types";
import TaskCard from "@/components/TaskCard";
import Toast from "@/components/Toast";
import CreateTaskModal from "@/components/CreateTaskModal";
import TaskSlideOver from "@/components/TaskSlideOver";

const COLUMNS: { key: Task["status"]; label: string }[] = [
  { key: "backlog", label: "Backlog" },
  { key: "in_progress", label: "In Progress" },
  { key: "review", label: "Review" },
  { key: "completed", label: "Completed" },
];

export default function TasksPage() {
  const [tasks, setTasks] = useState(mockTasks);
  const [toast, setToast] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [initialStatus, setInitialStatus] = useState<Task["status"]>("backlog");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  function getAgent(id: string) {
    return mockAgents.find((a) => a.id === id);
  }

  function openModal(status: Task["status"]) {
    setInitialStatus(status);
    setShowModal(true);
  }

  function handleMoveTask(taskId: string, status: Task["status"]) {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status } : t));
    if (selectedTask?.id === taskId) setSelectedTask((t) => t ? { ...t, status } : null);
  }

  return (
    <div className="px-8 py-8 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#f5f5f5" }}>Tasks</h1>
          <p className="text-sm mt-1" style={{ color: "#71717a" }}>
            {tasks.length} tasks total
          </p>
        </div>
        <button
          onClick={() => openModal("backlog")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors duration-150"
          style={{ background: "#f59e0b", color: "#0a0a0a" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Task
        </button>
      </div>

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
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: "#1a1a1a", color: "#71717a" }}>
                    {colTasks.length}
                  </span>
                  <button
                    onClick={() => openModal(col.key)}
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
                {colTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    agent={getAgent(task.assigned_to)}
                    onRun={() => setToast(true)}
                    onClick={() => setSelectedTask(task)}
                    onMove={(status) => handleMoveTask(task.id, status)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <CreateTaskModal
          initialStatus={initialStatus}
          onClose={() => setShowModal(false)}
          onCreate={(task) => {
            setTasks((prev) => [...prev, task]);
            setShowModal(false);
          }}
        />
      )}

      {selectedTask && (
        <TaskSlideOver
          task={selectedTask}
          agent={getAgent(selectedTask.assigned_to)}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {toast && <Toast message="Coming soon — agent execution not yet wired." onClose={() => setToast(false)} />}
    </div>
  );
}
