import { describe, it, expect } from 'vitest'
import { composeStepTask } from './pipelines.js'

describe('composeStepTask', () => {
  it('passes the input straight through when there is no instruction', () => {
    expect(composeStepTask('', 'previous output')).toBe('previous output')
    expect(composeStepTask('   ', 'previous output')).toBe('previous output')
  })

  it('frames the input with the step instruction when set', () => {
    expect(composeStepTask('Review this text for errors.', 'draft text'))
      .toBe('Review this text for errors.\n\nInput:\ndraft text')
  })

  it('trims the instruction but preserves the input verbatim', () => {
    expect(composeStepTask('  Summarize.  ', 'line1\nline2'))
      .toBe('Summarize.\n\nInput:\nline1\nline2')
  })
})
