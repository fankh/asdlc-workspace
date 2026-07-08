export type AgentStatus = 'idle' | 'active' | 'paused';
export type Gender = 'female' | 'male' | 'non-binary' | 'unspecified';
export type Importance = 'low' | 'medium' | 'high' | 'critical';

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  status: AgentStatus;
  role: string;
  persona: string;
  skills: string[];
  gender: Gender;
  importance: Importance;
  model: string;
  goal: string;
  createdAt: string;
}

// create/update payload — all attributes optional except name on create
export interface AgentInput {
  name: string;
  description?: string;
  status?: AgentStatus;
  role?: string;
  persona?: string;
  skills?: string[];
  gender?: Gender;
  importance?: Importance;
  model?: string;
  goal?: string;
}

export interface ErrorEnvelope {
  code: string;
  message: string;
}
