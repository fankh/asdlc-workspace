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
  context: string;
  memory: boolean;
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
  context?: string;
  memory?: boolean;
}

export type RunStatus = 'running' | 'succeeded' | 'failed';

export interface AgentRun {
  id: string;
  agentId: string;
  task: string;
  output: string;
  status: RunStatus;
  model: string;
  error: string;
  durationMs: number;
  createdAt: string;
}

// -- pipelines: node graphs (agent / logic / skill / http) --
export type StepRunStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
export type NodeType = 'agent' | 'logic' | 'skill' | 'http';

export interface PipelineStep {
  id: string;
  order: number;
  nodeType: NodeType;
  agentId: string | null;
  agentName: string; // display label (agent name, or "IF …" / "Skill: …" / "HTTP …")
  instruction: string;
  config: Record<string, any>;
  posX: number;
  posY: number;
}

export interface PipelineEdgeDto {
  fromId: string;
  toId: string;
  branch: string; // 'true' | 'false' on edges leaving a logic node, else ''
}

export type TriggerType = 'manual' | 'interval' | 'webhook';

export interface Pipeline {
  id: string;
  name: string;
  description: string;
  triggerType: TriggerType;
  intervalSec: number;
  defaultTask: string;
  enabled: boolean;
  webhookPath: string | null;
  lastTriggeredAt: string | null;
  createdAt: string;
  steps: PipelineStep[];
  edges: PipelineEdgeDto[];
  lastRun: { id: string; status: RunStatus; createdAt: string } | null;
}

export interface PipelineStepInput {
  nodeType?: NodeType;
  agentId?: string;
  instruction?: string;
  config?: Record<string, any>;
  posX?: number;
  posY?: number;
}

export interface PipelineInput {
  name: string;
  description?: string;
  triggerType?: TriggerType;
  intervalSec?: number;
  defaultTask?: string;
  enabled?: boolean;
  steps: PipelineStepInput[];
  edges?: { from: number; to: number; branch?: string }[]; // indexes into steps
}

export interface PipelineStepRun {
  id: string;
  order: number;
  nodeType: NodeType;
  agentId: string;
  agentName: string;
  instruction: string;
  model: string;
  task: string;
  output: string;
  status: StepRunStatus;
  error: string;
  durationMs: number;
}

export interface PipelineRun {
  id: string;
  pipelineId: string;
  task: string;
  trigger: TriggerType;
  output: string;
  status: RunStatus;
  error: string;
  durationMs: number;
  createdAt: string;
  steps: PipelineStepRun[];
}

// -- unified activity log (agent runs + pipeline runs) --
export interface LogEntry {
  id: string;
  kind: 'agent' | 'pipeline';
  source: string;
  task: string;
  output: string;
  status: string;
  trigger: string;
  model: string;
  durationMs: number;
  createdAt: string;
}

export interface LogQuery {
  q?: string;
  status?: 'running' | 'succeeded' | 'failed';
  kind?: 'agent' | 'pipeline';
  limit?: number;
}

// -- semantic memory store --
export interface MemoryDto {
  rowid: number;
  agentId: string;
  agentName: string;
  snippet: string;
  distance: number | null;
  relevance: number | null; // 0..1, only for search results
}

export interface MemoryView {
  enabled: boolean;
  total: number;
  byAgent: { agentId: string; agentName: string; count: number }[];
  memories: MemoryDto[];
  searched: boolean;
}

export interface ErrorEnvelope {
  code: string;
  message: string;
}
