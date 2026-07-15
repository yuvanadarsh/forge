// Typed client for the Forge FastAPI backend.
// Created in the backend-foundation session; the UI still renders mock data —
// pages switch over to these functions next session.

import type {
  AgentCreatePayload,
  AgentRun,
  AgentUpdatePayload,
  ApiKeyCreatePayload,
  ApiKeyInfo,
  ApiKeyUpdatePayload,
  BackendAgent,
  BackendAgentDetail,
  BackendConversation,
  BackendMessage,
  BackendPipeline,
  BackendPipelineDetail,
  BackendTask,
  ConversationCreatePayload,
  CostAnalyticsInterval,
  CostAnalyticsResponse,
  ForgeSettings,
  ForgeSettingsUpdate,
  KeyTestResult,
  MessagePage,
  NotificationItem,
  PipelineCreatePayload,
  PipelineRun,
  PipelineStreamEvent,
  SendMessageResult,
  TaskCreatePayload,
  TaskListFilters,
  TaskUpdatePayload,
  TokenUsageInterval,
  TokenUsageSeries,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    detail: string,
  ) {
    super(detail);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body: unknown = await response.json();
      if (body && typeof body === "object" && "detail" in body) {
        detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
      }
    } catch {
      // non-JSON error body — statusText is the best we have
    }
    throw new ApiError(response.status, detail);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
const patch = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
const del = (path: string) => request<void>(path, { method: "DELETE" });

function query(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

// ---------------------------------------------------------------- health

export const getHealth = () => get<{ status: string }>("/health");

// ---------------------------------------------------------------- agents

export const listAgents = () => get<BackendAgent[]>("/api/agents");
export const createAgent = (payload: AgentCreatePayload) =>
  post<BackendAgent>("/api/agents", payload);
export const getAgent = (agentId: string) =>
  get<BackendAgentDetail>(`/api/agents/${agentId}`);
export const updateAgent = (agentId: string, payload: AgentUpdatePayload) =>
  patch<BackendAgent>(`/api/agents/${agentId}`, payload);
export const deleteAgent = (agentId: string) => del(`/api/agents/${agentId}`);
export const listAgentRuns = (agentId: string) =>
  get<AgentRun[]>(`/api/agents/${agentId}/runs`);

// ---------------------------------------------------------------- settings

export const getSettings = () => get<ForgeSettings>("/api/settings");
export const updateSettings = (payload: ForgeSettingsUpdate) =>
  patch<ForgeSettings>("/api/settings", payload);

export const listApiKeys = () => get<ApiKeyInfo[]>("/api/settings/api-keys");
export const addApiKey = (payload: ApiKeyCreatePayload) =>
  post<ApiKeyInfo>("/api/settings/api-keys", payload);
export const updateApiKey = (keyId: string, payload: ApiKeyUpdatePayload) =>
  patch<ApiKeyInfo>(`/api/settings/api-keys/${keyId}`, payload);
export const deleteApiKey = (keyId: string) => del(`/api/settings/api-keys/${keyId}`);
export const testApiKey = (keyId: string) =>
  post<KeyTestResult>(`/api/settings/api-keys/${keyId}/test`);
export const reembedAllData = () => post<{ status: string }>("/api/settings/reembed");

// ---------------------------------------------------------------- analytics

export const getTokenUsage = (params: { agent_id?: string; interval?: TokenUsageInterval } = {}) =>
  get<TokenUsageSeries>(`/api/token-usage${query({ ...params })}`);
export const getCostAnalytics = (
  params: { interval?: CostAnalyticsInterval; providers?: string } = {},
) => get<CostAnalyticsResponse>(`/api/analytics/cost${query({ ...params })}`);

// ---------------------------------------------------------------- pipelines

export const listPipelines = () => get<BackendPipeline[]>("/api/pipelines");
export const createPipeline = (payload: PipelineCreatePayload) =>
  post<BackendPipeline>("/api/pipelines", payload);
export const getPipeline = (pipelineId: string) =>
  get<BackendPipelineDetail>(`/api/pipelines/${pipelineId}`);
export const approvePipeline = (pipelineId: string) =>
  post<PipelineRun>(`/api/pipelines/${pipelineId}/approve`);
export const approveGate = (pipelineId: string, runId: string) =>
  post<PipelineRun>(`/api/pipelines/${pipelineId}/runs/${runId}/approve-gate`);
export const listPipelineRuns = (pipelineId: string) =>
  get<PipelineRun[]>(`/api/pipelines/${pipelineId}/runs`);

// ---------------------------------------------------------------- tasks

export const listTasks = (filters: TaskListFilters = {}) =>
  get<BackendTask[]>(`/api/tasks${query({ ...filters })}`);
export const createTask = (payload: TaskCreatePayload) =>
  post<BackendTask>("/api/tasks", payload);
export const updateTask = (taskId: string, payload: TaskUpdatePayload) =>
  patch<BackendTask>(`/api/tasks/${taskId}`, payload);
export const deleteTask = (taskId: string) => del(`/api/tasks/${taskId}`);

// ---------------------------------------------------------------- conversations

export const listConversations = (
  filters: { agent_id?: string; pipeline_id?: string; task_id?: string } = {},
) => get<BackendConversation[]>(`/api/conversations${query(filters)}`);
export const createConversation = (payload: ConversationCreatePayload) =>
  post<BackendConversation>("/api/conversations", payload);
export const listMessages = (conversationId: string, page = 1) =>
  get<MessagePage>(`/api/conversations/${conversationId}/messages${query({ page: String(page) })}`);
export const sendMessage = (conversationId: string, content: string) =>
  post<SendMessageResult>(`/api/conversations/${conversationId}/messages`, { content });
export const deleteConversation = (conversationId: string) =>
  del(`/api/conversations/${conversationId}`);
export const updateConversation = (conversationId: string, title: string) =>
  patch<BackendConversation>(`/api/conversations/${conversationId}`, { title });

// ---------------------------------------------------------------- notifications

export const listNotifications = () => get<NotificationItem[]>("/api/notifications");
export const markNotificationRead = (notificationId: string) =>
  patch<NotificationItem>(`/api/notifications/${notificationId}/read`, {});
export const markAllNotificationsRead = () =>
  post<{ marked_read: number }>("/api/notifications/read-all");
export const deleteNotification = (notificationId: string) =>
  del(`/api/notifications/${notificationId}`);

// ---------------------------------------------------------------- websocket

/** One socket per active pipeline run: ws://…/ws/pipeline/{runId} */
export function createPipelineSocket(runId: string): WebSocket {
  return new WebSocket(`${WS_URL}/ws/pipeline/${runId}`);
}

/** Parse one WebSocket frame into the typed envelope (null on malformed data). */
export function parsePipelineEvent(data: string): PipelineStreamEvent | null {
  try {
    return JSON.parse(data) as PipelineStreamEvent;
  } catch {
    return null;
  }
}
