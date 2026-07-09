import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import * as llm from './llm.js'
import * as vecmem from './vecmem.js'

const prisma = new PrismaClient()

export const CreateRunDto = z.object({
  task: z.string().min(1, 'A task is required to run the agent.').max(16000),
})
export type CreateRunInput = z.infer<typeof CreateRunDto>

// Create a run in `running` and kick off execution in the background. Returns
// immediately so the request never blocks on a slow local model; the frontend
// polls getRun until status leaves `running`.
export async function startRun(agentId: string, data: CreateRunInput) {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } })
  if (!agent) {
    const err = new Error('Agent not found') as any
    err.code = 'NOT_FOUND'; err.statusCode = 404
    throw err
  }
  const run = await prisma.agentRun.create({
    data: { agentId, task: data.task, model: llm.modelFor(toAgentLike(agent)) },
  })
  void executeRun(run.id) // fire-and-forget; errors are recorded on the run
  return toRunDto(run)
}

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim()

// Episodic memory: a compact, newest-first digest of the agent's recent
// successful work (direct runs + pipeline steps). Injected only when the
// agent has `memory` enabled — kept small to respect the context budget.
export async function recentActivity(agentId: string): Promise<string> {
  const [runs, stepRuns] = await Promise.all([
    prisma.agentRun.findMany({
      where: { agentId, status: 'succeeded' },
      orderBy: { createdAt: 'desc' }, take: 3,
    }),
    prisma.pipelineStepRun.findMany({
      where: { agentId, status: 'succeeded' },
      orderBy: { createdAt: 'desc' }, take: 3,
    }),
  ])
  const merged = [...runs, ...stepRuns]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 3)
  return merged
    .map(r => `- asked: ${oneLine(r.task).slice(0, 120)} -> did: ${oneLine(r.output).slice(0, 200)}`)
    .join('\n')
}

// Runs one agent step to completion, persisting the outcome. Exported so a
// future pipeline (Phase 2) can drive chained steps through the same path.
export async function executeRun(runId: string): Promise<void> {
  const run = await prisma.agentRun.findUnique({ where: { id: runId }, include: { agent: true } })
  if (!run) return
  const started = Date.now()
  try {
    // semantic recall (most RELEVANT past runs) with recency fallback
    const recall = run.agent?.memory
      ? (await vecmem.semanticRecall(run.agentId, run.task)) ?? await recentActivity(run.agentId)
      : undefined
    const { output, model } = await llm.execute(toAgentLike(run.agent), run.task, recall)
    await prisma.agentRun.update({
      where: { id: runId },
      data: { output, model, status: 'succeeded', durationMs: Date.now() - started },
    })
    if (run.agent?.memory) void vecmem.remember(run.agentId, runId, run.task, output)
  } catch (e: any) {
    await prisma.agentRun.update({
      where: { id: runId },
      data: { status: 'failed', error: e?.message || 'Execution failed.', durationMs: Date.now() - started },
    })
  }
}

export async function listRuns(agentId: string) {
  const runs = await prisma.agentRun.findMany({
    where: { agentId }, orderBy: { createdAt: 'desc' }, take: 50,
  })
  return runs.map(toRunDto)
}

export async function getRun(runId: string) {
  const run = await prisma.agentRun.findUnique({ where: { id: runId } })
  if (!run) {
    const err = new Error('Run not found') as any
    err.code = 'NOT_FOUND'; err.statusCode = 404
    throw err
  }
  return toRunDto(run)
}

const toAgentLike = llm.toAgentLike

function toRunDto(r: any) {
  return {
    id: r.id,
    agentId: r.agentId,
    task: r.task,
    output: r.output ?? '',
    status: r.status as 'running' | 'succeeded' | 'failed',
    model: r.model ?? '',
    error: r.error ?? '',
    durationMs: r.durationMs ?? 0,
    createdAt: r.createdAt.toISOString(),
  }
}
