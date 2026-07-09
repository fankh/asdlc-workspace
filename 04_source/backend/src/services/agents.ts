import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const GENDERS = ['female', 'male', 'non-binary', 'unspecified'] as const
const IMPORTANCE = ['low', 'medium', 'high', 'critical'] as const
const STATUS = ['idle', 'active', 'paused'] as const

// AI-agent management attributes, all optional on create/update.
const attributeFields = {
  description: z.string().max(500).optional(),
  status: z.enum(STATUS).optional(),
  role: z.string().max(120).optional(),
  persona: z.string().max(500).optional(),
  skills: z.array(z.string().max(60)).max(30).optional(),
  gender: z.enum(GENDERS).optional(),
  importance: z.enum(IMPORTANCE).optional(),
  model: z.string().max(120).optional(),
  goal: z.string().max(1000).optional(),
  context: z.string().max(8000).optional(), // standing knowledge, every run
  memory: z.boolean().optional(), // inject summaries of recent runs
}

export const CreateAgentDto = z.object({
  name: z.string().min(1, 'Agent name is required.'),
  ...attributeFields,
})
export const UpdateAgentDto = z.object({
  name: z.string().min(1, 'Agent name is required.').optional(),
  ...attributeFields,
})

export type CreateAgentInput = z.infer<typeof CreateAgentDto>
export type UpdateAgentInput = z.infer<typeof UpdateAgentDto>

const prisma = new PrismaClient()

export async function listAgents() {
  const records = await prisma.agent.findMany({ orderBy: { createdAt: 'desc' } })
  return records.map(toAgentDto)
}

export async function createAgent(data: CreateAgentInput) {
  const record = await prisma.agent.create({ data: toRecord(data, true) })
  return toAgentDto(record)
}

export async function updateAgent(agentId: string, data: UpdateAgentInput) {
  try {
    const record = await prisma.agent.update({ where: { id: agentId }, data: toRecord(data, false) })
    return toAgentDto(record)
  } catch (e: any) {
    if (e?.code === 'P2025') {
      const err = new Error('Agent not found') as any
      err.code = 'NOT_FOUND'
      err.statusCode = 404
      throw err
    }
    throw e
  }
}

export async function deleteAgent(agentId: string) {
  const records = await prisma.agent.deleteMany({ where: { id: agentId } })
  if (records.count === 0) {
    const err = new Error('Agent not found') as any
    err.code = 'NOT_FOUND'
    err.statusCode = 404
    throw err
  }
  return null // 204 has no body
}

// map DTO -> Prisma record (skills[] -> csv; create defaults status to idle)
function toRecord(data: CreateAgentInput | UpdateAgentInput, isCreate: boolean) {
  const { skills, ...rest } = data as any
  const out: any = { ...rest }
  if (skills !== undefined) out.skills = skills.join(',')
  if (isCreate && !out.status) out.status = 'idle'
  return out
}

function toAgentDto(r: any) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    status: String(r.status).toLowerCase() as (typeof STATUS)[number],
    role: r.role ?? '',
    persona: r.persona ?? '',
    skills: r.skills ? String(r.skills).split(',').filter(Boolean) : [],
    gender: (r.gender ?? 'unspecified') as (typeof GENDERS)[number],
    importance: (r.importance ?? 'medium') as (typeof IMPORTANCE)[number],
    model: r.model ?? '',
    goal: r.goal ?? '',
    context: r.context ?? '',
    memory: r.memory ?? false,
    createdAt: r.createdAt.toISOString(),
  }
}
