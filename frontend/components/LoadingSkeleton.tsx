"use client";

interface Props {
  variant?: "card" | "row" | "text";
  count?: number;
}

function CardSkeleton() {
  return (
    <div
      className="rounded-xl border p-4 h-full min-h-[150px] flex flex-col gap-3 animate-pulse"
      style={{ background: "#111111", borderColor: "#1f1f1f" }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-3.5 w-24 rounded" style={{ background: "#1f1f1f" }} />
          <div className="h-2.5 w-16 rounded" style={{ background: "#1a1a1a" }} />
        </div>
        <div className="h-2.5 w-10 rounded" style={{ background: "#1a1a1a" }} />
      </div>
      <div className="h-2.5 w-full rounded" style={{ background: "#1a1a1a" }} />
      <div className="h-2.5 w-3/4 rounded" style={{ background: "#1a1a1a" }} />
      <div className="h-2.5 w-1/2 rounded mt-auto" style={{ background: "#1a1a1a" }} />
    </div>
  );
}

function RowSkeleton() {
  return (
    <div
      className="rounded-lg border px-4 py-3 flex items-center gap-4 animate-pulse"
      style={{ background: "#111111", borderColor: "#1f1f1f" }}
    >
      <div className="h-3 w-1/3 rounded" style={{ background: "#1f1f1f" }} />
      <div className="h-3 w-1/4 rounded" style={{ background: "#1a1a1a" }} />
      <div className="h-3 w-16 rounded ml-auto" style={{ background: "#1a1a1a" }} />
    </div>
  );
}

function TextSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-3 w-full rounded" style={{ background: "#1a1a1a" }} />
      <div className="h-3 w-5/6 rounded" style={{ background: "#1a1a1a" }} />
    </div>
  );
}

export default function LoadingSkeleton({ variant = "card", count = 1 }: Props) {
  const Skeleton =
    variant === "card" ? CardSkeleton : variant === "row" ? RowSkeleton : TextSkeleton;
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} />
      ))}
    </>
  );
}
