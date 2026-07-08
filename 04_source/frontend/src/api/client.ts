import { Agent, AgentInput, AgentRun, ErrorEnvelope } from './types';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// Centralized fetch wrapper per CODING_PATTERNS.md Section 6.
// Strips internal traces and normalizes error envelopes before throwing.
async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts?.headers || {}) } });
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
