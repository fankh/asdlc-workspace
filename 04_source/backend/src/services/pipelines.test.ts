import { describe, it, expect } from 'vitest'
import { composeStepTask, composeStepTaskWithTrail, evalLogic, skillInstruction, nodeLabel } from './pipelines.js'

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

describe('composeStepTaskWithTrail', () => {
  it('first step with no instruction passes the input straight through', () => {
    expect(composeStepTaskWithTrail('', 'the task', 'the task', [])).toBe('the task')
  })

  it('keeps the original task visible once the input has diverged', () => {
    const out = composeStepTaskWithTrail('Summarize.', 'original ask', 'step1 output',
      [{ label: 'HTTP GET', output: 'step1 output' }])
    expect(out).toContain('Summarize.')
    expect(out).toContain('Original task:\noriginal ask')
    expect(out).toContain('Input:\nstep1 output')
    // the only trail entry produced the current input — no "Earlier steps"
    expect(out).not.toContain('Earlier steps:')
  })

  it('digests earlier steps but excludes the one that produced the input', () => {
    const trail = [
      { label: 'A', output: 'alpha result' },
      { label: 'B', output: 'beta  result\nwith newline' },
      { label: 'C', output: 'current input' },
    ]
    const out = composeStepTaskWithTrail('', 'orig', 'current input', trail)
    expect(out).toContain('- A: alpha result')
    expect(out).toContain('- B: beta result with newline') // whitespace collapsed
    expect(out).not.toContain('- C:')
  })

  it('caps the trail at the 4 most recent earlier steps', () => {
    const trail = Array.from({ length: 7 }, (_, i) => ({ label: `S${i}`, output: `o${i}` }))
    const out = composeStepTaskWithTrail('', 'orig', 'x', trail)
    expect(out).not.toContain('- S0:')
    expect(out).not.toContain('- S1:')
    expect(out).toContain('- S2:')
    expect(out).toContain('- S5:')
    expect(out).not.toContain('- S6:') // produced the current input
  })
})

describe('evalLogic', () => {
  it('contains / not_contains are case-insensitive', () => {
    expect(evalLogic({ op: 'contains', value: 'CRITICAL' }, '2 critical alerts')).toBe(true)
    expect(evalLogic({ op: 'contains', value: 'critical' }, 'all clear')).toBe(false)
    expect(evalLogic({ op: 'not_contains', value: 'critical' }, 'all clear')).toBe(true)
  })

  it('matches_regex tests case-insensitively and rejects bad patterns', () => {
    expect(evalLogic({ op: 'matches_regex', value: 'sev[0-2]' }, 'SEV1 incident')).toBe(true)
    expect(() => evalLogic({ op: 'matches_regex', value: '([' }, 'x')).toThrow(/Invalid regular/)
  })

  it('longer_than compares character length', () => {
    expect(evalLogic({ op: 'longer_than', value: '5' }, 'abcdef')).toBe(true)
    expect(evalLogic({ op: 'longer_than', value: '10' }, 'short')).toBe(false)
  })
})

describe('skillInstruction', () => {
  it('maps presets to instructions', () => {
    expect(skillInstruction({ skill: 'summarize' })).toMatch(/^Summarize/)
    expect(skillInstruction({ skill: 'translate', param: 'Korean' })).toContain('into Korean')
    expect(skillInstruction({ skill: 'translate' })).toContain('into English')
    expect(skillInstruction({ skill: 'classify_severity' })).toMatch(/critical, high, medium, low/)
    expect(skillInstruction({ skill: 'custom', param: 'Do the thing.' })).toBe('Do the thing.')
  })
})

describe('nodeLabel', () => {
  it('labels each node type', () => {
    expect(nodeLabel('agent', {}, 'Triage Bot')).toBe('Triage Bot')
    expect(nodeLabel('logic', { op: 'contains', value: 'crit' })).toBe('IF contains "crit"')
    expect(nodeLabel('skill', { skill: 'translate' })).toBe('Skill: translate')
    expect(nodeLabel('http', { method: 'post' })).toBe('HTTP POST')
  })
})
