import { Router, Request, Response } from 'express'
import { z } from 'zod'
import * as pipelineService from '../services/pipelines.js'

const IdSchema = z.string().uuid()

function fail(res: Response, err: any) {
  if (err instanceof z.ZodError) {
    return res.status(400).json({ code: 'VALIDATION_FAILED', message: err.errors[0].message })
  }
  if (err?.statusCode) {
    return res.status(err.statusCode).json({ code: err.code || 'ERROR', message: err.message })
  }
  throw err
}

// Mounted at /api/pipelines
export const pipelinesRouter = Router()

pipelinesRouter.get('/', async (_req: Request, res: Response) => {
  res.json(await pipelineService.listPipelines())
})

pipelinesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const data = pipelineService.CreatePipelineDto.parse(req.body)
    const pipeline = await pipelineService.createPipeline(data)
    res.status(201).setHeader('Location', `/api/pipelines/${pipeline.id}`).json(pipeline)
  } catch (err) { fail(res, err) }
})

pipelinesRouter.put('/:pipelineId', async (req: Request, res: Response) => {
  try {
    const id = IdSchema.parse(req.params.pipelineId)
    const data = pipelineService.UpdatePipelineDto.parse(req.body)
    res.json(await pipelineService.updatePipeline(id, data))
  } catch (err) { fail(res, err) }
})

pipelinesRouter.delete('/:pipelineId', async (req: Request, res: Response) => {
  try {
    const id = IdSchema.parse(req.params.pipelineId)
    await pipelineService.deletePipeline(id)
    res.status(204).send()
  } catch (err) { fail(res, err) }
})

pipelinesRouter.get('/:pipelineId/runs', async (req: Request, res: Response) => {
  try {
    const id = IdSchema.parse(req.params.pipelineId)
    res.json(await pipelineService.listPipelineRuns(id))
  } catch (err) { fail(res, err) }
})

pipelinesRouter.post('/:pipelineId/runs', async (req: Request, res: Response) => {
  try {
    const id = IdSchema.parse(req.params.pipelineId)
    const data = pipelineService.CreatePipelineRunDto.parse(req.body)
    const run = await pipelineService.startPipelineRun(id, data)
    res.status(202).setHeader('Location', `/api/pipeline-runs/${run.id}`).json(run)
  } catch (err) { fail(res, err) }
})

// Mounted at /api/pipeline-runs — single run lookup for polling.
export const pipelineRunsRouter = Router()

pipelineRunsRouter.get('/:runId', async (req: Request, res: Response) => {
  try {
    const id = IdSchema.parse(req.params.runId)
    res.json(await pipelineService.getPipelineRun(id))
  } catch (err) { fail(res, err) }
})
