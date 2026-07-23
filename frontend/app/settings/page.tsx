"use client";

import { useCallback, useEffect, useState } from "react";
import Toast from "@/components/Toast";
import AddProviderModal from "@/components/AddProviderModal";
import ProviderRow, { type ProviderRowData } from "@/components/ProviderRow";
import EmbeddingsSection from "@/components/EmbeddingsSection";
import ExportSection from "@/components/ExportSection";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import {
  deleteApiKey,
  getSettings,
  listApiKeys,
  testApiKey,
  updateApiKey,
  updateSettings,
  addApiKey,
} from "@/lib/api";
import { useForge } from "@/lib/store";
import type { ApiKeyInfo, ForgeSettings } from "@/types";

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-base font-semibold" style={{ color: "#f5f5f5" }}>{title}</h2>
      {subtitle && <p className="text-xs mt-0.5" style={{ color: "#71717a" }}>{subtitle}</p>}
    </div>
  );
}

const TERMINAL_EXECUTION_OPTIONS: {
  value: ForgeSettings["terminal_execution"];
  label: string;
  description: string;
}[] = [
  {
    value: "always_proceed",
    label: "Always Proceed",
    description:
      "Agents run all commands without asking. Best for trusted pipelines running overnight. Fastest execution.",
  },
  {
    value: "request_review",
    label: "Request Review",
    description:
      "Agents ask before running any terminal command. You approve each one. Best for sensitive projects or unfamiliar codebases.",
  },
  {
    value: "agent_decides",
    label: "Agent Decides",
    description:
      "Agents use judgment — safe commands run automatically, risky ones (rm, sudo, curl) ask for approval. Balanced default.",
  },
];

interface SecurityDraft {
  terminal_execution: ForgeSettings["terminal_execution"];
  strict_mode: boolean;
  allowed_commands: string; // one per line in the textarea
  denied_commands: string;
}

interface CostDraft {
  max_run_cost: string; // kept as strings while editing number inputs
  max_agent_cost: string;
  max_daily_cost: string;
}

function toRow(key: ApiKeyInfo): ProviderRowData {
  return {
    id: key.id,
    provider: key.provider,
    name: key.name,
    baseUrl: key.base_url,
    maskedKey: key.masked_key,
    isDefault: key.is_default,
  };
}

export default function SettingsPage() {
  const { dispatch } = useForge();
  // null = loading
  const [keys, setKeys] = useState<ApiKeyInfo[] | null>(null);
  const [settings, setSettings] = useState<ForgeSettings | null>(null);
  const [security, setSecurity] = useState<SecurityDraft | null>(null);
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [cost, setCost] = useState<CostDraft | null>(null);
  const [savingCost, setSavingCost] = useState(false);
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const refreshKeys = useCallback(async () => {
    setKeys(await listApiKeys());
  }, []);

  useEffect(() => {
    listApiKeys()
      .then(setKeys)
      .catch(() => {
        setKeys([]);
        setToast("Could not load API keys — is the backend running?");
      });
    getSettings()
      .then((s) => {
        setSettings(s);
        dispatch({ type: "SET_SETTINGS", settings: s });
        setSecurity({
          terminal_execution: s.terminal_execution,
          strict_mode: s.strict_mode,
          allowed_commands: s.allowed_commands.join("\n"),
          denied_commands: s.denied_commands.join("\n"),
        });
        setCost({
          max_run_cost: String(s.max_run_cost),
          max_agent_cost: String(s.max_agent_cost),
          max_daily_cost: String(s.max_daily_cost),
        });
      })
      .catch(() => setToast("Could not load settings — is the backend running?"));
  }, [dispatch]);

  // The Anthropic row is always shown first; before a key exists it renders
  // as a "Not configured" default row (no delete button).
  const anthropicKey =
    keys?.find((k) => k.provider.toLowerCase() === "anthropic" && k.is_default) ??
    keys?.find((k) => k.provider.toLowerCase() === "anthropic");
  const rows: ProviderRowData[] = [
    anthropicKey
      ? toRow(anthropicKey)
      : { id: null, provider: "anthropic", name: "Anthropic", baseUrl: null, maskedKey: null, isDefault: true },
    ...(keys ?? []).filter((k) => k.id !== anthropicKey?.id).map(toRow),
  ];

  async function handleSaveKey(row: ProviderRowData, key: string): Promise<boolean> {
    try {
      if (row.id === null) {
        await addApiKey({
          provider: row.provider,
          name: row.name,
          api_key: key,
          is_default: row.isDefault,
        });
      } else {
        await updateApiKey(row.id, { api_key: key });
      }
      await refreshKeys();
      setToast(`${row.name} key saved`);
      return true;
    } catch (err) {
      setToast(`Could not save key: ${err instanceof Error ? err.message : "unknown error"}`);
      return false;
    }
  }

  async function handleDelete(row: ProviderRowData) {
    if (!row.id) return;
    try {
      await deleteApiKey(row.id);
      await refreshKeys();
      setToast(`${row.name} removed`);
    } catch (err) {
      setToast(`Could not delete: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  async function handleTest(row: ProviderRowData) {
    if (!row.id) {
      setToast(`Add a ${row.name} key first, then test it.`);
      return;
    }
    try {
      const result = await testApiKey(row.id);
      setToast(`${result.success ? "✓" : "✗"} ${result.message}`);
    } catch (err) {
      setToast(`Test failed: ${err instanceof Error ? err.message : "backend unreachable"}`);
    }
  }

  async function saveSecurity() {
    if (!security || savingSecurity) return;
    setSavingSecurity(true);
    const splitLines = (text: string) =>
      text.split("\n").map((line) => line.trim()).filter(Boolean);
    try {
      const updated = await updateSettings({
        terminal_execution: security.terminal_execution,
        strict_mode: security.strict_mode,
        allowed_commands: splitLines(security.allowed_commands),
        denied_commands: splitLines(security.denied_commands),
      });
      setSettings(updated);
      dispatch({ type: "SET_SETTINGS", settings: updated });
      setToast("Security settings saved");
    } catch (err) {
      setToast(`Could not save settings: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setSavingSecurity(false);
    }
  }

  async function saveCost() {
    if (!cost || savingCost) return;
    const parsed = {
      max_run_cost: Number(cost.max_run_cost),
      max_agent_cost: Number(cost.max_agent_cost),
      max_daily_cost: Number(cost.max_daily_cost),
    };
    if (Object.values(parsed).some((v) => !Number.isFinite(v) || v < 0)) {
      setToast("Cost limits must be zero or positive numbers");
      return;
    }
    setSavingCost(true);
    try {
      const updated = await updateSettings(parsed);
      setSettings(updated);
      dispatch({ type: "SET_SETTINGS", settings: updated });
      setCost({
        max_run_cost: String(updated.max_run_cost),
        max_agent_cost: String(updated.max_agent_cost),
        max_daily_cost: String(updated.max_daily_cost),
      });
      setToast("Cost protection saved");
    } catch (err) {
      setToast(`Could not save limits: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setSavingCost(false);
    }
  }

  const card = "rounded-xl border p-6 mb-6";
  const cardSt = { background: "#111111", borderColor: "#1f1f1f" };
  const inputSt = { background: "#0d0d0d", borderColor: "#1f1f1f", color: "#f5f5f5" };

  return (
    <div className="px-8 py-8 max-w-[720px] mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: "#f5f5f5" }}>Settings</h1>
        <p className="text-sm mt-1" style={{ color: "#71717a" }}>
          Manage API keys, security, embedding models, and data exports.
        </p>
      </div>

      {/* Section 1: API Keys */}
      <div className={card} style={cardSt}>
        <SectionHeader
          title="API Keys"
          subtitle="Keys are stored encrypted in the database — not in .env files"
        />
        <div className="space-y-3">
          {keys === null ? (
            <LoadingSkeleton variant="row" count={2} />
          ) : (
            rows.map((row) => (
              <ProviderRow
                key={row.id ?? `default-${row.provider}`}
                provider={row}
                onSaveKey={handleSaveKey}
                onDelete={handleDelete}
                onTest={handleTest}
              />
            ))
          )}
        </div>
        <button
          onClick={() => setShowAddProvider(true)}
          className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150"
          style={{ background: "#1a1a00", color: "#f59e0b", border: "1px solid #3a2a00" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#2a2000"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#1a1a00"; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Provider
        </button>
      </div>

      {/* How Execution Works */}
      <div className={card} style={cardSt}>
        <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-3" style={{ color: "#f5f5f5" }}>
          ⚡ How Forge runs your pipelines
        </h3>
        <p className="text-xs leading-relaxed mb-4" style={{ color: "#a1a1aa" }}>
          Once you approve a pipeline, agents work autonomously until completion. The
          execution mode controls how much oversight you have:
        </p>
        <div className="space-y-3">
          {[
            {
              title: "Full Auto (Always Proceed, Strict Mode OFF)",
              body: "Agents run start to finish. You only see results.",
              best: "well-defined tasks, trusted codebases, overnight runs.",
            },
            {
              title: "Supervised (Request Review)",
              body: "Agents ask before each terminal command.",
              best: "sensitive projects, learning what agents are doing.",
            },
            {
              title: "Strict (Strict Mode ON)",
              body: "Agents ask before every action including file reads.",
              best: "maximum control, auditing agent behavior.",
            },
          ].map((mode) => (
            <div key={mode.title}>
              <p className="text-xs font-medium" style={{ color: "#f5f5f5" }}>{mode.title}</p>
              <p className="text-xs leading-relaxed" style={{ color: "#71717a" }}>
                → {mode.body}
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "#71717a" }}>
                → Best for: {mode.best}
              </p>
            </div>
          ))}
        </div>
        <p className="text-xs leading-relaxed mt-4" style={{ color: "#a1a1aa" }}>
          Per-pipeline override: set execution mode when creating a pipeline to override
          these global defaults for that specific job.
        </p>
      </div>

      {/* Section 2: Security & Execution */}
      <div className={card} style={cardSt}>
        <SectionHeader
          title="Security & Execution"
          subtitle="Controls how much autonomy agents have when running commands"
        />
        {security === null ? (
          <LoadingSkeleton variant="text" count={2} />
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: "#71717a" }}>
                  Terminal Execution
                </label>
                <select
                  value={security.terminal_execution}
                  onChange={(e) =>
                    setSecurity({
                      ...security,
                      terminal_execution: e.target.value as ForgeSettings["terminal_execution"],
                    })
                  }
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none border cursor-pointer transition-colors duration-150"
                  style={inputSt}
                >
                  {TERMINAL_EXECUTION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "#71717a" }}>
                  {TERMINAL_EXECUTION_OPTIONS.find((o) => o.value === security.terminal_execution)?.description}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: "#71717a" }}>
                  Strict Mode
                </label>
                <button
                  onClick={() => setSecurity({ ...security, strict_mode: !security.strict_mode })}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border w-full transition-colors duration-150"
                  style={{ background: "#0d0d0d", borderColor: security.strict_mode ? "#f59e0b" : "#1f1f1f" }}
                >
                  <span
                    className="relative inline-block w-11 h-6 rounded-full overflow-hidden transition-colors duration-150 shrink-0"
                    style={{ background: security.strict_mode ? "#f59e0b" : "#2a2a2a" }}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform duration-150 ${
                        security.strict_mode ? "translate-x-5" : "translate-x-0"
                      }`}
                      style={{ background: security.strict_mode ? "#0a0a0a" : "#71717a" }}
                    />
                  </span>
                  <span className="text-sm" style={{ color: security.strict_mode ? "#f5f5f5" : "#71717a" }}>
                    {security.strict_mode ? "On — approve every action" : "Off"}
                  </span>
                </button>
                <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "#71717a" }}>
                  When ON: agents ask for your approval before every file write, file read,
                  and terminal command. Overrides Terminal Execution setting. Use for
                  maximum control. Significantly slows execution. When OFF: agents work
                  according to the Terminal Execution setting above.
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: "#71717a" }}>
                Allowed Commands <span style={{ color: "#3f3f46" }}>(one per line — always run)</span>
              </label>
              <textarea
                value={security.allowed_commands}
                onChange={(e) => setSecurity({ ...security, allowed_commands: e.target.value })}
                rows={3}
                placeholder={"ls\ngit status"}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none border font-mono resize-none transition-colors duration-150"
                style={inputSt}
                onFocus={(e) => (e.target.style.borderColor = "#f59e0b")}
                onBlur={(e) => (e.target.style.borderColor = "#1f1f1f")}
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: "#71717a" }}>
                Denied Commands <span style={{ color: "#3f3f46" }}>(one per line — always blocked)</span>
              </label>
              <textarea
                value={security.denied_commands}
                onChange={(e) => setSecurity({ ...security, denied_commands: e.target.value })}
                rows={3}
                placeholder={"rm -rf\nsudo"}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none border font-mono resize-none transition-colors duration-150"
                style={inputSt}
                onFocus={(e) => (e.target.style.borderColor = "#f59e0b")}
                onBlur={(e) => (e.target.style.borderColor = "#1f1f1f")}
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={saveSecurity}
                disabled={savingSecurity}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-150"
                style={{ background: savingSecurity ? "#2a2a2a" : "#f59e0b", color: savingSecurity ? "#3f3f46" : "#0a0a0a" }}
              >
                {savingSecurity ? "Saving…" : "Save Security Settings"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Section 3: Cost Protection */}
      <div className={card} style={cardSt}>
        <SectionHeader
          title="Cost Protection"
          subtitle="Hard spending ceilings enforced before every LLM call"
        />
        {cost === null ? (
          <LoadingSkeleton variant="text" count={2} />
        ) : (
          <div className="space-y-5">
            <p className="text-xs leading-relaxed" style={{ color: "#71717a" }}>
              Agents stop automatically when these limits are reached. A notification is
              sent and the pipeline is marked failed. Raise these limits in Settings if
              your pipelines need more budget.
            </p>
            <div className="grid grid-cols-3 gap-4">
              {(
                [
                  { key: "max_run_cost", label: "Max cost per run ($)" },
                  { key: "max_agent_cost", label: "Max cost per agent ($)" },
                  { key: "max_daily_cost", label: "Max daily spend ($)" },
                ] as const
              ).map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs font-medium block mb-1.5" style={{ color: "#71717a" }}>
                    {label}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={cost[key]}
                    onChange={(e) => setCost({ ...cost, [key]: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg text-sm outline-none border transition-colors duration-150"
                    style={inputSt}
                    onFocus={(e) => (e.target.style.borderColor = "#f59e0b")}
                    onBlur={(e) => (e.target.style.borderColor = "#1f1f1f")}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs flex items-center gap-1.5" style={{ color: "#f59e0b" }}>
              ⚠️ Agents that exceed these limits will be stopped automatically
            </p>
            <div className="flex justify-end">
              <button
                onClick={saveCost}
                disabled={savingCost}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-150"
                style={{ background: savingCost ? "#2a2a2a" : "#f59e0b", color: savingCost ? "#3f3f46" : "#0a0a0a" }}
              >
                {savingCost ? "Saving…" : "Save Cost Limits"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Section 4: Embeddings */}
      <div className={card} style={cardSt}>
        <SectionHeader title="Embeddings" />
        <EmbeddingsSection embeddingModel={settings?.embedding_model ?? null} showToast={setToast} />
      </div>

      {/* Section 5: Export Data */}
      <div className={card} style={cardSt}>
        <SectionHeader title="Export Data" subtitle="Download all your data as formatted JSON files" />
        <ExportSection showToast={setToast} />
      </div>

      {showAddProvider && (
        <AddProviderModal
          onClose={() => setShowAddProvider(false)}
          onAdd={(created) => {
            setShowAddProvider(false);
            refreshKeys().catch(() => {});
            setToast(`${created.name} added`);
          }}
          onError={(message) => setToast(`Could not add provider: ${message}`)}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
