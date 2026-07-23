// Kept as reference — not imported in production.

import type { Metric, Timeline, ModelSeries, DataPoint } from "@/components/CostAnalyticsChart";

// ── Provider / model definitions ─────────────────────────────────────────────

export const ALL_SERIES: ModelSeries[] = [
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

export const PROVIDERS = ["Anthropic", "OpenAI", "Gemini", "DeepSeek"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const PROVIDER_COLORS: Record<Provider, string> = {
  Anthropic: "#f59e0b",
  OpenAI:    "#22c55e",
  Gemini:    "#3b82f6",
  DeepSeek:  "#a855f7",
};

export const METRIC_OPTIONS: { key: Metric; label: string }[] = [
  { key: "input_tokens",  label: "Input Tokens"  },
  { key: "output_tokens", label: "Output Tokens" },
  { key: "cost",          label: "Cost"           },
];

export const TIMELINE_OPTIONS: { key: Timeline; label: string }[] = [
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

export function buildData(timeline: Timeline, metric: Metric, keys: string[]): DataPoint[] {
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
