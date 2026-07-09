import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { MemoryQueryDto, memoryView, forgetMemory, forgetAgentMemory } from '../services/memory.js'

const router = Router()

// GET /api/memory?agentId=&q=&limit= — list or semantically search stored memory.
router.get('/', async (req: Request, res: Response) => {
  try {
    const query = MemoryQueryDto.parse(req.query)
    res.json(await memoryView(query))
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ code: 'VALIDATION_FAILED', message: err.errors[0].message })
    }
    throw err
  }
})

// DELETE /api/memory/:rowid — forget one memory.
router.delete('/:rowid', (req: Request, res: Response) => {
  const rowid = Number(req.params.rowid)
  if (!Number.isInteger(rowid)) {
    return res.status(400).json({ code: 'VALIDATION_FAILED', message: 'rowid must be an integer' })
  }
  if (!forgetMemory(rowid)) {
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Memory not found' })
  }
  res.status(204).send()
})

// DELETE /api/memory/agent/:agentId — forget an agent's whole memory.
router.delete('/agent/:agentId', (req: Request, res: Response) => {
  try {
    const agentId = z.string().uuid().parse(req.params.agentId)
    forgetAgentMemory(agentId)
    res.status(204).send()
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ code: 'VALIDATION_FAILED', message: 'bad agent id' })
    }
    throw err
  }
})

export default router
