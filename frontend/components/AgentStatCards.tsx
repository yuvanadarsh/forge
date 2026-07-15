import { AgentUsageSummary } from "@/types";

interface AgentStatCardsProps {
  usage: AgentUsageSummary;
}

export default function AgentStatCards({ usage }: AgentStatCardsProps) {
  const cards = [
    { label: "LIFETIME COST", value: `$${usage.lifetime_cost_usd.toFixed(2)}` },
    { label: "THIS MONTH", value: `$${usage.month_cost_usd.toFixed(2)}` },
    { label: "AVG PER DAY", value: `$${usage.avg_cost_per_day_usd.toFixed(2)}` },
  ];

  return (
    <div className="grid grid-cols-3 gap-4 mb-4">
      {cards.map(({ label, value }) => (
        <div
          key={label}
          className="rounded-xl px-5 py-4"
          style={{ background: "#111111", border: "1px solid #1f1f1f" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#71717a" }}>
            {label}
          </p>
          <p className="text-2xl font-bold" style={{ color: "#f5f5f5" }}>
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}
