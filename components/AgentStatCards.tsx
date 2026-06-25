import { Agent } from "@/types";

interface AgentStatCardsProps {
  agent: Agent;
}

export default function AgentStatCards({ agent }: AgentStatCardsProps) {
  const lifetimeCost = agent.cost_usd.toFixed(2);
  const thisMonth = (agent.cost_usd * 0.262).toFixed(2);
  const avgPerDay = (agent.cost_usd / 30).toFixed(2);

  const cards = [
    { label: "LIFETIME COST", value: `$${lifetimeCost}` },
    { label: "THIS MONTH", value: `$${thisMonth}` },
    { label: "AVG PER DAY", value: `$${avgPerDay}` },
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
