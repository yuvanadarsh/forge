"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

const DISMISS_KEY = "forge:onboarding-dismissed";

// localStorage never notifies the same tab; dismissals in THIS tab re-render
// via the dismissedNow state below, so only cross-tab changes need the event.
function subscribeToStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

interface Props {
  /** Atlas's agent id — "Chat with Atlas" opens its new-conversation route. */
  atlasId: string;
  onCreateAgent: () => void;
}

/**
 * First-run welcome card, shown on the dashboard while the workspace is
 * empty (only Atlas, no tasks). Dismissal persists in localStorage.
 */
export default function OnboardingBanner({ atlasId, onCreateAgent }: Props) {
  // localStorage is browser-only: the server snapshot reports "dismissed" so
  // SSR and the hydration render agree (hidden), then React re-renders with
  // the real stored value right after mount.
  const dismissedStored = useSyncExternalStore(
    subscribeToStorage,
    () => localStorage.getItem(DISMISS_KEY) === "1",
    () => true
  );
  const [dismissedNow, setDismissedNow] = useState(false);

  if (dismissedStored || dismissedNow) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissedNow(true);
  }

  const cta =
    "text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors duration-150 inline-flex items-center gap-1.5";

  return (
    <div
      className="relative rounded-xl border p-6 mb-10"
      style={{ background: "#1a1200", borderColor: "#f59e0b" }}
    >
      <button
        onClick={dismiss}
        aria-label="Dismiss onboarding"
        className="absolute top-3 right-3 w-6 h-6 rounded-md flex items-center justify-center text-xs transition-colors duration-150"
        style={{ color: "#a1793a" }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#f5f5f5")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "#a1793a")}
      >
        ✕
      </button>

      <h2 className="text-lg font-bold" style={{ color: "#f5f5f5" }}>
        Welcome to Forge ⚡
      </h2>
      <p className="text-sm mt-1" style={{ color: "#a1a1aa" }}>
        Your AI workforce is ready to build.
      </p>

      <div className="flex items-center gap-3 mt-5 flex-wrap">
        <Link
          href={`/agents/${atlasId}/conversations/new`}
          className={cta}
          style={{ background: "#f59e0b", color: "#0a0a0a" }}
        >
          Chat with Atlas →
        </Link>
        <button
          onClick={onCreateAgent}
          className={cta}
          style={{ background: "transparent", color: "#f59e0b", border: "1px solid #f59e0b" }}
        >
          Create your first agent →
        </button>
        <a
          href="https://github.com/yuvanadarsh/forge#readme"
          target="_blank"
          rel="noreferrer"
          className={cta}
          style={{ background: "transparent", color: "#71717a" }}
        >
          Watch a demo pipeline →
        </a>
      </div>
    </div>
  );
}
