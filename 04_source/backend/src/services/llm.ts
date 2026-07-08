// Local-first agent executor. Runs an agent's persona+goal against a task via
// the local Ollama HTTP API. No cloud dependency, no API key — same ethos as
// the rest of the console.
//
// OLLAMA_HOST defaults to localhost for `npm run dev`; in docker compose the
// backend reaches the host daemon at host.docker.internal (wired in compose).

const OLLAMA_HOST = (process.env.OLLAMA_HOST || 'http://localhost:11434').replace(/\/$/, '')
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'qwen3.6:latest'

export interface AgentLike {
  name: string
  role: string
  persona: string
  skills: string[]
  goal: string
  model: string
}

export interface ExecResult {
  output: string
  model: string
}

// Build the instruction the agent runs under from its registered attributes.
export function buildPrompt(agent: AgentLike, task: string): string {
  const lines: string[] = []
  lines.push(`You are ${agent.name}${agent.role ? `, a ${agent.role}` : ''}.`)
  if (agent.persona) lines.push(`Persona: ${agent.persona}`)
  if (agent.skills.length) lines.push(`Your skills: ${agent.skills.join(', ')}.`)
  if (agent.goal) lines.push(`Your standing goal: ${agent.goal}`)
  lines.push('')
  lines.push(`Task:\n${task}`)
  return lines.join('\n')
}

export function modelFor(agent: AgentLike): string {
  return agent.model?.trim() || DEFAULT_MODEL
}

// Map a Prisma Agent record (skills stored as csv) to the executor's shape.
export function toAgentLike(a: any): AgentLike {
  return {
    name: a.name, role: a.role ?? '', persona: a.persona ?? '',
    skills: a.skills ? String(a.skills).split(',').filter(Boolean) : [],
    goal: a.goal ?? '', model: a.model ?? '',
  }
}

// Execute against Ollama. Throws on unreachable daemon / model errors so the
// caller can record a failed run with a useful message.
export async function execute(agent: AgentLike, task: string): Promise<ExecResult> {
  const model = modelFor(agent)
  // This build runs agents locally via Ollama only. Cloud models (Claude/GPT)
  // have no key configured here — fail with an actionable message rather than a
  // confusing "model not installed in Ollama".
  if (/^(claude|gpt|o\d|gemini)/i.test(model)) {
    throw new Error(`"${model}" is a cloud model; this local build runs Ollama models only. Set the agent's model to a local one (e.g. qwen3.6:latest).`)
  }
  let res: Response
  try {
    res = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: buildPrompt(agent, task), stream: false }),
    })
  } catch {
    throw new Error(`Cannot reach the local model at ${OLLAMA_HOST}. Is Ollama running?`)
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    if (res.status === 404) {
      throw new Error(`Model "${model}" is not installed in Ollama (pull it first).`)
    }
    throw new Error(`Model call failed (${res.status}): ${detail.slice(0, 200)}`)
  }
  const data = (await res.json()) as { response?: string }
  return { output: (data.response || '').trim(), model }
}
