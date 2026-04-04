import { describe, it, expect } from 'vitest'
import { computeTurnTokens, computeTotalTokens } from '../tokenCount.js'
import type { Message } from '../../types/message.js'

function makeUser(text: string): Message {
  return { type: 'user', content: [{ type: 'text', text }] }
}
function makeAssistant(text: string): Message {
  return { type: 'assistant', content: [{ type: 'text', text }] }
}

describe('computeTurnTokens', () => {
  it('returns empty array for empty messages', () => {
    expect(computeTurnTokens([])).toEqual([])
  })

  it('returns one entry per user message', () => {
    const msgs: Message[] = [
      makeUser('hello'),
      makeAssistant('world'),
      makeUser('again'),
      makeAssistant('ok'),
    ]
    const result = computeTurnTokens(msgs)
    expect(result).toHaveLength(2)
  })

  it('inputTokens grows with context across turns', () => {
    const msgs: Message[] = [
      makeUser('first'),
      makeAssistant('reply1'),
      makeUser('second'),
      makeAssistant('reply2'),
    ]
    const result = computeTurnTokens(msgs)
    expect(result[1].inputTokens).toBeGreaterThan(result[0].inputTokens)
  })

  it('skips compact_boundary messages', () => {
    const msgs: Message[] = [
      makeUser('hello'),
      { type: 'compact_boundary', trigger: 'auto', preCompactTokenCount: 1000 },
      makeAssistant('world'),
    ]
    const result = computeTurnTokens(msgs)
    expect(result).toHaveLength(1)
    expect(result[0].outputTokens).toBeGreaterThan(0)
  })
})

describe('computeTotalTokens', () => {
  it('returns 0 for empty array', () => {
    expect(computeTotalTokens([])).toBe(0)
  })

  it('returns last inputTokens + all outputTokens', () => {
    const turns = [
      { inputTokens: 100, outputTokens: 20 },
      { inputTokens: 200, outputTokens: 30 },
    ]
    // 200 + 20 + 30 = 250
    expect(computeTotalTokens(turns)).toBe(250)
  })
})
