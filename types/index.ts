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
  created_at: string;
}

export interface Provider {
  id: string;
  name: string;
  baseUrl?: string;
  apiKey?: string;
  isDefault?: boolean;
}
