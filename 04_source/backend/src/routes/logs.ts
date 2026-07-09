import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { LogQueryDto, searchLogs } from '../services/logs.js'

const router = Router()

// GET /api/logs?q=&status=&kind=&limit= — unified activity search.
router.get('/', async (req: Request, res: Response) => {
  try {
    const query = LogQueryDto.parse(req.query)
    res.json(await searchLogs(query))
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ code: 'VALIDATION_FAILED', message: err.errors[0].message })
    }
    throw err
  }
})

export default router
