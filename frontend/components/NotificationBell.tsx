"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api";
import { useForge } from "@/lib/store";
import type { NotificationItem } from "@/types";

const POLL_INTERVAL_MS = 30_000;

const TYPE_STYLES: Record<NotificationItem["type"], { icon: string; color: string }> = {
  pipeline_completed: { icon: "✓", color: "#22c55e" },
  pipeline_failed: { icon: "✗", color: "#ef4444" },
  approval_needed: { icon: "⏸", color: "#f59e0b" },
  agent_error: { icon: "✗", color: "#ef4444" },
  info: { icon: "→", color: "#3b82f6" },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationBell() {
  const router = useRouter();
  const { state, dispatch } = useForge();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const notifications = state.notifications;
  const unread = notifications.filter((n) => !n.read).length;

  // The provider fetches once on mount; the bell keeps the list fresh.
  useEffect(() => {
    const poll = window.setInterval(() => {
      listNotifications()
        .then((items) => dispatch({ type: "SET_NOTIFICATIONS", notifications: items }))
        .catch(() => {}); // transient poll failures are silent
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(poll);
  }, [dispatch]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function markAllRead() {
    dispatch({ type: "MARK_ALL_NOTIFICATIONS_READ" });
    markAllNotificationsRead().catch(() => {
      // Revert to server truth if the bulk update failed.
      listNotifications()
        .then((items) => dispatch({ type: "SET_NOTIFICATIONS", notifications: items }))
        .catch(() => {});
    });
  }

  function handleNotificationClick(n: NotificationItem) {
    if (!n.read) {
      dispatch({ type: "MARK_NOTIFICATION_READ", notificationId: n.id });
      markNotificationRead(n.id).catch(() => {});
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  return (
    <div ref={ref} className="relative" style={{ position: "relative", zIndex: 50 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-150"
        style={{ color: open ? "#f5f5f5" : "#71717a", background: open ? "#1f1f1f" : "transparent" }}
        onMouseEnter={(e) => { if (!open) (e.currentTarget as HTMLButtonElement).style.color = "#a1a1aa"; }}
        onMouseLeave={(e) => { if (!open) (e.currentTarget as HTMLButtonElement).style.color = "#71717a"; }}
        title="Notifications"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center text-[9px] font-bold rounded-full"
            style={{ background: "#f59e0b", color: "#0a0a0a" }}
          >
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="rounded-xl border overflow-hidden"
          style={{
            position: "fixed",
            bottom: "80px",
            left: "220px",
            zIndex: 9999,
            width: "320px",
            background: "#111111",
            borderColor: "#1f1f1f",
            boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#1f1f1f" }}>
            <span className="text-xs font-semibold" style={{ color: "#f5f5f5" }}>Notifications</span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-[10px] transition-colors duration-150"
                style={{ color: "#71717a" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#f59e0b")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#71717a")}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {notifications.length === 0 && (
              <div className="px-4 py-6 text-center text-xs" style={{ color: "#3f3f46" }}>
                No notifications yet
              </div>
            )}
            {notifications.map((n) => {
              const style = TYPE_STYLES[n.type] ?? TYPE_STYLES.info;
              return (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors duration-100 border-b"
                  style={{
                    background: n.read ? "transparent" : "rgba(245,158,11,0.03)",
                    borderColor: "#1a1a1a",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#1a1a1a")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = n.read ? "transparent" : "rgba(245,158,11,0.03)")}
                >
                  <span
                    className="text-xs font-bold shrink-0 mt-0.5 w-4 text-center"
                    style={{ color: style.color }}
                  >
                    {style.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-snug" style={{ color: n.read ? "#71717a" : "#e4e4e7" }}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-[10px] mt-0.5 truncate" style={{ color: "#52525b" }}>
                        {n.body}
                      </p>
                    )}
                    <p className="text-[10px] mt-0.5" style={{ color: "#3f3f46" }}>
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                  {!n.read && (
                    <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ background: "#f59e0b" }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
