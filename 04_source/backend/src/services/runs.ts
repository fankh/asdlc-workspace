import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import * as llm from './llm.js'

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

// Runs one agent step to completion, persisting the outcome. Exported so a
// future pipeline (Phase 2) can drive chained steps through the same path.
export async function executeRun(runId: string): Promise<void> {
  const run = await prisma.agentRun.findUnique({ where: { id: runId }, include: { agent: true } })
  if (!run) return
  const started = Date.now()
  try {
    const { output, model } = await llm.execute(toAgentLike(run.agent), run.task)
    await prisma.agentRun.update({
      where: { id: runId },
      data: { output, model, status: 'succeeded', durationMs: Date.now() - started },
    })
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
