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

// -- pipelines: ordered agent chains --
export type StepRunStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export interface PipelineStep {
  id: string;
  order: number;
  agentId: string;
  agentName: string;
  instruction: string;
}

export interface Pipeline {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  steps: PipelineStep[];
  lastRun: { id: string; status: RunStatus; createdAt: string } | null;
}

export interface PipelineInput {
  name: string;
  description?: string;
  steps: { agentId: string; instruction?: string }[];
}

export interface PipelineStepRun {
  id: string;
  order: number;
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
  output: string;
  status: RunStatus;
  error: string;
  durationMs: number;
  createdAt: string;
  steps: PipelineStepRun[];
}

export interface ErrorEnvelope {
  code: string;
  message: string;
}
