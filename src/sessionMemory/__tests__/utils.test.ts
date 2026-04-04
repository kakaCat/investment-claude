import { describe, it, expect, beforeEach } from 'vitest'
import {
  resetSessionMemoryState,
  shouldExtractMemory,
  hasMetInitializationThreshold,
  hasMetUpdateThreshold,
  roughTokenCount,
  recordExtractionTokenCount,
  markSessionMemoryInitialized,
} from '../utils.js'
import type { Message } from '../../types/message.js'

function makeMessages(count: number): Message[] {
  return Array.from({ length: count }, (_, i) => ({
    type: 'user' as const,
    content: [{ type: 'text' as const, text: `message ${i} `.repeat(100) }],
  }))
}

beforeEach(() => {
  resetSessionMemoryState()
})

describe('roughTokenCount', () => {
  it('returns ~1 token per 4 chars', () => {
    const msgs: Message[] = [{ type: 'user', content: [{ type: 'text', text: 'a'.repeat(400) }] }]
    // JSON.stringify adds overhead, but should be > 100 tokens for 400-char text
    expect(roughTokenCount(msgs)).toBeGreaterThan(100)
  })
})

describe('hasMetInitializationThreshold', () => {
  it('returns false below 10k tokens', () => {
    expect(hasMetInitializationThreshold(9_999)).toBe(false)
  })

  it('returns true at 10k tokens', () => {
    expect(hasMetInitializationThreshold(10_000)).toBe(true)
  })
})

describe('hasMetUpdateThreshold', () => {
  it('returns true when token growth >= 5k since last extraction', () => {
    recordExtractionTokenCount(10_000)
    expect(hasMetUpdateThreshold(15_000)).toBe(true)
  })

  it('returns false when growth < 5k', () => {
    recordExtractionTokenCount(10_000)
    expect(hasMetUpdateThreshold(14_999)).toBe(false)
  })
})

describe('shouldExtractMemory', () => {
  it('returns false before initialization threshold', () => {
    const msgs = makeMessages(1)
    expect(shouldExtractMemory(msgs)).toBe(false)
  })

  it('returns true when token threshold met and no tool calls in last turn', () => {
    markSessionMemoryInitialized()
    recordExtractionTokenCount(0)
    // Build large enough messages to exceed minimumTokensBetweenUpdate=5000
    const bigText = 'x'.repeat(20_100) // ~5025 tokens in JSON
    const msgs: Message[] = [
      { type: 'user', content: [{ type: 'text', text: bigText }] },
      { type: 'assistant', content: [{ type: 'text', text: 'ok' }] },
    ]
    expect(shouldExtractMemory(msgs)).toBe(true)
  })
})
