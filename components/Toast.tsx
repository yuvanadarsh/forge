"use client";

import { useEffect, useState } from "react";

interface Props {
  message: string;
  onClose: () => void;
}

export default function Toast({ message, onClose }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger fade-in
    const show = requestAnimationFrame(() => setVisible(true));
    const hide = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 200);
    }, 2800);
    return () => { cancelAnimationFrame(show); clearTimeout(hide); };
  }, [onClose]);

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm"
      style={{
        background: "#1a1a1a",
        borderColor: "#2a2a2a",
        color: "#f5f5f5",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 200ms ease, transform 200ms ease",
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#f59e0b", flexShrink: 0 }} />
      <span>{message}</span>
      <button
        onClick={() => { setVisible(false); setTimeout(onClose, 200); }}
        className="ml-2 transition-opacity duration-150 opacity-40 hover:opacity-100"
        style={{ color: "#71717a" }}
      >
        ✕
      </button>
    </div>
  );
}
