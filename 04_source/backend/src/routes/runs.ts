import { Router, Request, Response } from 'express'
import { z } from 'zod'
import * as runService from '../services/runs.js'

const AgentIdSchema = z.string().uuid()
const RunIdSchema = z.string().uuid()

// Mounted at /api/agents — owns the per-agent runs collection.
export const agentRunsRouter = Router()

agentRunsRouter.get('/:agentId/runs', async (req: Request, res: Response) => {
  try {
    const agentId = AgentIdSchema.parse(req.params.agentId)
    res.json(await runService.listRuns(agentId))
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ code: 'VALIDATION_FAILED', message: err.errors[0].message })
    }
    throw err
  }
})

agentRunsRouter.post('/:agentId/runs', async (req: Request, res: Response) => {
  try {
    const agentId = AgentIdSchema.parse(req.params.agentId)
    const data = runService.CreateRunDto.parse(req.body)
    const run = await runService.startRun(agentId, data)
    res.status(202).setHeader('Location', `/api/runs/${run.id}`).json(run)
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ code: 'VALIDATION_FAILED', message: err.errors[0].message })
    }
    if (err?.statusCode === 404) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Agent not found' })
    }
    throw err
  }
})

// Mounted at /api/runs — single run lookup for polling.
export const runsRouter = Router()

runsRouter.get('/:runId', async (req: Request, res: Response) => {
  try {
    const runId = RunIdSchema.parse(req.params.runId)
    res.json(await runService.getRun(runId))
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ code: 'VALIDATION_FAILED', message: err.errors[0].message })
    }
    if (err?.statusCode === 404) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Run not found' })
    }
    throw err
  }
})
