import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import * as llm from './llm.js'
import { recentActivity } from './runs.js'

const prisma = new PrismaClient()

export type TriggerSource = 'manual' | 'interval' | 'webhook'
export const MIN_INTERVAL_SEC = 10
export const NODE_TYPES = ['agent', 'logic', 'skill', 'http'] as const
export type NodeType = (typeof NODE_TYPES)[number]

const StepDto = z.object({
  nodeType: z.enum(NODE_TYPES).optional(), // defaults to agent
  agentId: z.string().uuid().optional(),
  instruction: z.string().max(2000).optional(),
  config: z.record(z.any()).optional(),
  posX: z.number().int().min(-100000).max(100000).optional(),
  posY: z.number().int().min(-100000).max(100000).optional(),
})

const EdgeDto = z.object({
  from: z.number().int().min(0), // index into steps[]
  to: z.number().int().min(0),
  branch: z.enum(['true', 'false', '']).optional(), // set on edges leaving a logic node
})

export const CreatePipelineDto = z.object({
  name: z.string().min(1, 'Pipeline name is required.').max(120),
  description: z.string().max(500).optional(),
  triggerType: z.enum(['manual', 'interval', 'webhook']).optional(),
  intervalSec: z.number().int().min(0).max(7 * 86400).optional(),
  defaultTask: z.string().max(16000).optional(),
  enabled: z.boolean().optional(),
  steps: z.array(StepDto).min(1, 'A pipeline needs at least one step.').max(12),
  edges: z.array(EdgeDto).max(24).optional(), // omitted => linear chain in steps order
}).superRefine((data, ctx) => {
  if (data.triggerType === 'interval') {
    if ((data.intervalSec ?? 0) < MIN_INTERVAL_SEC) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Interval trigger needs an interval of at least ${MIN_INTERVAL_SEC}s.` })
    }
    if (!data.defaultTask?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Interval trigger needs a default task for automated runs.' })
    }
  }
  data.steps.forEach((s, i) => {
    const type = s.nodeType ?? 'agent'
    if (type === 'agent' && !s.agentId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Step ${i + 1}: agent nodes need an agent.` })
    }
    if (type === 'logic' && !(s.config?.value ?? '').toString().trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Step ${i + 1}: logic nodes need a condition value.` })
    }
    if (type === 'http' && !/^https?:\/\//.test(String(s.config?.url ?? ''))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Step ${i + 1}: HTTP nodes need an http(s) URL.` })
    }
  })
  for (const e of data.edges ?? []) {
    if (e.from >= data.steps.length || e.to >= data.steps.length || e.from === e.to) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Edges must connect two different existing steps.' })
    }
  }
})
// Updates use full-replace semantics: the editor always submits the whole graph.
export const UpdatePipelineDto = CreatePipelineDto

export const CreatePipelineRunDto = z.object({
  task: z.string().min(1, 'A task is required to run the pipeline.').max(16000),
})

export type CreatePipelineInput = z.infer<typeof CreatePipelineDto>
export type CreatePipelineRunInput = z.infer<typeof CreatePipelineRunDto>

function notFound(what: string): never {
  const err = new Error(`${what} not found`) as any
  err.code = 'NOT_FOUND'; err.statusCode = 404
  throw err
}

// Per-step input: the previous step's output (or the initial task), optionally
// framed by the step's standing instruction. Pure — unit tested.
export function composeStepTask(instruction: string, input: string): string {
  const directive = instruction.trim()
  return directive ? `${directive}\n\nInput:\n${input}` : input
}

export interface TrailEntry { label: string; output: string }
const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim()

// Trail-aware step input for LLM nodes: keeps the ORIGINAL task and a compact
// digest of earlier steps visible, instead of only the previous output.
// The last trail entry is excluded — its output IS the `input` section.
// Pure — unit tested. Budgets: task 2000 chars, 4 earlier steps × 240 chars.
export function composeStepTaskWithTrail(
  instruction: string, originalTask: string, input: string, trail: TrailEntry[],
): string {
  const parts: string[] = []
  const directive = instruction.trim()
  if (directive) parts.push(directive)
  if (originalTask.trim() && originalTask.trim() !== input.trim()) {
    parts.push(`Original task:\n${originalTask.slice(0, 2000)}`)
  }
  const earlier = trail.slice(0, -1).slice(-4)
  if (earlier.length) {
    parts.push('Earlier steps:\n'
      + earlier.map(t => `- ${t.label}: ${oneLine(t.output).slice(0, 240)}`).join('\n'))
  }
  if (!parts.length) return input
  return parts.join('\n\n') + `\n\nInput:\n${input}`
}

// -- node-type behaviors (pure helpers, unit tested) ---------------------------

export interface LogicConfig { op?: string; value?: string }

// Deterministic branch decision for logic (IF) nodes.
export function evalLogic(config: LogicConfig, input: string): boolean {
  const value = String(config.value ?? '')
  switch (config.op ?? 'contains') {
    case 'contains':
      return input.toLowerCase().includes(value.toLowerCase())
    case 'not_contains':
      return !input.toLowerCase().includes(value.toLowerCase())
    case 'matches_regex':
      try { return new RegExp(value, 'i').test(input) }
      catch { throw new Error(`Invalid regular expression: ${value}`) }
    case 'longer_than':
      return input.length > (parseInt(value, 10) || 0)
    default:
      throw new Error(`Unknown logic operator: ${config.op}`)
  }
}

export interface SkillConfig { skill?: string; param?: string }

// Reusable LLM transforms that need no agent persona.
export function skillInstruction(config: SkillConfig): string {
  switch (config.skill ?? 'summarize') {
    case 'summarize':
      return 'Summarize the input concisely, keeping its original language.'
    case 'translate':
      return `Translate the input into ${(config.param ?? '').trim() || 'English'}. Output only the translation.`
    case 'extract_key_points':
      return 'Extract the key points from the input as a terse bullet list.'
    case 'classify_severity':
      return 'Classify the severity of the input as one of: critical, high, medium, low. Reply with the label on the first line and a one-line justification.'
    case 'custom':
      return (config.param ?? '').trim() || 'Process the input.'
    default:
      throw new Error(`Unknown skill: ${config.skill}`)
  }
}

const SKILL_RUNNER: llm.AgentLike = {
  name: 'Skill runner', role: 'precise text-processing assistant',
  persona: '', skills: [], goal: '', model: '',
}

export interface HttpConfig { method?: string; url?: string }

async function execHttp(config: HttpConfig, input: string): Promise<string> {
  const method = (config.method ?? 'GET').toUpperCase() === 'POST' ? 'POST' : 'GET'
  const url = String(config.url ?? '')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 30_000)
  try {
    const res = await fetch(url, {
      method,
      signal: ctrl.signal,
      ...(method === 'POST'
        ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input }) }
        : {}),
    })
    const text = (await res.text()).slice(0, 8000)
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}: ${text.slice(0, 200)}`)
    return text
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error(`HTTP request to ${url} timed out (30s).`)
    throw e
  } finally {
    clearTimeout(timer)
  }
}

function parseConfig(raw: unknown): Record<string, any> {
  if (raw && typeof raw === 'object') return raw as Record<string, any>
  try { return JSON.parse(String(raw || '{}')) } catch { return {} }
}

// Display label for non-agent nodes (also used in list "chain" column).
export function nodeLabel(nodeType: string, config: Record<string, any>, agentName?: string | null): string {
  switch (nodeType) {
    case 'logic': return `IF ${config.op ?? 'contains'} "${String(config.value ?? '').slice(0, 20)}"`
    case 'skill': return `Skill: ${config.skill === 'custom' ? 'custom' : (config.skill ?? 'summarize')}`
    case 'http': return `HTTP ${(config.method ?? 'GET').toUpperCase()}`
    default: return agentName ?? '(no agent)'
  }
}

// -- crud ----------------------------------------------------------------------

const includeGraph = {
  steps: { include: { agent: true }, orderBy: { order: 'asc' as const } },
  edges: true,
}

async function assertAgentsExist(steps: CreatePipelineInput['steps']) {
  const ids = [...new Set(steps.filter(s => (s.nodeType ?? 'agent') === 'agent' && s.agentId)
    .map(s => s.agentId as string))]
  if (!ids.length) return
  const found = await prisma.agent.findMany({ where: { id: { in: ids } }, select: { id: true } })
  if (found.length !== ids.length) {
    const err = new Error('One or more selected agents no longer exist.') as any
    err.code = 'VALIDATION_FAILED'; err.statusCode = 400
    throw err
  }
}

function toStepRecord(s: z.infer<typeof StepDto>, i: number) {
  const nodeType = s.nodeType ?? 'agent'
  return {
    order: i,
    nodeType,
    agentId: nodeType === 'agent' ? s.agentId ?? null : null,
    instruction: s.instruction ?? '',
    config: JSON.stringify(s.config ?? {}),
    posX: s.posX ?? 0,
    posY: s.posY ?? 0,
  }
}

// Edges reference steps by index in the payload; omitted edges = linear chain.
function normalizeEdges(data: CreatePipelineInput): { from: number; to: number; branch: string }[] {
  if (data.edges?.length) return data.edges.map(e => ({ from: e.from, to: e.to, branch: e.branch ?? '' }))
  return data.steps.slice(1).map((_, i) => ({ from: i, to: i + 1, branch: '' }))
}

async function writeEdges(pipelineId: string, data: CreatePipelineInput) {
  const steps = await prisma.pipelineStep.findMany({
    where: { pipelineId }, orderBy: { order: 'asc' }, select: { id: true },
  })
  const edges = normalizeEdges(data)
  if (edges.length) {
    await prisma.pipelineEdge.createMany({
      data: edges.map(e => ({
        pipelineId, fromId: steps[e.from].id, toId: steps[e.to].id, branch: e.branch,
      })),
    })
  }
}

export async function listPipelines() {
  const pipelines = await prisma.pipeline.findMany({
    include: { ...includeGraph, runs: { orderBy: { createdAt: 'desc' }, take: 1 } },
    orderBy: { createdAt: 'desc' },
  })
  return pipelines.map(toPipelineDto)
}

export async function createPipeline(data: CreatePipelineInput) {
  await assertAgentsExist(data.steps)
  try {
    const created = await prisma.pipeline.create({
      data: {
        name: data.name,
        description: data.description ?? '',
        triggerType: data.triggerType ?? 'manual',
        intervalSec: data.intervalSec ?? 0,
        defaultTask: data.defaultTask ?? '',
        enabled: data.enabled ?? true,
        webhookKey: randomUUID(),
        steps: { create: data.steps.map(toStepRecord) },
      },
    })
    await writeEdges(created.id, data)
    const p = await prisma.pipeline.findUnique({ where: { id: created.id }, include: includeGraph })
    return toPipelineDto(p)
  } catch (e: any) {
    if (e?.code === 'P2002') {
      const err = new Error('A pipeline with that name already exists.') as any
      err.code = 'CONFLICT'; err.statusCode = 409
      throw err
    }
    throw e
  }
}

export async function updatePipeline(pipelineId: string, data: CreatePipelineInput) {
  await assertAgentsExist(data.steps)
  try {
    const existing = await prisma.pipeline.findUnique({ where: { id: pipelineId }, select: { webhookKey: true } })
    await prisma.pipeline.update({
      where: { id: pipelineId },
      data: {
        name: data.name,
        description: data.description ?? '',
        triggerType: data.triggerType ?? 'manual',
        intervalSec: data.intervalSec ?? 0,
        defaultTask: data.defaultTask ?? '',
        enabled: data.enabled ?? true,
        // backfill for rows created before webhooks existed
        ...(existing && !existing.webhookKey ? { webhookKey: randomUUID() } : {}),
        steps: { deleteMany: {} }, // cascades this pipeline's edges via step FKs
      },
    })
    await prisma.pipelineStep.createMany({
      data: data.steps.map((s, i) => ({ ...toStepRecord(s, i), pipelineId })),
    })
    await writeEdges(pipelineId, data)
    const p = await prisma.pipeline.findUnique({ where: { id: pipelineId }, include: includeGraph })
    return toPipelineDto(p)
  } catch (e: any) {
    if (e?.code === 'P2025') notFound('Pipeline')
    if (e?.code === 'P2002') {
      const err = new Error('A pipeline with that name already exists.') as any
      err.code = 'CONFLICT'; err.statusCode = 409
      throw err
    }
    throw e
  }
}

export async function deletePipeline(pipelineId: string) {
  const res = await prisma.pipeline.deleteMany({ where: { id: pipelineId } })
  if (res.count === 0) notFound('Pipeline')
  return null
}

// -- execution ---------------------------------------------------------------

// Create the run with every node snapshotted as `pending` plus the edge graph,
// then walk it in the background; the frontend polls getPipelineRun.
export async function startPipelineRun(pipelineId: string, data: CreatePipelineRunInput,
                                        trigger: TriggerSource = 'manual') {
  const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId }, include: includeGraph })
  if (!pipeline) notFound('Pipeline')
  if (pipeline.steps.length === 0) {
    const err = new Error('This pipeline has no steps.') as any
    err.code = 'VALIDATION_FAILED'; err.statusCode = 400
    throw err
  }
  const orderById = new Map(pipeline.steps.map(s => [s.id, s.order]))
  const graph = pipeline.edges.map(e => ({
    from: orderById.get(e.fromId), to: orderById.get(e.toId), branch: e.branch ?? '',
  })).filter(e => e.from !== undefined && e.to !== undefined)
  await prisma.pipeline.update({ where: { id: pipelineId }, data: { lastTriggeredAt: new Date() } })
  const run = await prisma.pipelineRun.create({
    data: {
      pipelineId,
      task: data.task,
      trigger,
      graph: JSON.stringify(graph),
      steps: {
        create: pipeline.steps.map(s => {
          const config = parseConfig(s.config)
          return {
            order: s.order,
            nodeType: s.nodeType ?? 'agent',
            agentId: s.agentId ?? '',
            agentName: nodeLabel(s.nodeType ?? 'agent', config, s.agent?.name),
            instruction: s.instruction ?? '',
            config: JSON.stringify(config),
            model: s.agent ? llm.modelFor(llm.toAgentLike(s.agent)) : '',
          }
        }),
      },
    },
    include: { steps: { orderBy: { order: 'asc' } } },
  })
  void executePipelineRun(run.id) // fire-and-forget; failures land on the run
  return toPipelineRunDto(run)
}

// Walk the snapshot graph from its start node. Logic nodes pick the edge whose
// branch matches their verdict; everything else follows its single edge. Nodes
// on branches not taken end as `skipped`.
export async function executePipelineRun(runId: string): Promise<void> {
  const run = await prisma.pipelineRun.findUnique({
    where: { id: runId },
    include: { steps: { orderBy: { order: 'asc' } } },
  })
  if (!run) return
  const started = Date.now()
  let graph: { from: number; to: number; branch: string }[] = []
  try { graph = JSON.parse(run.graph || '[]') } catch { graph = [] }
  if (!graph.length && run.steps.length > 1) { // legacy linear runs
    graph = run.steps.slice(1).map((_, i) => ({ from: i, to: i + 1, branch: '' }))
  }
  const byOrder = new Map(run.steps.map(s => [s.order, s]))
  const skipRest = () => prisma.pipelineStepRun.updateMany({
    where: { pipelineRunId: runId, status: 'pending' }, data: { status: 'skipped' },
  })

  const withIncoming = new Set(graph.map(e => e.to))
  const starts = run.steps.filter(s => !withIncoming.has(s.order))
  if (starts.length !== 1) {
    await skipRest()
    await prisma.pipelineRun.update({
      where: { id: runId },
      data: { status: 'failed', error: 'The graph needs exactly one start node (no branches merging back).', durationMs: Date.now() - started },
    })
    return
  }

  let current: any = starts[0]
  let input = run.task
  const trail: TrailEntry[] = [] // executed non-logic steps, for context
  const visited = new Set<number>()
  while (current && !visited.has(current.order)) {
    visited.add(current.order)
    const step: any = current
    const stepStarted = Date.now()
    const config = parseConfig(step.config)
    let branch = ''
    try {
      let task = input
      let output = input
      let model = ''
      switch (step.nodeType) {
        case 'logic': {
          await mark(step.id, { status: 'running', task })
          const verdict = evalLogic(config, input)
          branch = String(verdict)
          output = input // logic nodes pass the text through untouched
          break
        }
        case 'skill': {
          task = composeStepTaskWithTrail(skillInstruction(config), run.task, input, trail)
          await mark(step.id, { status: 'running', task })
          const r = await llm.execute(SKILL_RUNNER, task)
          output = r.output; model = r.model
          break
        }
        case 'http': {
          await mark(step.id, { status: 'running', task })
          output = await execHttp(config, input)
          break
        }
        default: { // agent
          const agent = step.agentId
            ? await prisma.agent.findUnique({ where: { id: step.agentId } }) : null
          task = composeStepTaskWithTrail(step.instruction ?? '', run.task, input, trail)
          await mark(step.id, { status: 'running', task })
          if (!agent) throw new Error(`Agent "${step.agentName}" no longer exists.`)
          const recall = agent.memory ? await recentActivity(agent.id) : undefined
          const r = await llm.execute(llm.toAgentLike(agent), task, recall)
          output = r.output; model = r.model
        }
      }
      await mark(step.id, {
        output, status: 'succeeded', durationMs: Date.now() - stepStarted,
        ...(model ? { model } : {}),
        ...(step.nodeType === 'logic' ? { output: `→ ${branch}` } : {}),
      })
      if (step.nodeType !== 'logic') {
        trail.push({ label: step.agentName, output })
        input = output
      }
    } catch (e: any) {
      const message = e?.message || 'Step execution failed.'
      await mark(step.id, { status: 'failed', error: message, durationMs: Date.now() - stepStarted })
      await skipRest()
      await prisma.pipelineRun.update({
        where: { id: runId },
        data: {
          status: 'failed',
          error: `Step ${step.order + 1} (${step.agentName}) failed: ${message}`,
          durationMs: Date.now() - started,
        },
      })
      return
    }
    const outs = graph.filter(e => e.from === step.order)
    const next = step.nodeType === 'logic' ? outs.find(e => e.branch === branch) : outs[0]
    current = next ? byOrder.get(next.to) : undefined
  }
  await skipRest()
  await prisma.pipelineRun.update({
    where: { id: runId },
    data: { status: 'succeeded', output: input, durationMs: Date.now() - started },
  })
}

function mark(stepRunId: string, data: Record<string, any>) {
  return prisma.pipelineStepRun.update({ where: { id: stepRunId }, data })
}

export async function listPipelineRuns(pipelineId: string) {
  const runs = await prisma.pipelineRun.findMany({
    where: { pipelineId },
    include: { steps: { orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  return runs.map(toPipelineRunDto)
}

// Fire a pipeline from its webhook key (POST /api/hooks/:key). The caller may
// supply a task; otherwise the pipeline's defaultTask is used.
export async function triggerByWebhook(webhookKey: string, task?: string) {
  const pipeline = await prisma.pipeline.findUnique({ where: { webhookKey } })
  if (!pipeline) notFound('Webhook')
  if (!pipeline.enabled) {
    const err = new Error('This pipeline is disabled.') as any
    err.code = 'DISABLED'; err.statusCode = 409
    throw err
  }
  const effective = (task ?? '').trim() || pipeline.defaultTask.trim()
  if (!effective) {
    const err = new Error('No task: send {"task": "..."} or set a default task on the pipeline.') as any
    err.code = 'VALIDATION_FAILED'; err.statusCode = 400
    throw err
  }
  return startPipelineRun(pipeline.id, { task: effective }, 'webhook')
}

export async function getPipelineRun(runId: string) {
  const run = await prisma.pipelineRun.findUnique({
    where: { id: runId },
    include: { steps: { orderBy: { order: 'asc' } } },
  })
  if (!run) notFound('Run')
  return toPipelineRunDto(run)
}

// -- dtos ----------------------------------------------------------------------

function toPipelineDto(p: any) {
  const lastRun = p.runs?.[0]
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? '',
    triggerType: p.triggerType ?? 'manual',
    intervalSec: p.intervalSec ?? 0,
    defaultTask: p.defaultTask ?? '',
    enabled: p.enabled ?? true,
    webhookPath: p.webhookKey ? `/api/hooks/${p.webhookKey}` : null,
    lastTriggeredAt: p.lastTriggeredAt ? p.lastTriggeredAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    steps: p.steps.map((s: any) => {
      const config = parseConfig(s.config)
      return {
        id: s.id,
        order: s.order,
        nodeType: s.nodeType ?? 'agent',
        agentId: s.agentId ?? null,
        agentName: nodeLabel(s.nodeType ?? 'agent', config, s.agent?.name),
        instruction: s.instruction ?? '',
        config,
        posX: s.posX ?? 0,
        posY: s.posY ?? 0,
      }
    }),
    edges: (p.edges ?? []).map((e: any) => ({
      fromId: e.fromId, toId: e.toId, branch: e.branch ?? '',
    })),
    lastRun: lastRun
      ? { id: lastRun.id, status: lastRun.status, createdAt: lastRun.createdAt.toISOString() }
      : null,
  }
}

function toPipelineRunDto(r: any) {
  return {
    id: r.id,
    pipelineId: r.pipelineId,
    task: r.task,
    trigger: r.trigger ?? 'manual',
    output: r.output ?? '',
    status: r.status as 'running' | 'succeeded' | 'failed',
    error: r.error ?? '',
    durationMs: r.durationMs ?? 0,
    createdAt: r.createdAt.toISOString(),
    steps: (r.steps ?? []).map((s: any) => ({
      id: s.id,
      order: s.order,
      nodeType: s.nodeType ?? 'agent',
      agentId: s.agentId,
      agentName: s.agentName,
      instruction: s.instruction ?? '',
      model: s.model ?? '',
      task: s.task ?? '',
      output: s.output ?? '',
      status: s.status as 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped',
      error: s.error ?? '',
      durationMs: s.durationMs ?? 0,
    })),
  }
}
