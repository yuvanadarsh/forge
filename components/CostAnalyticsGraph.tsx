"use client";

import { useState } from "react";
import CostAnalyticsChart, {
  type Metric,
  type Timeline,
  type ModelSeries,
  type DataPoint,
} from "./CostAnalyticsChart";

// ── Provider / model definitions ─────────────────────────────────────────────

const ALL_SERIES: ModelSeries[] = [
  { key: "claude_opus",    label: "Claude Opus",    color: "#f59e0b", provider: "Anthropic" },
  { key: "claude_sonnet",  label: "Claude Sonnet",  color: "#fbbf24", provider: "Anthropic" },
  { key: "claude_haiku",   label: "Claude Haiku",   color: "#fde68a", provider: "Anthropic" },
  { key: "gpt4o",          label: "GPT-4o",         color: "#22c55e", provider: "OpenAI"    },
  { key: "gpt4o_mini",     label: "GPT-4o Mini",    color: "#86efac", provider: "OpenAI"    },
  { key: "gemini_pro",     label: "Gemini Pro",     color: "#3b82f6", provider: "Gemini"    },
  { key: "gemini_flash",   label: "Gemini Flash",   color: "#93c5fd", provider: "Gemini"    },
  { key: "deepseek_v3",    label: "DeepSeek V3",    color: "#a855f7", provider: "DeepSeek"  },
  { key: "deepseek_r1",    label: "DeepSeek R1",    color: "#d8b4fe", provider: "DeepSeek"  },
];

const PROVIDERS = ["Anthropic", "OpenAI", "Gemini", "DeepSeek"] as const;
type Provider = (typeof PROVIDERS)[number];

const PROVIDER_COLORS: Record<Provider, string> = {
  Anthropic: "#f59e0b",
  OpenAI:    "#22c55e",
  Gemini:    "#3b82f6",
  DeepSeek:  "#a855f7",
};

const METRIC_OPTIONS: { key: Metric; label: string }[] = [
  { key: "input_tokens",  label: "Input Tokens"  },
  { key: "output_tokens", label: "Output Tokens" },
  { key: "cost",          label: "Cost"           },
];

const TIMELINE_OPTIONS: { key: Timeline; label: string }[] = [
  { key: "day",   label: "Day"      },
  { key: "week",  label: "Week"     },
  { key: "month", label: "Month"    },
  { key: "year",  label: "Year"     },
  { key: "all",   label: "All Time" },
];

// ── Mock data generation ──────────────────────────────────────────────────────

const SEEDS: Record<string, number> = {
  claude_opus: 7,  claude_sonnet: 13, claude_haiku: 3,
  gpt4o: 11,       gpt4o_mini: 5,
  gemini_pro: 9,   gemini_flash: 2,
  deepseek_v3: 6,  deepseek_r1: 4,
};

const TOKEN_SCALES: Record<string, number> = {
  claude_opus: 18000,  claude_sonnet: 42000, claude_haiku: 12000,
  gpt4o: 28000,        gpt4o_mini: 35000,
  gemini_pro: 22000,   gemini_flash: 48000,
  deepseek_v3: 31000,  deepseek_r1: 19000,
};

const COST_SCALES: Record<string, number> = {
  claude_opus: 0.18,   claude_sonnet: 0.06,  claude_haiku: 0.008,
  gpt4o: 0.12,         gpt4o_mini: 0.018,
  gemini_pro: 0.09,    gemini_flash: 0.006,
  deepseek_v3: 0.022,  deepseek_r1: 0.04,
};

function rand(i: number, seed: number, scale: number) {
  return Math.max(0, Math.round((Math.sin(i * 2.3 + seed) * 0.35 + 0.65) * scale));
}

function randCost(i: number, seed: number, scale: number) {
  return Math.max(0, parseFloat(((Math.sin(i * 2.3 + seed) * 0.35 + 0.65) * scale).toFixed(5)));
}

const WEEK_LABELS  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABELS = ["Wk 1", "Wk 2", "Wk 3", "Wk 4"];
const YEAR_LABELS  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const ALL_LABELS   = ["2025 Q3","2025 Q4","2026 Q1","2026 Q2"];

function getLabels(timeline: Timeline): string[] {
  if (timeline === "day")   return Array.from({ length: 8 }, (_, i) => `${i * 3}:00`);
  if (timeline === "week")  return WEEK_LABELS;
  if (timeline === "month") return MONTH_LABELS;
  if (timeline === "year")  return YEAR_LABELS;
  return ALL_LABELS;
}

function buildData(timeline: Timeline, metric: Metric, keys: string[]): DataPoint[] {
  const labels = getLabels(timeline);
  return labels.map((label, i) => {
    const point: DataPoint = { label };
    for (const key of keys) {
      const seed = SEEDS[key] ?? 5;
      const scale = metric === "cost" ? COST_SCALES[key] ?? 0.05 : TOKEN_SCALES[key] ?? 20000;
      point[key] = metric === "cost" ? randCost(i, seed, scale) : rand(i, seed, scale);
    }
    return point;
  });
}

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
