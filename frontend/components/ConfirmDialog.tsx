"use client";

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="modal-overlay fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl border p-5"
        style={{ background: "#111111", borderColor: "#1f1f1f" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold mb-2" style={{ color: "#f5f5f5" }}>
          {title}
        </h2>
        <p className="text-sm mb-5" style={{ color: "#a1a1aa" }}>
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-2 rounded-lg text-xs font-medium transition-colors duration-150"
            style={{ background: "#1a1a1a", color: "#a1a1aa" }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-2 rounded-lg text-xs font-semibold transition-colors duration-150"
            style={{ background: "#ef4444", color: "#fff" }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
