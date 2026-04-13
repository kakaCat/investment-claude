import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  roughTokenCount,
  shouldAutoCompact,
  getAutoCompactThreshold,
  autoCompactIfNeeded,
  createAutoCompactTracking,
} from '../autoCompact.js'
import type { Message } from '../../types/message.js'

vi.mock('../index.js', () => ({
  compactConversation: vi.fn().mockResolvedValue({
    newMessages: [{ type: 'user', content: [{ type: 'text', text: 'summary' }] }],
    savedTokens: 1000,
    summaryLength: 100,
  }),
}))

vi.mock('../sessionMemory.js', () => ({
  trySessionMemoryCompaction: vi.fn().mockResolvedValue(null),
}))

const makeLargeMessages = (targetTokens: number): Message[] => {
  const charsNeeded = targetTokens * 4
  return [{ type: 'user', content: [{ type: 'text', text: 'x'.repeat(charsNeeded) }] }]
}

beforeEach(() => {
  delete process.env.CLAUDE_AUTOCOMPACT_THRESHOLD
  delete process.env.DISABLE_AUTO_COMPACT
})

describe('roughTokenCount', () => {
  it('is non-zero for non-empty messages', () => {
    const msgs: Message[] = [{ type: 'user', content: [{ type: 'text', text: 'hello' }] }]
    expect(roughTokenCount(msgs)).toBeGreaterThan(0)
  })
})

describe('shouldAutoCompact', () => {
  it('returns false when DISABLE_AUTO_COMPACT=1', () => {
    process.env.DISABLE_AUTO_COMPACT = '1'
    const msgs = makeLargeMessages(200_000)
    expect(shouldAutoCompact(msgs)).toBe(false)
  })

  it('returns false when below threshold', () => {
    const msgs = makeLargeMessages(100)
    expect(shouldAutoCompact(msgs)).toBe(false)
  })

  it('returns true when above threshold', () => {
    process.env.CLAUDE_AUTOCOMPACT_THRESHOLD = '100'
    const msgs = makeLargeMessages(200)
    expect(shouldAutoCompact(msgs)).toBe(true)
  })
})

describe('autoCompactIfNeeded', () => {
  it('returns wasCompacted=false when below threshold', async () => {
    const msgs: Message[] = [{ type: 'user', content: [{ type: 'text', text: 'hi' }] }]
    const tracking = createAutoCompactTracking()
    const result = await autoCompactIfNeeded(msgs, tracking)
    expect(result.wasCompacted).toBe(false)
  })

  it('returns wasCompacted=true when threshold exceeded', async () => {
    process.env.CLAUDE_AUTOCOMPACT_THRESHOLD = '10'
    const msgs = makeLargeMessages(50)
    const tracking = createAutoCompactTracking()
    const result = await autoCompactIfNeeded(msgs, tracking)
    expect(result.wasCompacted).toBe(true)
    expect(result.result).toBeDefined()
  })

  it('circuit breaker stops after 3 consecutive failures', async () => {
    process.env.CLAUDE_AUTOCOMPACT_THRESHOLD = '10'
    const msgs = makeLargeMessages(50)
    let tracking = { consecutiveFailures: 3 }
    const result = await autoCompactIfNeeded(msgs, tracking)
    expect(result.wasCompacted).toBe(false)
  })
})
