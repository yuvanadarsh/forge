"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TaskCard from "@/components/TaskCard";
import Toast from "@/components/Toast";
import CreateTaskModal from "@/components/CreateTaskModal";
import TaskSlideOver from "@/components/TaskSlideOver";
import EmptyState from "@/components/EmptyState";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import { runTask, updateTask } from "@/lib/api";
import { useForge } from "@/lib/store";
import type { BackendTask, Task } from "@/types";

const COLUMNS: { key: Task["status"]; label: string }[] = [
  { key: "backlog", label: "Backlog" },
  { key: "in_progress", label: "In Progress" },
  { key: "review", label: "Review" },
  { key: "completed", label: "Completed" },
];

export default function TasksPage() {
  const router = useRouter();
  const { state, dispatch } = useForge();
  const [toast, setToast] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [initialStatus, setInitialStatus] = useState<Task["status"]>("backlog");
  const [selectedTask, setSelectedTask] = useState<BackendTask | null>(null);

  const { tasks, agents, loading } = state;

  function getAgent(id: string | null) {
    return id ? agents.find((a) => a.id === id) : undefined;
  }

  function openModal(status: Task["status"]) {
    setInitialStatus(status);
    setShowModal(true);
  }

  async function handleRunTask(task: BackendTask) {
    if (!task.assigned_to) {
      setToast("Assign an agent to this task before running it.");
      return;
    }
    const previous = task;
    // Optimistic: the card jumps to In Progress immediately, reverts on error.
    dispatch({ type: "UPDATE_TASK", task: { ...task, status: "in_progress" } });
    try {
      const result = await runTask(task.id);
      router.push(`/agents/${task.assigned_to}/conversations/${result.conversation_id}`);
    } catch (err) {
      dispatch({ type: "UPDATE_TASK", task: previous });
      setToast(`Could not run task: ${err instanceof Error ? err.message : "unknown error"}`);
    }
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

  return (
    <div className="px-8 py-8 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "#f5f5f5" }}>Tasks</h1>
          <p className="text-sm mt-1" style={{ color: "#71717a" }}>
            {loading.tasks ? "Loading tasks…" : `${tasks.length} tasks total`}
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

      {!loading.tasks && tasks.length === 0 ? (
        <EmptyState
          icon="🗂️"
          title="No tasks yet."
          description="Create a task and assign it to an agent — the Run button executes it for real."
          action={{ label: "New Task", onClick: () => openModal("backlog") }}
        />
      ) : (
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
                {loading.tasks ? (
                  <LoadingSkeleton variant="row" count={2} />
                ) : colTasks.length === 0 ? (
                  <div
                    className="rounded-xl border border-dashed flex items-center justify-center py-8 text-xs"
                    style={{ borderColor: "#1f1f1f", color: "#3f3f46" }}
                  >
                    No tasks in {col.label.toLowerCase()}
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      agent={getAgent(task.assigned_to)}
                      onRun={() => handleRunTask(task)}
                      onClick={() => setSelectedTask(task)}
                      onMove={(status) => handleMoveTask(task, status)}
                      onDeleted={(message) => {
                        if (selectedTask?.id === task.id) setSelectedTask(null);
                        setToast(message);
                      }}
                      onError={setToast}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {showModal && (
        <CreateTaskModal
          initialStatus={initialStatus}
          onClose={() => setShowModal(false)}
          onCreate={(task) => {
            dispatch({ type: "ADD_TASK", task });
            setShowModal(false);
            setToast(`Task "${task.title}" created`);
          }}
          onError={(message) => setToast(`Could not create task: ${message}`)}
        />
      )}

      {selectedTask && (
        <TaskSlideOver
          task={selectedTask}
          agent={getAgent(selectedTask.assigned_to)}
          onRun={() => handleRunTask(selectedTask)}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
