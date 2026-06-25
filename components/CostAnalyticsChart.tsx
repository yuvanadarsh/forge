"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export type Metric = "input_tokens" | "output_tokens" | "cost";
export type Timeline = "day" | "week" | "month" | "year" | "all";

export interface ModelSeries {
  key: string;
  label: string;
  color: string;
  provider: string;
}

export interface DataPoint {
  label: string;
  [modelKey: string]: number | string;
}

function formatValue(n: number, metric: Metric): string {
  if (metric === "cost") return `$${n.toFixed(4)}`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

function TooltipContent({
  active,
  payload,
  label,
  metric,
  total,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  metric: Metric;
  total: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2 rounded-lg text-xs border min-w-[140px]"
      style={{ background: "#1a1a1a", borderColor: "#2a2a2a", color: "#f5f5f5" }}
    >
      <div className="mb-1.5 font-medium" style={{ color: "#71717a" }}>{label}</div>
      {payload.map((entry) => {
        const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0.0";
        return (
          <div key={entry.name} className="flex items-center justify-between gap-4 mb-1">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-sm" style={{ background: entry.color }} />
              <span style={{ color: "#a1a1aa" }}>{entry.name}</span>
            </span>
            <span className="font-semibold" style={{ color: "#f5f5f5" }}>
              {formatValue(entry.value, metric)}{" "}
              <span style={{ color: "#71717a" }}>({pct}%)</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface Props {
  data: DataPoint[];
  series: ModelSeries[];
  metric: Metric;
}

export default function CostAnalyticsChart({ data, series, metric }: Props) {
  const total = data.reduce(
    (sum, point) =>
      sum + series.reduce((s, m) => s + ((point[m.key] as number) || 0), 0),
    0
  );

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} barCategoryGap="25%" barGap={2} margin={{ top: 4, right: 4, left: 4, bottom: 16 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "#3f3f46" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide />
        <Tooltip
          content={
            <TooltipContent
              metric={metric}
              total={total}
            />
          }
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
        />
        <Legend
          wrapperStyle={{ fontSize: 10, color: "#71717a", paddingTop: 8 }}
          iconType="square"
          iconSize={8}
        />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[3, 3, 0, 0]} maxBarSize={20} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
