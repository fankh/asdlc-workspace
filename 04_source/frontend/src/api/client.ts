import { Agent, AgentInput, AgentRun, ErrorEnvelope, LogEntry, LogQuery, MemoryView, Pipeline, PipelineInput, PipelineRun } from './types';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// '' at root, '/agents' under a subpath deploy (VITE_BASE=/agents/)
export const API_ROOT = import.meta.env.BASE_URL.replace(/\/$/, '');

// Centralized fetch wrapper per CODING_PATTERNS.md Section 6.
// Strips internal traces and normalizes error envelopes before throwing.
async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(API_ROOT + url, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts?.headers || {}) } });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    let errorData: ErrorEnvelope;
    try { errorData = JSON.parse(errText); } catch { errorData = { code: 'NETWORK_ERROR', message: 'Request failed.' }; }
    throw new ApiError(res.status, errorData.code, errorData.message);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export async function listAgents(): Promise<Agent[]> {
  return fetchJson<Agent[]>('/api/agents');
}

export async function createAgent(data: AgentInput): Promise<Agent> {
  return fetchJson<Agent>('/api/agents', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateAgent(agentId: string, data: AgentInput): Promise<Agent> {
  return fetchJson<Agent>(`/api/agents/${agentId}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteAgent(agentId: string): Promise<void> {
  await fetchJson<void>(`/api/agents/${agentId}`, { method: 'DELETE' });
}

// -- agent execution (runs) --
export async function startRun(agentId: string, task: string): Promise<AgentRun> {
  return fetchJson<AgentRun>(`/api/agents/${agentId}/runs`, { method: 'POST', body: JSON.stringify({ task }) });
}

export async function listRuns(agentId: string): Promise<AgentRun[]> {
  return fetchJson<AgentRun[]>(`/api/agents/${agentId}/runs`);
}

export async function getRun(runId: string): Promise<AgentRun> {
  return fetchJson<AgentRun>(`/api/runs/${runId}`);
}

// -- pipelines (agent chains) --
export async function listPipelines(): Promise<Pipeline[]> {
  return fetchJson<Pipeline[]>('/api/pipelines');
}

export async function createPipeline(data: PipelineInput): Promise<Pipeline> {
  return fetchJson<Pipeline>('/api/pipelines', { method: 'POST', body: JSON.stringify(data) });
}

export async function updatePipeline(pipelineId: string, data: PipelineInput): Promise<Pipeline> {
  return fetchJson<Pipeline>(`/api/pipelines/${pipelineId}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deletePipeline(pipelineId: string): Promise<void> {
  await fetchJson<void>(`/api/pipelines/${pipelineId}`, { method: 'DELETE' });
}

export async function startPipelineRun(pipelineId: string, task: string): Promise<PipelineRun> {
  return fetchJson<PipelineRun>(`/api/pipelines/${pipelineId}/runs`, { method: 'POST', body: JSON.stringify({ task }) });
}

export async function listPipelineRuns(pipelineId: string): Promise<PipelineRun[]> {
  return fetchJson<PipelineRun[]>(`/api/pipelines/${pipelineId}/runs`);
}

export async function getPipelineRun(runId: string): Promise<PipelineRun> {
  return fetchJson<PipelineRun>(`/api/pipeline-runs/${runId}`);
}

// -- semantic memory store --
export async function getMemory(opts: { agentId?: string; q?: string; limit?: number } = {}): Promise<MemoryView> {
  const p = new URLSearchParams();
  if (opts.agentId) p.set('agentId', opts.agentId);
  if (opts.q) p.set('q', opts.q);
  if (opts.limit) p.set('limit', String(opts.limit));
  const qs = p.toString();
  return fetchJson<MemoryView>(`/api/memory${qs ? `?${qs}` : ''}`);
}

export async function forgetMemory(rowid: number): Promise<void> {
  await fetchJson<void>(`/api/memory/${rowid}`, { method: 'DELETE' });
}

export async function forgetAgentMemory(agentId: string): Promise<void> {
  await fetchJson<void>(`/api/memory/agent/${agentId}`, { method: 'DELETE' });
}

// -- unified activity log search --
export async function searchLogs(query: LogQuery): Promise<LogEntry[]> {
  const p = new URLSearchParams();
  if (query.q) p.set('q', query.q);
  if (query.status) p.set('status', query.status);
  if (query.kind) p.set('kind', query.kind);
  if (query.limit) p.set('limit', String(query.limit));
  const qs = p.toString();
  return fetchJson<LogEntry[]>(`/api/logs${qs ? `?${qs}` : ''}`);
}
