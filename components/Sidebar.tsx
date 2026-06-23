"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    href: "/",
    label: "Dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: "/agents",
    label: "Agents",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
  {
    href: "/pipelines",
    label: "Pipelines",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    ),
  },
  {
    href: "/tasks",
    label: "Tasks",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
  },
  {
    href: "/chat",
    label: "Chat",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-[220px] flex flex-col border-r" style={{ background: "#0d0d0d", borderColor: "#1f1f1f" }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: "#1f1f1f" }}>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: "#f59e0b" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            {/* Hammer */}
            <path d="M3 21l7-7" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M9 3l6 6-2 2-6-6z" fill="#0a0a0a" />
            <path d="M15 9l2-2 3 3-2 2z" fill="#0a0a0a" />
            {/* Lightning bolt */}
            <path d="M13 2l-4 8h4l-4 12 9-11h-5l5-9z" fill="#0a0a0a" opacity="0.6" transform="translate(1, -1) scale(0.6)" />
          </svg>
        </div>
        <span className="font-bold text-lg tracking-tight" style={{ color: "#f5f5f5" }}>
          Forge
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group relative"
              style={{
                color: active ? "#f59e0b" : "#71717a",
                background: active ? "rgba(245,158,11,0.08)" : "transparent",
              }}
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                  style={{ background: "#f59e0b" }}
                />
              )}
              <span className="transition-colors duration-150 group-hover:text-[#f5f5f5]" style={{ color: active ? "#f59e0b" : "#71717a" }}>
                {item.icon}
              </span>
              <span className="font-medium transition-colors duration-150 group-hover:text-[#f5f5f5]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Settings */}
      <div className="px-3 py-4 border-t" style={{ borderColor: "#1f1f1f" }}>
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group"
          style={{ color: "#71717a" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-hover:text-[#f5f5f5] transition-colors duration-150">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
          <span className="font-medium group-hover:text-[#f5f5f5] transition-colors duration-150">Settings</span>
        </Link>
      </div>
    </aside>
  );
}
