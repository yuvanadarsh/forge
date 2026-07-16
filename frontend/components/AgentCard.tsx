"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { ApiError, deleteAgent } from "@/lib/api";
import { useForge } from "@/lib/store";
import type { Agent, BackendAgent, BackendTask } from "@/types";

const RING_COLORS: Record<string, [string, string]> = {
  "#6366f1": ["#6366f1", "#8b5cf6"],
  "#f59e0b": ["#f59e0b", "#ef4444"],
  "#3b82f6": ["#3b82f6", "#06b6d4"],
  "#22c55e": ["#22c55e", "#10b981"],
  "#ec4899": ["#ec4899", "#f43f5e"],
  "#f97316": ["#f97316", "#eab308"],
};

function getGradient(color: string) {
  const pair = RING_COLORS[color] ?? [color, color];
  return `linear-gradient(to right, ${pair[0]}, ${pair[1]})`;
}

function StatusDot({ status }: { status: Agent["status"] }) {
  const colors = { idle: "#71717a", working: "#22c55e", error: "#ef4444" };
  const labels = { idle: "Idle", working: "Working", error: "Error" };
  return (
    <span className="flex items-center gap-1.5 text-xs" style={{ color: colors[status] }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: colors[status] }} />
      {labels[status]}
    </span>
  );
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface Props {
  // Backend shapes; the stricter mock-phase Agent/Task remain assignable.
  agent: BackendAgent;
  currentTask?: BackendTask;
  onDeleted?: (message: string) => void;
  onError?: (message: string) => void;
}

export default function AgentCard({ agent, currentTask, onDeleted, onError }: Props) {
  const { dispatch } = useForge();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [menuOpen]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteAgent(agent.id);
      dispatch({ type: "DELETE_AGENT", agentId: agent.id });
      onDeleted?.(`Agent "${agent.name}" deleted`);
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 409
          ? "Cannot delete agent with active pipeline runs"
          : err instanceof Error
            ? err.message
            : "Failed to delete agent";
      onError?.(message);
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <div className="relative group h-full">
      <Link href={`/agents/${agent.id}`} className="block h-full">
        <div
          className="rounded-xl overflow-hidden transition-transform duration-150 group-hover:scale-[1.01] h-full"
          style={{ padding: "1px", background: getGradient(agent.avatar_color) }}
        >
          <div className="rounded-xl p-4 h-full flex flex-col gap-3" style={{ background: "#111111" }}>
            <div>
              <div className="font-semibold text-sm" style={{ color: "#f5f5f5" }}>{agent.name}</div>
              <div className="text-xs mt-0.5" style={{ color: "#71717a" }}>{agent.role}</div>
            </div>

            <div className="text-xs leading-relaxed line-clamp-2" style={{ color: "#71717a" }}>
              {agent.specialty}
            </div>

            <div className="flex items-center gap-4 text-xs" style={{ color: "#71717a" }}>
              <span>{formatTokens(agent.tokens_used)} tokens</span>
              <span>${agent.cost_usd.toFixed(2)}</span>
            </div>

            {currentTask && (
              <div className="text-xs px-2 py-1.5 rounded-lg truncate" style={{ background: "#1a1a1a", color: "#a1a1aa" }}>
                {currentTask.title}
              </div>
            )}

            <div className="flex items-center justify-between mt-auto">
              <span className="text-xs" style={{ color: "#3f3f46" }}>
                {agent.last_active ? `Active ${timeAgo(agent.last_active)}` : "Not active yet"}
              </span>
              <StatusDot status={agent.status} />
            </div>
          </div>
        </div>
      </Link>

      <div className="absolute top-2 right-2" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="w-6 h-6 rounded-md flex items-center justify-center text-xs transition-opacity duration-150 opacity-0 group-hover:opacity-100"
          style={{ background: "#1a1a1a", color: "#f5f5f5" }}
          aria-label="Agent options"
        >
          ⋯
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 mt-1 w-36 rounded-lg border py-1 z-30"
            style={{ background: "#161616", borderColor: "#1f1f1f" }}
          >
            <Link
              href={`/agents/${agent.id}`}
              onClick={() => setMenuOpen(false)}
              className="block w-full text-left px-3 py-2 text-xs transition-colors duration-150 hover:bg-[#1f1f1f]"
              style={{ color: "#f5f5f5" }}
            >
              View Agent
            </Link>
            <button
              onClick={() => {
                setMenuOpen(false);
                setConfirming(true);
              }}
              className="w-full text-left px-3 py-2 text-xs transition-colors duration-150 hover:bg-[#1f1f1f]"
              style={{ color: "#ef4444" }}
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {confirming && (
        <ConfirmDialog
          title={`Delete ${agent.name}?`}
          message="This will also delete all their conversations and run history."
          confirmLabel={deleting ? "Deleting…" : "Delete"}
          onConfirm={handleDelete}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
