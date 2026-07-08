import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import * as llm from './llm.js'

const prisma = new PrismaClient()

const StepDto = z.object({
  agentId: z.string().uuid(),
  instruction: z.string().max(2000).optional(),
  posX: z.number().int().min(-100000).max(100000).optional(),
  posY: z.number().int().min(-100000).max(100000).optional(),
})

export const CreatePipelineDto = z.object({
  name: z.string().min(1, 'Pipeline name is required.').max(120),
  description: z.string().max(500).optional(),
  steps: z.array(StepDto).min(1, 'A pipeline needs at least one step.').max(10),
})
// Updates use full-replace semantics: the editor always submits the whole chain.
export const UpdatePipelineDto = CreatePipelineDto

export const CreatePipelineRunDto = z.object({
  task: z.string().min(1, 'A task is required to run the pipeline.').max(4000),
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

const includeSteps = {
  steps: { include: { agent: true }, orderBy: { order: 'asc' as const } },
}

async function assertAgentsExist(steps: { agentId: string }[]) {
  const ids = [...new Set(steps.map(s => s.agentId))]
  const found = await prisma.agent.findMany({ where: { id: { in: ids } }, select: { id: true } })
  if (found.length !== ids.length) {
    const err = new Error('One or more selected agents no longer exist.') as any
    err.code = 'VALIDATION_FAILED'; err.statusCode = 400
    throw err
  }
}

export async function listPipelines() {
  const pipelines = await prisma.pipeline.findMany({
    include: { ...includeSteps, runs: { orderBy: { createdAt: 'desc' }, take: 1 } },
    orderBy: { createdAt: 'desc' },
  })
  return pipelines.map(toPipelineDto)
}

export async function createPipeline(data: CreatePipelineInput) {
  await assertAgentsExist(data.steps)
  try {
    const p = await prisma.pipeline.create({
      data: {
        name: data.name,
        description: data.description ?? '',
        steps: { create: data.steps.map(toStepRecord) },
      },
      include: includeSteps,
    })
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

function toStepRecord(s: z.infer<typeof StepDto>, i: number) {
  return { order: i, agentId: s.agentId, instruction: s.instruction ?? '', posX: s.posX ?? 0, posY: s.posY ?? 0 }
}

export async function updatePipeline(pipelineId: string, data: CreatePipelineInput) {
  await assertAgentsExist(data.steps)
  try {
    const p = await prisma.pipeline.update({
      where: { id: pipelineId },
      data: {
        name: data.name,
        description: data.description ?? '',
        steps: {
          deleteMany: {},
          create: data.steps.map(toStepRecord),
        },
      },
      include: includeSteps,
    })
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

// Create the run with every step snapshotted as `pending`, then execute the
// chain in the background; the frontend polls getPipelineRun until terminal.
export async function startPipelineRun(pipelineId: string, data: CreatePipelineRunInput) {
  const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId }, include: includeSteps })
  if (!pipeline) notFound('Pipeline')
  if (pipeline.steps.length === 0) {
    const err = new Error('This pipeline has no steps.') as any
    err.code = 'VALIDATION_FAILED'; err.statusCode = 400
    throw err
  }
  const run = await prisma.pipelineRun.create({
    data: {
      pipelineId,
      task: data.task,
      steps: {
        create: pipeline.steps.map(s => ({
          order: s.order,
          agentId: s.agentId,
          agentName: s.agent?.name ?? '(deleted agent)',
          instruction: s.instruction ?? '',
          model: s.agent ? llm.modelFor(llm.toAgentLike(s.agent)) : '',
        })),
      },
    },
    include: { steps: { orderBy: { order: 'asc' } } },
  })
  void executePipelineRun(run.id) // fire-and-forget; failures land on the run
  return toPipelineRunDto(run)
}

// Sequential chain: step N's output is step N+1's input. A failed step fails
// the run; later steps stay `pending` so the UI shows where it stopped.
export async function executePipelineRun(runId: string): Promise<void> {
  const run = await prisma.pipelineRun.findUnique({
    where: { id: runId },
    include: { steps: { orderBy: { order: 'asc' } } },
  })
  if (!run) return
  const started = Date.now()
  let input = run.task
  for (const step of run.steps) {
    const stepStarted = Date.now()
    const agent = await prisma.agent.findUnique({ where: { id: step.agentId } })
    const task = composeStepTask(step.instruction ?? '', input)
    await prisma.pipelineStepRun.update({ where: { id: step.id }, data: { status: 'running', task } })
    try {
      if (!agent) throw new Error(`Agent "${step.agentName}" no longer exists.`)
      const { output, model } = await llm.execute(llm.toAgentLike(agent), task)
      await prisma.pipelineStepRun.update({
        where: { id: step.id },
        data: { output, model, status: 'succeeded', durationMs: Date.now() - stepStarted },
      })
      input = output
    } catch (e: any) {
      const message = e?.message || 'Step execution failed.'
      await prisma.pipelineStepRun.update({
        where: { id: step.id },
        data: { status: 'failed', error: message, durationMs: Date.now() - stepStarted },
      })
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
  }
  await prisma.pipelineRun.update({
    where: { id: runId },
    data: { status: 'succeeded', output: input, durationMs: Date.now() - started },
  })
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
    createdAt: p.createdAt.toISOString(),
    steps: p.steps.map((s: any) => ({
      id: s.id,
      order: s.order,
      agentId: s.agentId,
      agentName: s.agent?.name ?? '(deleted agent)',
      instruction: s.instruction ?? '',
      posX: s.posX ?? 0,
      posY: s.posY ?? 0,
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
    output: r.output ?? '',
    status: r.status as 'running' | 'succeeded' | 'failed',
    error: r.error ?? '',
    durationMs: r.durationMs ?? 0,
    createdAt: r.createdAt.toISOString(),
    steps: (r.steps ?? []).map((s: any) => ({
      id: s.id,
      order: s.order,
      agentId: s.agentId,
      agentName: s.agentName,
      instruction: s.instruction ?? '',
      model: s.model ?? '',
      task: s.task ?? '',
      output: s.output ?? '',
      status: s.status as 'pending' | 'running' | 'succeeded' | 'failed',
      error: s.error ?? '',
      durationMs: s.durationMs ?? 0,
    })),
  }
}
