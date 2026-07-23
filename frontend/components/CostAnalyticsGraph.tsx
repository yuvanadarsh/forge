"use client";

import { useEffect, useMemo, useState } from "react";
import CostAnalyticsChart, {
  type DataPoint,
  type Metric,
  type ModelSeries,
  type Timeline,
} from "./CostAnalyticsChart";
import { getCostAnalytics } from "@/lib/api";
import type { CostAnalyticsBucket } from "@/types";

const METRIC_OPTIONS: { key: Metric; label: string }[] = [
  { key: "input_tokens", label: "Input Tokens" },
  { key: "output_tokens", label: "Output Tokens" },
  { key: "cost", label: "Cost" },
];

const TIMELINE_OPTIONS: { key: Timeline; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
  { key: "all", label: "All Time" },
];

// Model shade palettes per provider (chip uses the first shade); unknown
// providers cycle through the fallback list.
const PROVIDER_PALETTES: Record<string, string[]> = {
  anthropic: ["#f59e0b", "#fbbf24", "#fde68a"],
  openai: ["#22c55e", "#86efac", "#bbf7d0"],
  gemini: ["#3b82f6", "#93c5fd", "#bfdbfe"],
  google: ["#3b82f6", "#93c5fd", "#bfdbfe"],
  deepseek: ["#a855f7", "#d8b4fe", "#ede9fe"],
  voyageai: ["#ec4899", "#f9a8d4", "#fbcfe8"],
};
const FALLBACK_COLORS = ["#6366f1", "#f97316", "#06b6d4", "#eab308", "#10b981", "#f43f5e"];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function bucketLabel(iso: string, timeline: Timeline, index: number): string {
  const d = new Date(iso);
  if (timeline === "day") return `${d.getUTCHours()}:00`;
  if (timeline === "week") return DAY_NAMES[d.getUTCDay()];
  if (timeline === "month") return `Wk ${index + 1}`;
  if (timeline === "year") return d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}

function providerColor(provider: string): string {
  return PROVIDER_PALETTES[provider.toLowerCase()]?.[0] ?? FALLBACK_COLORS[0];
}

function displayName(provider: string): string {
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export default function CostAnalyticsGraph() {
  const [metric, setMetric] = useState<Metric>("cost");
  const [timeline, setTimeline] = useState<Timeline>("week");
  // null = loading; metric switches re-slice the same buckets client-side
  const [buckets, setBuckets] = useState<CostAnalyticsBucket[] | null>(null);
  // null = "all providers" until the user toggles a chip
  const [activeProviders, setActiveProviders] = useState<Set<string> | null>(null);

  // Back to loading when the timeline changes — render-phase state adjustment
  // (React's documented pattern), not a setState-in-effect.
  const [prevTimeline, setPrevTimeline] = useState(timeline);
  if (prevTimeline !== timeline) {
    setPrevTimeline(timeline);
    setBuckets(null);
  }

  useEffect(() => {
    let cancelled = false;
    getCostAnalytics({ interval: timeline })
      .then((res) => {
        if (!cancelled) setBuckets(res.buckets);
      })
      .catch(() => {
        if (!cancelled) setBuckets([]);
      });
    return () => {
      cancelled = true;
    };
  }, [timeline]);

  const providers = useMemo(() => {
    const seen = new Set<string>();
    for (const b of buckets ?? []) for (const m of b.models) seen.add(m.provider);
    return [...seen].sort();
  }, [buckets]);

  const active = useMemo(
    () => activeProviders ?? new Set(providers),
    [activeProviders, providers]
  );

  function toggleProvider(p: string) {
    setActiveProviders(() => {
      const next = new Set(active);
      if (next.has(p)) {
        if (next.size > 1) next.delete(p);
      } else {
        next.add(p);
      }
      return next;
    });
  }

  const { series, data } = useMemo(() => {
    const list = buckets ?? [];
    // Stable series order: provider (sorted) then model (first appearance)
    const modelsByProvider = new Map<string, string[]>();
    for (const b of list) {
      for (const m of b.models) {
        if (!active.has(m.provider)) continue;
        const models = modelsByProvider.get(m.provider) ?? [];
        if (!models.includes(m.model)) models.push(m.model);
        modelsByProvider.set(m.provider, models);
      }
    }
    const series: ModelSeries[] = [];
    let fallbackIdx = 0;
    for (const provider of [...modelsByProvider.keys()].sort()) {
      const palette = PROVIDER_PALETTES[provider.toLowerCase()];
      modelsByProvider.get(provider)!.forEach((model, i) => {
        const color = palette
          ? palette[i % palette.length]
          : FALLBACK_COLORS[fallbackIdx++ % FALLBACK_COLORS.length];
        series.push({ key: `${provider}/${model}`, label: model, color, provider });
      });
    }
    const data: DataPoint[] = list.map((b, idx) => {
      const point: DataPoint = { label: bucketLabel(b.label, timeline, idx) };
      for (const s of series) point[s.key] = 0;
      for (const m of b.models) {
        if (!active.has(m.provider)) continue;
        const key = `${m.provider}/${m.model}`;
        const value =
          metric === "cost" ? m.cost : metric === "input_tokens" ? m.input_tokens : m.output_tokens;
        point[key] = ((point[key] as number) || 0) + value;
      }
      return point;
    });
    return { series, data };
  }, [buckets, active, metric, timeline]);

  const loading = buckets === null;
  const empty = !loading && data.length === 0;

  return (
    <div className="rounded-xl border p-5" style={{ background: "#111111", borderColor: "#1f1f1f" }}>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        {/* Provider chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {providers.map((p) => {
            const isActive = active.has(p);
            const color = providerColor(p);
            return (
              <button
                key={p}
                onClick={() => toggleProvider(p)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 border"
                style={{
                  background: isActive ? `${color}22` : "#1a1a1a",
                  borderColor: isActive ? color : "#2a2a2a",
                  color: isActive ? color : "#71717a",
                }}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ background: isActive ? color : "#3f3f46" }}
                />
                {displayName(p)}
              </button>
            );
          })}
          {providers.length === 0 && !loading && (
            <span className="text-xs" style={{ color: "#3f3f46" }}>
              No provider usage recorded yet
            </span>
          )}
        </div>

        {/* Dropdowns */}
        <div className="flex items-center gap-2">
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as Metric)}
            className="text-xs px-2.5 py-1.5 rounded-lg border outline-none transition-colors duration-150"
            style={{ background: "#1a1a1a", borderColor: "#2a2a2a", color: "#f5f5f5" }}
          >
            {METRIC_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
          <select
            value={timeline}
            onChange={(e) => setTimeline(e.target.value as Timeline)}
            className="text-xs px-2.5 py-1.5 rounded-lg border outline-none transition-colors duration-150"
            style={{ background: "#1a1a1a", borderColor: "#2a2a2a", color: "#f5f5f5" }}
          >
            {TIMELINE_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="animate-pulse rounded-lg" style={{ height: 200, background: "#1a1a1a" }} />
      ) : empty ? (
        <div
          className="flex items-center justify-center text-xs"
          style={{ height: 200, color: "#3f3f46" }}
        >
          No usage in this period — costs appear once agents start running.
        </div>
      ) : (
        <CostAnalyticsChart data={data} series={series} metric={metric} />
      )}
    </div>
  );
}
