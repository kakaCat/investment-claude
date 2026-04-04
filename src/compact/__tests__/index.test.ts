import { describe, it, expect, vi, beforeEach } from 'vitest'
import { compactConversation, partialCompactConversation } from '../index.js'
import type { Message } from '../../types/message.js'

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '<summary>Test summary content</summary>' }],
      }),
    }
  },
}))

const makeMessages = (n: number): Message[] =>
  Array.from({ length: n }, (_, i) => ({
    type: 'user' as const,
    content: [{ type: 'text' as const, text: `message ${i}` }],
  }))

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key'
})

describe('compactConversation', () => {
  it('throws when messages is empty', async () => {
    await expect(compactConversation([])).rejects.toThrow('Not enough messages')
  })

  it('returns newMessages with boundary + summary', async () => {
    const messages = makeMessages(3)
    const result = await compactConversation(messages)
    expect(result.newMessages).toHaveLength(2)
    expect(result.newMessages[0].type).toBe('compact_boundary')
    expect(result.newMessages[1].type).toBe('user')
  })

  it('boundary trigger is "auto" when isAutoCompact=true', async () => {
    const messages = makeMessages(3)
    const result = await compactConversation(messages, { isAutoCompact: true })
    const boundary = result.newMessages[0] as any
    expect(boundary.trigger).toBe('auto')
  })

  it('boundary trigger is "manual" by default', async () => {
    const messages = makeMessages(3)
    const result = await compactConversation(messages)
    const boundary = result.newMessages[0] as any
    expect(boundary.trigger).toBe('manual')
  })

  it('savedTokens is non-negative', async () => {
    const messages = makeMessages(5)
    const result = await compactConversation(messages)
    expect(result.savedTokens).toBeGreaterThanOrEqual(0)
  })
})

describe('partialCompactConversation', () => {
  it('throws when direction=from and no messages after pivot', async () => {
    const messages = makeMessages(3)
    await expect(partialCompactConversation(messages, 3, 'from')).rejects.toThrow(
      'Nothing to summarize after',
    )
  })

  it('direction=up_to: boundary + summary + kept messages', async () => {
    const messages = makeMessages(4)
    const result = await partialCompactConversation(messages, 2, 'up_to')
    expect(result.newMessages[0].type).toBe('compact_boundary')
    // kept messages are after the summary
    expect(result.newMessages.length).toBeGreaterThan(2)
  })

  it('direction=from: kept + boundary + summary', async () => {
    const messages = makeMessages(4)
    const result = await partialCompactConversation(messages, 2, 'from')
    const boundary = result.newMessages.find((m) => m.type === 'compact_boundary')
    expect(boundary).toBeDefined()
  })
})
