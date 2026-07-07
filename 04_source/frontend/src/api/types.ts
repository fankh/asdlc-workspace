export interface Agent {
  id: string;
  name: string;
  description: string | null;
  status: 'idle' | 'active' | 'paused';
  createdAt: string;
}

export interface CreateAgentRequest {
  name: string;
  description?: string;
}

export interface ErrorEnvelope {
  code: string;
  message: string;
}
