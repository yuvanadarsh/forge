"use client";

// Global app state — React Context + useReducer, no external library.
// ForgeProvider fetches agents/tasks/pipelines/notifications once on mount;
// pages read from the store and dispatch after mutations so every view
// reflects changes immediately without refetching.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";

import {
  listAgents,
  listNotifications,
  listPipelines,
  listTasks,
} from "@/lib/api";
import type {
  BackendAgent,
  BackendConversation,
  BackendPipeline,
  BackendTask,
  ForgeSettings,
  NotificationItem,
} from "@/types";

export interface ForgeState {
  agents: BackendAgent[];
  tasks: BackendTask[];
  pipelines: BackendPipeline[];
  conversations: BackendConversation[];
  notifications: NotificationItem[];
  settings: ForgeSettings | null;
  loading: {
    agents: boolean;
    tasks: boolean;
    pipelines: boolean;
  };
  error: string | null;
}

export type ForgeAction =
  | { type: "SET_AGENTS"; agents: BackendAgent[] }
  | { type: "SET_TASKS"; tasks: BackendTask[] }
  | { type: "SET_PIPELINES"; pipelines: BackendPipeline[] }
  | { type: "SET_CONVERSATIONS"; conversations: BackendConversation[] }
  | { type: "UPDATE_CONVERSATION"; conversation: BackendConversation }
  | { type: "DELETE_CONVERSATION"; conversationId: string }
  | { type: "SET_NOTIFICATIONS"; notifications: NotificationItem[] }
  | { type: "SET_SETTINGS"; settings: ForgeSettings }
  | { type: "ADD_AGENT"; agent: BackendAgent }
  | { type: "UPDATE_AGENT"; agent: BackendAgent }
  | { type: "DELETE_AGENT"; agentId: string }
  | { type: "ADD_TASK"; task: BackendTask }
  | { type: "UPDATE_TASK"; task: BackendTask }
  | { type: "DELETE_TASK"; taskId: string }
  | { type: "ADD_PIPELINE"; pipeline: BackendPipeline }
  | { type: "MARK_NOTIFICATION_READ"; notificationId: string }
  | { type: "MARK_ALL_NOTIFICATIONS_READ" }
  | { type: "SET_LOADING"; key: keyof ForgeState["loading"]; value: boolean }
  | { type: "SET_ERROR"; error: string | null };

const initialState: ForgeState = {
  agents: [],
  tasks: [],
  pipelines: [],
  conversations: [],
  notifications: [],
  settings: null,
  // The initial fetch fires on mount, so these start true to avoid an
  // empty-state flash before the first response lands.
  loading: { agents: true, tasks: true, pipelines: true },
  error: null,
};

function forgeReducer(state: ForgeState, action: ForgeAction): ForgeState {
  switch (action.type) {
    case "SET_AGENTS":
      return { ...state, agents: action.agents };
    case "SET_TASKS":
      return { ...state, tasks: action.tasks };
    case "SET_PIPELINES":
      return { ...state, pipelines: action.pipelines };
    case "SET_CONVERSATIONS":
      return { ...state, conversations: action.conversations };
    case "UPDATE_CONVERSATION":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.conversation.id ? action.conversation : c,
        ),
      };
    case "DELETE_CONVERSATION":
      return {
        ...state,
        conversations: state.conversations.filter((c) => c.id !== action.conversationId),
      };
    case "SET_NOTIFICATIONS":
      return { ...state, notifications: action.notifications };
    case "SET_SETTINGS":
      return { ...state, settings: action.settings };
    case "ADD_AGENT":
      return { ...state, agents: [...state.agents, action.agent] };
    case "UPDATE_AGENT":
      return {
        ...state,
        agents: state.agents.map((a) => (a.id === action.agent.id ? action.agent : a)),
      };
    case "DELETE_AGENT":
      return { ...state, agents: state.agents.filter((a) => a.id !== action.agentId) };
    case "ADD_TASK":
      return { ...state, tasks: [action.task, ...state.tasks] };
    case "UPDATE_TASK":
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.task.id ? action.task : t)),
      };
    case "DELETE_TASK":
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.taskId) };
    case "ADD_PIPELINE":
      return { ...state, pipelines: [action.pipeline, ...state.pipelines] };
    case "MARK_NOTIFICATION_READ":
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          n.id === action.notificationId ? { ...n, read: true } : n,
        ),
      };
    case "MARK_ALL_NOTIFICATIONS_READ":
      return {
        ...state,
        notifications: state.notifications.map((n) => (n.read ? n : { ...n, read: true })),
      };
    case "SET_LOADING":
      return { ...state, loading: { ...state.loading, [action.key]: action.value } };
    case "SET_ERROR":
      return { ...state, error: action.error };
  }
}

interface ForgeContextValue {
  state: ForgeState;
  dispatch: Dispatch<ForgeAction>;
  /** Re-runs the initial parallel fetch (used by error-state retry). */
  reload: () => Promise<void>;
}

const ForgeContext = createContext<ForgeContextValue | null>(null);

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function ForgeProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(forgeReducer, initialState);

  const reload = useCallback(async () => {
    dispatch({ type: "SET_ERROR", error: null });
    for (const key of ["agents", "tasks", "pipelines"] as const) {
      dispatch({ type: "SET_LOADING", key, value: true });
    }

    const [agents, tasks, pipelines, notifications] = await Promise.allSettled([
      listAgents(),
      listTasks(),
      listPipelines(),
      listNotifications(),
    ]);

    if (agents.status === "fulfilled") dispatch({ type: "SET_AGENTS", agents: agents.value });
    dispatch({ type: "SET_LOADING", key: "agents", value: false });
    if (tasks.status === "fulfilled") dispatch({ type: "SET_TASKS", tasks: tasks.value });
    dispatch({ type: "SET_LOADING", key: "tasks", value: false });
    if (pipelines.status === "fulfilled")
      dispatch({ type: "SET_PIPELINES", pipelines: pipelines.value });
    dispatch({ type: "SET_LOADING", key: "pipelines", value: false });
    if (notifications.status === "fulfilled")
      dispatch({ type: "SET_NOTIFICATIONS", notifications: notifications.value });

    const failed = [agents, tasks, pipelines, notifications].filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );
    if (failed.length > 0) {
      dispatch({
        type: "SET_ERROR",
        error: `Failed to load data from the backend — ${errorMessage(failed[0].reason)}`,
      });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo(() => ({ state, dispatch, reload }), [state, reload]);

  return <ForgeContext.Provider value={value}>{children}</ForgeContext.Provider>;
}

export function useForge(): ForgeContextValue {
  const ctx = useContext(ForgeContext);
  if (ctx === null) {
    throw new Error("useForge must be used inside <ForgeProvider>");
  }
  return ctx;
}

export function useAgent(id: string): BackendAgent | null {
  const { state } = useForge();
  return state.agents.find((a) => a.id === id) ?? null;
}

export function usePipeline(id: string): BackendPipeline | null {
  const { state } = useForge();
  return state.pipelines.find((p) => p.id === id) ?? null;
}
