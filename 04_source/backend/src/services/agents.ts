import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

export const CreateAgentDto = z.object({
  name: z.string().min(1, 'Agent name is required.'),
  description: z.string().max(500).optional(),
})

export type CreateAgentInput = z.infer<typeof CreateAgentDto>

const prisma = new PrismaClient()

export async function listAgents() {
  const records = await prisma.agent.findMany({ orderBy: { createdAt: 'desc' } })
  return toAgentDto(records)
}

export async function createAgent(data: CreateAgentInput) {
  const record = await prisma.agent.create({ data: { ...data, status: 'idle' } })
  return toAgentDto([record])[0]
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

function toAgentDto(records: any[]) {
  return records.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    status: r.status.toLowerCase() as 'idle' | 'active' | 'paused',
    createdAt: r.createdAt.toISOString(),
  }))
}
