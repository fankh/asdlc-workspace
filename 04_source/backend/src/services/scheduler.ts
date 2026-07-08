// Interval-trigger scheduler for the automated development lifecycle: every
// tick, fire each enabled interval pipeline whose interval has elapsed —
// never overlapping (a pipeline with a run still in `running` is skipped).

import { PrismaClient } from '@prisma/client'
import { MIN_INTERVAL_SEC, startPipelineRun } from './pipelines.js'

const prisma = new PrismaClient()
const TICK_MS = Number(process.env.SCHEDULER_TICK_MS || 15_000)

export interface Schedulable {
  enabled: boolean
  triggerType: string
  intervalSec: number
  defaultTask: string
  lastTriggeredAt: Date | null
}

// Pure due-check (unit tested): enabled interval pipelines with a sane
// interval and a task, whose interval has elapsed since the last trigger.
export function isDue(p: Schedulable, now: number): boolean {
  if (!p.enabled || p.triggerType !== 'interval') return false
  if (p.intervalSec < MIN_INTERVAL_SEC || !p.defaultTask.trim()) return false
  const last = p.lastTriggeredAt?.getTime() ?? 0
  return now - last >= p.intervalSec * 1000
}

export async function tick(): Promise<number> {
  const candidates = await prisma.pipeline.findMany({
    where: { enabled: true, triggerType: 'interval' },
  })
  let fired = 0
  for (const p of candidates) {
    if (!isDue(p, Date.now())) continue
    const running = await prisma.pipelineRun.count({ where: { pipelineId: p.id, status: 'running' } })
    if (running > 0) continue // never overlap runs of the same pipeline
    try {
      await startPipelineRun(p.id, { task: p.defaultTask }, 'interval')
      fired += 1
      console.log(`scheduler: fired "${p.name}" (every ${p.intervalSec}s)`)
    } catch (e: any) {
      console.error(`scheduler: failed to fire "${p.name}": ${e?.message}`)
    }
  }
  return fired
}

export function startScheduler(): void {
  const timer = setInterval(() => { void tick() }, TICK_MS)
  timer.unref?.() // never keep the process alive just for the scheduler
  console.log(`scheduler: interval triggers active (tick ${TICK_MS}ms)`)
}
