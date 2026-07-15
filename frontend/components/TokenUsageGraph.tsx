"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { getTokenUsage } from "@/lib/api";
import type { TokenUsageInterval, TokenUsagePoint } from "@/types";

type Interval = TokenUsageInterval;

const INTERVAL_OPTIONS: { key: Interval; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "all", label: "All Time" },
];

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Slot {
  start: number;
  end: number;
  label: string;
}

// Fixed display ranges per interval (UTC, matching the backend's date_trunc
// buckets); sparse API points are summed into their slot so the chart always
// renders the full range with zeros where nothing was recorded.
function buildSlots(interval: Interval, points: TokenUsagePoint[]): Slot[] {
  const now = Date.now();
  if (interval === "day") {
    const cur = Math.floor(now / HOUR) * HOUR;
    return Array.from({ length: 24 }, (_, i) => {
      const start = cur - (23 - i) * HOUR;
      return { start, end: start + HOUR, label: `${new Date(start).getUTCHours()}:00` };
    });
  }
  if (interval === "week") {
    const cur = Math.floor(now / DAY) * DAY;
    return Array.from({ length: 7 }, (_, i) => {
      const start = cur - (6 - i) * DAY;
      return { start, end: start + DAY, label: DAY_NAMES[new Date(start).getUTCDay()] };
    });
  }
  if (interval === "month") {
    const end = Math.floor(now / DAY) * DAY + DAY;
    return Array.from({ length: 4 }, (_, i) => {
      const start = end - (4 - i) * WEEK;
      return { start, end: start + WEEK, label: `Wk ${i + 1}` };
    });
  }
  // "all": one slot per calendar month across the data range
  if (points.length === 0) return [];
  const first = new Date(points[0].bucket);
  const last = new Date(points[points.length - 1].bucket);
  const spansYears = first.getUTCFullYear() !== last.getUTCFullYear();
  const slots: Slot[] = [];
  let cursor = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1));
  while (cursor.getTime() <= last.getTime()) {
    const next = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    slots.push({
      start: cursor.getTime(),
      end: next.getTime(),
      label: cursor.toLocaleDateString("en-US", {
        month: "short",
        ...(spansYears ? { year: "2-digit" } : {}),
        timeZone: "UTC",
      }),
    });
    cursor = next;
  }
  return slots;
}

function fillSlots(slots: Slot[], points: TokenUsagePoint[]) {
  const data = slots.map((s) => ({ label: s.label, tokens: 0 }));
  for (const p of points) {
    const t = new Date(p.bucket).getTime();
    const idx = slots.findIndex((s) => t >= s.start && t < s.end);
    if (idx >= 0) data[idx].tokens += p.tokens;
  }
  return data;
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2 rounded-lg text-xs border"
      style={{ background: "#1a1a1a", borderColor: "#2a2a2a", color: "#f5f5f5" }}
    >
      <div style={{ color: "#71717a" }}>{label}</div>
      <div className="font-semibold mt-0.5" style={{ color: "#f59e0b" }}>
        {formatTokens(payload[0].value)} tokens
      </div>
    </div>
  );
}

interface Props {
  agentId: string;
  accentColor?: string;
}

export default function TokenUsageGraph({ agentId, accentColor = "#f59e0b" }: Props) {
  const [interval, setInterval] = useState<Interval>("week");
  // null = loading
  const [points, setPoints] = useState<TokenUsagePoint[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPoints(null);
    getTokenUsage({ agent_id: agentId, interval })
      .then((series) => {
        if (!cancelled) setPoints(series.points);
      })
      .catch(() => {
        if (!cancelled) setPoints([]);
      });
    return () => {
      cancelled = true;
    };
  }, [agentId, interval]);

  const loading = points === null;
  const data = loading ? [] : fillSlots(buildSlots(interval, points), points);
  const maxVal = Math.max(...data.map((d) => d.tokens), 0);
  const hasUsage = data.some((d) => d.tokens > 0);

  return (
    <div
      className="rounded-xl border p-5"
      style={{ background: "#111111", borderColor: "#1f1f1f" }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#71717a" }}>
          Token Usage
        </h3>
        <div className="flex items-center gap-1">
          {INTERVAL_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setInterval(opt.key)}
              className="text-xs px-2.5 py-1 rounded-lg transition-colors duration-150 font-medium"
              style={
                interval === opt.key
                  ? { background: "#f59e0b", color: "#0a0a0a" }
                  : { background: "#1a1a1a", color: "#71717a" }
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="animate-pulse rounded-lg" style={{ height: 160, background: "#1a1a1a" }} />
      ) : !hasUsage ? (
        <div
          className="flex items-center justify-center text-xs"
          style={{ height: 160, color: "#3f3f46" }}
        >
          No token usage recorded {interval === "all" ? "yet" : "in this period"}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data} barCategoryGap="30%">
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#3f3f46" }}
              axisLine={false}
              tickLine={false}
              interval={interval === "day" ? 3 : 0}
            />
            <YAxis hide />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar dataKey="tokens" radius={[3, 3, 0, 0]}>
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={accentColor}
                  fillOpacity={entry.tokens === maxVal ? 1 : 0.3}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
