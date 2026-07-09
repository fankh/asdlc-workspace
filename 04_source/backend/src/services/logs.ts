import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()

// Unified activity log across agent runs and pipeline runs. Full-text-ish
// search (SQLite LIKE, case-insensitive for ASCII) over task + output, with
// status / kind filters, newest first.

export const LogQueryDto = z.object({
  q: z.string().max(200).optional(),
  status: z.enum(['running', 'succeeded', 'failed']).optional(),
  kind: z.enum(['agent', 'pipeline']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
})
export type LogQuery = z.infer<typeof LogQueryDto>

export interface LogEntry {
  id: string
  kind: 'agent' | 'pipeline'
  source: string      // agent or pipeline name
  task: string
  output: string
  status: string
  trigger: string     // 'manual' for agent runs; run trigger for pipelines
  model: string
  durationMs: number
  createdAt: string
}

const like = (q: string) => ({ contains: q }) // SQLite LIKE %q% (case-insensitive)

export async function searchLogs(query: LogQuery): Promise<LogEntry[]> {
  const limit = query.limit ?? 50
  const wantAgent = !query.kind || query.kind === 'agent'
  const wantPipeline = !query.kind || query.kind === 'pipeline'

  const textWhere = query.q
    ? { OR: [{ task: like(query.q) }, { output: like(query.q) }] }
    : {}
  const statusWhere = query.status ? { status: query.status } : {}

  const [agentRuns, pipelineRuns] = await Promise.all([
    wantAgent
      ? prisma.agentRun.findMany({
          where: { ...textWhere, ...statusWhere },
          include: { agent: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: limit,
        })
      : Promise.resolve([]),
    wantPipeline
      ? prisma.pipelineRun.findMany({
          where: { ...textWhere, ...statusWhere },
          include: { pipeline: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: limit,
        })
      : Promise.resolve([]),
  ])

  const entries: LogEntry[] = [
    ...agentRuns.map((r: any): LogEntry => ({
      id: r.id,
      kind: 'agent',
      source: r.agent?.name ?? '(deleted agent)',
      task: r.task,
      output: r.output ?? '',
      status: r.status,
      trigger: 'manual',
      model: r.model ?? '',
      durationMs: r.durationMs ?? 0,
      createdAt: r.createdAt.toISOString(),
    })),
    ...pipelineRuns.map((r: any): LogEntry => ({
      id: r.id,
      kind: 'pipeline',
      source: r.pipeline?.name ?? '(deleted pipeline)',
      task: r.task,
      output: r.output ?? '',
      status: r.status,
      trigger: r.trigger ?? 'manual',
      model: '',
      durationMs: r.durationMs ?? 0,
      createdAt: r.createdAt.toISOString(),
    })),
  ]

  entries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  return entries.slice(0, limit)
}
