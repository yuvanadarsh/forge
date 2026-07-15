export interface Agent {
  id: string;
  name: string;
  role: string;
  specialty: string;
  avatar_color: string;
  model: string;
  system_prompt: string;
  status: "idle" | "working" | "error";
  last_active: string;
  tokens_used: number;
  cost_usd: number;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assigned_to: string;
  priority: "low" | "med" | "high" | "urgent";
  status: "backlog" | "in_progress" | "review" | "completed";
  pipeline_id: string | null;
  created_from_chat: boolean;
  created_at: string;
}

export interface Pipeline {
  id: string;
  title: string;
  description: string;
  status: "pending_approval" | "approved" | "running" | "completed";
  agents: string[];
  created_by: string;
  plan_md: string;
  approved_at: string | null;
}

export interface Conversation {
  id: string;
  agent_id: string;
  task_id: string | null;
  pipeline_id: string | null;
  title: string;
  last_message: string | null;
  last_active: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  agent_id: string;
  role: "user" | "assistant";
  content: string;
  sender_agent_id?: string;
  created_at: string;
}

export interface Provider {
  id: string;
  name: string;
  baseUrl?: string;
  apiKey?: string;
  isDefault?: boolean;
}

// ============================================================
// Phase 2 — backend wire types (lib/api.ts)
// The interfaces above describe the mock-phase UI shapes; the types below
// mirror the FastAPI responses exactly. They converge when the UI is wired
// to the real API next session.
// ============================================================

export interface BackendAgent extends Omit<Agent, "last_active"> {
  last_active: string | null;
}

export interface AgentUsageSummary {
  lifetime_tokens: number;
  lifetime_cost_usd: number;
  month_cost_usd: number;
  avg_cost_per_day_usd: number;
}

export interface BackendAgentDetail extends BackendAgent {
  usage: AgentUsageSummary;
}

export interface AgentCreatePayload {
  name: string;
  role: string;
  specialty?: string;
  avatar_color?: string;
  model?: string;
  system_prompt?: string;
}

export type AgentUpdatePayload = Partial<
  Pick<AgentCreatePayload, "name" | "role" | "specialty" | "system_prompt" | "model">
>;

export interface BackendPipeline {
  id: string;
  title: string;
  description: string;
  status:
    | "pending_approval"
    | "approved"
    | "running"
    | "paused_for_approval"
    | "completed"
    | "failed";
  agent_sequence: string[];
  created_by: string | null;
  plan_md: string;
  workspace_path: string;
  approved_at: string | null;
  created_at: string;
}

export interface PipelineRun {
  id: string;
  pipeline_id: string;
  status:
    | "running"
    | "paused_for_approval"
    | "approved"
    | "completed"
    | "failed"
    | "cancelled";
  langgraph_thread_id: string;
  current_agent_id: string | null;
  current_agent_index: number;
  error: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface BackendPipelineDetail extends BackendPipeline {
  current_run: PipelineRun | null;
}

export interface PipelineCreatePayload {
  title: string;
  description?: string;
  agent_sequence: string[];
  plan_md?: string;
  workspace_path?: string;
  created_by?: string;
}

export interface BackendTask extends Omit<Task, "assigned_to"> {
  assigned_to: string | null;
}

export interface TaskCreatePayload {
  title: string;
  description?: string;
  assigned_to?: string;
  priority?: Task["priority"];
  status?: Task["status"];
  pipeline_id?: string;
  created_from_chat?: boolean;
}

export type TaskUpdatePayload = Partial<
  Pick<TaskCreatePayload, "title" | "description" | "status" | "priority" | "assigned_to">
>;

export interface TaskListFilters {
  status?: Task["status"];
  agent_id?: string;
  pipeline_id?: string;
}

export interface BackendConversation extends Omit<Conversation, "agent_id"> {
  agent_id: string | null; // null = pipeline-level conversation
}

export interface ConversationCreatePayload {
  title: string;
  agent_id?: string;
  task_id?: string;
  pipeline_id?: string;
}

export interface BackendMessage {
  id: string;
  conversation_id: string;
  agent_id: string | null;
  role: "user" | "assistant" | "system" | "tool" | "approval_gate";
  content: string;
  sender_agent_id: string | null;
  gate_status: "pending" | "approved" | "changes_requested" | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  created_at: string;
}

export interface MessagePage {
  items: BackendMessage[];
  page: number;
  page_size: number;
  total: number;
}

export interface NotificationItem {
  id: string;
  type: "pipeline_completed" | "pipeline_failed" | "approval_needed" | "agent_error" | "info";
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export interface ForgeSettings {
  terminal_execution: "always_proceed" | "request_review" | "agent_decides";
  strict_mode: boolean;
  allowed_commands: string[];
  denied_commands: string[];
  default_model: string;
  embedding_model: string;
  workspace_root: string;
  global_rules: string;
  updated_at: string;
}

export type ForgeSettingsUpdate = Partial<Omit<ForgeSettings, "updated_at">>;

export interface ApiKeyInfo {
  id: string;
  provider: string;
  name: string;
  base_url: string | null;
  masked_key: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApiKeyCreatePayload {
  provider: string;
  name: string;
  base_url?: string;
  api_key: string;
  is_default?: boolean;
}

export type ApiKeyUpdatePayload = Partial<Pick<ApiKeyCreatePayload, "name" | "base_url" | "api_key">>;

export type TokenUsageInterval = "day" | "week" | "month" | "all";
export type CostAnalyticsInterval = "day" | "week" | "month" | "year" | "all";

export interface TokenUsagePoint {
  bucket: string; // ISO-8601 bucket start
  tokens: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export interface TokenUsageSeries {
  interval: string;
  points: TokenUsagePoint[];
}

export interface CostAnalyticsModelSlice {
  provider: string;
  model: string;
  cost: number;
  input_tokens: number;
  output_tokens: number;
}

export interface CostAnalyticsBucket {
  label: string; // ISO-8601 bucket start
  models: CostAnalyticsModelSlice[];
}

export interface CostAnalyticsResponse {
  buckets: CostAnalyticsBucket[];
}

export interface AgentRun {
  id: string;
  pipeline_id: string;
  pipeline_title: string;
  status: PipelineRun["status"];
  current_agent_index: number;
  error: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface KeyTestResult {
  success: boolean;
  message: string;
}

// WebSocket envelope pushed on /ws/pipeline/{runId}
export type PipelineEventType =
  | "token"
  | "tool_call"
  | "tool_result"
  | "status"
  | "gate"
  | "complete"
  | "error";

export interface PipelineStreamPayloads {
  token: { token: string };
  tool_call: { tool: string; args: Record<string, unknown> };
  tool_result: { result: string };
  status: { status: string };
  gate: { gate_id: string; summary: string };
  complete: Record<string, never>;
  error: { error: string };
}

export type PipelineStreamEvent = {
  [K in PipelineEventType]: {
    type: K;
    agent_id: string | null;
    payload: PipelineStreamPayloads[K];
    timestamp: string;
  };
}[PipelineEventType];
