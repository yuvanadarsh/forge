"use client";

interface Props {
  message: string;
  onRetry?: () => void;
}

export default function ErrorState({ message, onRetry }: Props) {
  return (
    <div
      className="rounded-xl border flex flex-col items-center justify-center py-16 px-6 text-center"
      style={{ background: "#111111", borderColor: "#1f1f1f" }}
    >
      <div className="text-2xl mb-3">⚠️</div>
      <div className="text-sm font-medium" style={{ color: "#ef4444" }}>
        Something went wrong
      </div>
      <div className="text-xs mt-1 max-w-[420px]" style={{ color: "#71717a" }}>
        {message}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 text-xs px-4 py-2 rounded-lg font-semibold transition-colors duration-150"
          style={{ background: "#1f1f1f", color: "#f5f5f5" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#2a2a2a")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#1f1f1f")}
        >
          Try Again
        </button>
      )}
    </div>
  );
}
