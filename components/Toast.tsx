"use client";

import { useEffect } from "react";

interface Props {
  message: string;
  onClose: () => void;
}

export default function Toast({ message, onClose }: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm"
      style={{ background: "#1a1a1a", borderColor: "#2a2a2a", color: "#f5f5f5" }}
    >
      <span className="text-base">🚧</span>
      <span>{message}</span>
      <button
        onClick={onClose}
        className="ml-2 opacity-50 hover:opacity-100 transition-opacity"
        style={{ color: "#71717a" }}
      >
        ✕
      </button>
    </div>
  );
}
