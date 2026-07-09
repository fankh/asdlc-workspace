import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import * as vecmem from './vecmem.js'

const prisma = new PrismaClient()

// The vector store keys memories by agent_id only; this layer joins agent
// names back in (from the relational DB) for a human-readable memory view.

export const MemoryQueryDto = z.object({
  agentId: z.string().uuid().optional(),
  q: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
})
export type MemoryQuery = z.infer<typeof MemoryQueryDto>

export interface MemoryDto {
  rowid: number
  agentId: string
  agentName: string
  snippet: string
  distance: number | null
  relevance: number | null // 0..1, only for search results
}

async function nameMap(ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map()
  const agents = await prisma.agent.findMany({
    where: { id: { in: [...new Set(ids)] } }, select: { id: true, name: true },
  })
  return new Map(agents.map(a => [a.id, a.name]))
}

function toDto(m: vecmem.StoredMemory, names: Map<string, string>): MemoryDto {
  return {
    rowid: m.rowid,
    agentId: m.agentId,
    agentName: names.get(m.agentId) ?? '(deleted agent)',
    snippet: m.snippet,
    distance: m.distance ?? null,
    relevance: m.distance != null ? Number((1 / (1 + m.distance)).toFixed(3)) : null,
  }
}

export interface MemoryView {
  enabled: boolean
  total: number
  byAgent: { agentId: string; agentName: string; count: number }[]
  memories: MemoryDto[]
  searched: boolean
}

export async function memoryView(query: MemoryQuery): Promise<MemoryView> {
  const enabled = vecmem.isEnabled()
  const stats = vecmem.memoryStats()
  const statNames = await nameMap(stats.map(s => s.agentId))

  let raw: vecmem.StoredMemory[]
  let searched = false
  if (query.q?.trim()) {
    const hits = await vecmem.searchMemories(query.q.trim(), query.agentId, query.limit ?? 20)
    raw = hits ?? []
    searched = true
  } else {
    raw = vecmem.listMemories(query.agentId, query.limit ?? 100)
  }
  const names = await nameMap(raw.map(m => m.agentId))

  return {
    enabled,
    total: stats.reduce((a, s) => a + s.count, 0),
    byAgent: stats
      .map(s => ({ agentId: s.agentId, agentName: statNames.get(s.agentId) ?? '(deleted agent)', count: s.count }))
      .sort((a, b) => b.count - a.count),
    memories: raw.map(m => toDto(m, names)),
    searched,
  }
}

export function forgetMemory(rowid: number): boolean {
  return vecmem.forgetRow(rowid)
}

export function forgetAgentMemory(agentId: string): void {
  vecmem.forget(agentId)
}
