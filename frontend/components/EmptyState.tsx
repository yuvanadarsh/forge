"use client";

interface Props {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon = "📭", title, description, action }: Props) {
  return (
    <div
      className="rounded-xl border flex flex-col items-center justify-center py-16 px-6 text-center"
      style={{ background: "#111111", borderColor: "#1f1f1f" }}
    >
      <div className="text-3xl mb-3">{icon}</div>
      <div className="text-sm font-medium" style={{ color: "#f5f5f5" }}>
        {title}
      </div>
      {description && (
        <div className="text-sm mt-1 max-w-[420px]" style={{ color: "#71717a" }}>
          {description}
        </div>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 text-xs px-4 py-2 rounded-lg font-semibold transition-colors duration-150"
          style={{ background: "#f59e0b", color: "#0a0a0a" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#d97706")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = "#f59e0b")}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
