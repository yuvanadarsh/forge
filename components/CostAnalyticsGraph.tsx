"use client";

import { useState } from "react";
import CostAnalyticsChart, {
  type Metric,
  type Timeline,
} from "./CostAnalyticsChart";
import {
  ALL_SERIES,
  PROVIDERS,
  PROVIDER_COLORS,
  METRIC_OPTIONS,
  TIMELINE_OPTIONS,
  buildData,
  type Provider,
} from "@/lib/analytics-mock-data";

// ── Main component ────────────────────────────────────────────────────────────

export default function CostAnalyticsGraph() {
  const [activeProviders, setActiveProviders] = useState<Set<Provider>>(
    new Set(PROVIDERS)
  );
  const [metric, setMetric]     = useState<Metric>("cost");
  const [timeline, setTimeline] = useState<Timeline>("week");

  function toggleProvider(p: Provider) {
    setActiveProviders((prev) => {
      const next = new Set(prev);
      if (next.has(p)) { if (next.size > 1) next.delete(p); }
      else next.add(p);
      return next;
    });
  }

  const activeSeries = ALL_SERIES.filter((s) => activeProviders.has(s.provider as Provider));
  const data = buildData(timeline, metric, activeSeries.map((s) => s.key));

  return (
    <div className="rounded-xl border p-5" style={{ background: "#111111", borderColor: "#1f1f1f" }}>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        {/* Provider chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {PROVIDERS.map((p) => {
            const active = activeProviders.has(p);
            return (
              <button
                key={p}
                onClick={() => toggleProvider(p)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 border"
                style={{
                  background: active ? `${PROVIDER_COLORS[p]}22` : "#1a1a1a",
                  borderColor: active ? PROVIDER_COLORS[p] : "#2a2a2a",
                  color: active ? PROVIDER_COLORS[p] : "#71717a",
                }}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ background: active ? PROVIDER_COLORS[p] : "#3f3f46" }}
                />
                {p}
              </button>
            );
          })}
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
      <CostAnalyticsChart data={data} series={activeSeries} metric={metric} />
    </div>
  );
}
