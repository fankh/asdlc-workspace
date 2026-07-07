import { Router, Request, Response } from 'express'
import { z } from 'zod'
import * as agentService from '../services/agents.js'

const router = Router()

const AgentIdSchema = z.string().uuid()

router.get('/', async (_req: Request, res: Response) => {
  const agents = await agentService.listAgents()
  res.json(agents)
})

router.post('/', async (req: Request, res: Response) => {
  try {
    const data = agentService.CreateAgentDto.parse(req.body)
    const agent = await agentService.createAgent(data)
    res.status(201).setHeader('Location', `/api/agents/${agent.id}`).json(agent)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ code: 'VALIDATION_FAILED', message: err.errors[0].message })
    }
    throw err
  }
})

router.delete('/:agentId', async (req: Request, res: Response) => {
  try {
    const parsed = AgentIdSchema.parse(req.params.agentId)
    await agentService.deleteAgent(parsed)
    res.status(204).send()
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ code: 'VALIDATION_FAILED', message: err.errors[0].message })
    }
    throw err
  }
})

export default router
