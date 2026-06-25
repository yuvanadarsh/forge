"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

type Interval = "day" | "week" | "month" | "all";

const INTERVAL_OPTIONS: { key: Interval; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "all", label: "All Time" },
];

function generateData(totalTokens: number, interval: Interval) {
  const seed = totalTokens || 100_000;
  const rand = (i: number, scale: number) =>
    Math.max(0, Math.round((Math.sin(i * 2.3 + seed % 7) * 0.4 + 0.6) * scale + Math.random() * scale * 0.1));

  if (interval === "day") {
    return Array.from({ length: 24 }, (_, i) => ({
      label: `${i}:00`,
      tokens: rand(i, seed / 24),
    }));
  }
  if (interval === "week") {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return days.map((label, i) => ({ label, tokens: rand(i, seed / 7) }));
  }
  if (interval === "month") {
    return Array.from({ length: 4 }, (_, i) => ({
      label: `Wk ${i + 1}`,
      tokens: rand(i, seed / 4),
    }));
  }
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months.map((label, i) => ({ label, tokens: rand(i, seed / 12) }));
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
  totalTokens: number;
  accentColor?: string;
}

export default function TokenUsageGraph({ totalTokens, accentColor = "#f59e0b" }: Props) {
  const [interval, setInterval] = useState<Interval>("week");
  const data = generateData(totalTokens, interval);
  const maxVal = Math.max(...data.map((d) => d.tokens));

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
    </div>
  );
}
