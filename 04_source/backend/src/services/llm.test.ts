import { describe, it, expect } from 'vitest'
import { buildPrompt, modelFor, type AgentLike } from './llm.js'

const base: AgentLike = {
  name: 'Triage Bot', role: 'SOC analyst', persona: 'concise and precise',
  skills: ['sigma', 'triage'], goal: 'reduce false positives', model: '',
}

describe('buildPrompt', () => {
  it('composes identity, persona, skills, goal, and the task', () => {
    const p = buildPrompt(base, 'Summarize these alerts.')
    expect(p).toContain('You are Triage Bot, a SOC analyst.')
    expect(p).toContain('Persona: concise and precise')
    expect(p).toContain('Your skills: sigma, triage.')
    expect(p).toContain('Your standing goal: reduce false positives')
    expect(p).toContain('Task:\nSummarize these alerts.')
  })

  it('omits empty attribute lines but always includes the task', () => {
    const bare: AgentLike = { name: 'A', role: '', persona: '', skills: [], goal: '', model: '' }
    const p = buildPrompt(bare, 'do it')
    expect(p).toContain('You are A.')
    expect(p).not.toContain('Persona:')
    expect(p).not.toContain('Your skills:')
    expect(p).toContain('Task:\ndo it')
  })
})

describe('modelFor', () => {
  it('uses the agent model when set', () => {
    expect(modelFor({ ...base, model: 'llama3.1:8b' })).toBe('llama3.1:8b')
  })
  it('falls back to the default when blank', () => {
    expect(modelFor({ ...base, model: '   ' })).toBe('qwen3.6:latest')
  })
})
