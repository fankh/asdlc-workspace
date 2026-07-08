import express from 'express'
import cors from 'cors'
import agentRoutes from './routes/agents.js'
import { agentRunsRouter, runsRouter } from './routes/runs.js'
import { Request, Response, NextFunction } from 'express'

const app = express()

// Middleware
app.use(cors())
app.use(express.json())

// Health endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' })
})

// Routes
app.use('/api/agents', agentRunsRouter) // /api/agents/:id/runs (before agentRoutes)
app.use('/api/agents', agentRoutes)
app.use('/api/runs', runsRouter)

// Error middleware (must be last)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.statusCode || 500
  const code = err.code || 'INTERNAL_ERROR'
  const message = status === 500
    ? 'An unexpected error occurred. Please try again.'
    : (err.message || 'Request failed.')
  res.status(status).json({ code, message })
})

export default app
