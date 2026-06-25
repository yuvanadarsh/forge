"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Notification {
  id: string;
  icon: string;
  text: string;
  time: string;
  color: string;
  href: string;
  read: boolean;
}

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    icon: "✓",
    text: "Sage completed: Design agent communication protocol",
    time: "2h ago",
    color: "#22c55e",
    href: "/agents/agent-3",
    read: false,
  },
  {
    id: "n2",
    icon: "⏸",
    text: "Pipeline: Mock UI Foundation Build awaiting approval",
    time: "4h ago",
    color: "#f59e0b",
    href: "/pipelines/pipeline-1/chat",
    read: false,
  },
  {
    id: "n3",
    icon: "✗",
    text: "Patch encountered an error on: Fix agent status sync bug",
    time: "9h ago",
    color: "#ef4444",
    href: "/agents/agent-7",
    read: false,
  },
  {
    id: "n4",
    icon: "✓",
    text: "Pixel completed: Build dashboard agent grid",
    time: "1d ago",
    color: "#22c55e",
    href: "/agents/agent-4",
    read: false,
  },
  {
    id: "n5",
    icon: "→",
    text: "New task assigned to Vera: Write E2E test suite",
    time: "1d ago",
    color: "#3b82f6",
    href: "/tasks",
    read: false,
  },
];

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.read).length;

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
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function handleNotificationClick(n: Notification) {
    setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
    setOpen(false);
    router.push(n.href);
  }

  return (
    <div ref={ref} className="relative">
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
          className="absolute left-full ml-2 top-0 rounded-xl border overflow-hidden z-50"
          style={{ background: "#111111", borderColor: "#1f1f1f", width: "300px", boxShadow: "0 12px 32px rgba(0,0,0,0.6)" }}
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
            {notifications.map((n) => (
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
                  style={{ color: n.color }}
                >
                  {n.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-snug" style={{ color: n.read ? "#71717a" : "#e4e4e7" }}>
                    {n.text}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: "#3f3f46" }}>{n.time}</p>
                </div>
                {!n.read && (
                  <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ background: "#f59e0b" }} />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
