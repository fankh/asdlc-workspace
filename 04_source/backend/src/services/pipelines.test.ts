import { describe, it, expect } from 'vitest'
import { composeStepTask, evalLogic, skillInstruction, nodeLabel } from './pipelines.js'

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
