import { describe, it, expect } from 'vitest'
import { isDue, type Schedulable } from './scheduler.js'

const base: Schedulable = {
  enabled: true,
  triggerType: 'interval',
  intervalSec: 60,
  defaultTask: 'audit the app',
  lastTriggeredAt: null,
}
const NOW = 1_000_000_000_000

describe('isDue', () => {
  it('fires immediately when never triggered', () => {
    expect(isDue(base, NOW)).toBe(true)
  })

  it('waits for the interval to elapse since the last trigger', () => {
    const p = { ...base, lastTriggeredAt: new Date(NOW - 30_000) }
    expect(isDue(p, NOW)).toBe(false) // 30s of 60s elapsed
    expect(isDue(p, NOW + 30_000)).toBe(true) // exactly due
  })

  it('never fires disabled or non-interval pipelines', () => {
    expect(isDue({ ...base, enabled: false }, NOW)).toBe(false)
    expect(isDue({ ...base, triggerType: 'manual' }, NOW)).toBe(false)
    expect(isDue({ ...base, triggerType: 'webhook' }, NOW)).toBe(false)
  })

  it('refuses busy-loop intervals and empty tasks', () => {
    expect(isDue({ ...base, intervalSec: 5 }, NOW)).toBe(false)
    expect(isDue({ ...base, defaultTask: '   ' }, NOW)).toBe(false)
  })
})
