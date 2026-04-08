import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SessionManager } from './sessionManager.js'

describe('SessionManager', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('creates a session once per channel/chat pair and refreshes lastActiveAt', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-06T00:00:00.000Z'))

    const manager = new SessionManager()
    const first = manager.getOrCreate('feishu', 'chat-1', 'account-1')

    expect(first.chatId).toBe('chat-1')
    expect(first.channelId).toBe('feishu')
    expect(first.accountId).toBe('account-1')
    expect(first.messages).toEqual([])
    expect(first.pendingReply).toBeNull()
    expect(first.messageQueue).toEqual([])
    expect(first.processing).toBe(false)
    expect(first.lastActiveAt).toBe(Date.now())

    vi.setSystemTime(new Date('2026-04-06T00:05:00.000Z'))

    const second = manager.getOrCreate('feishu', 'chat-1', 'account-1')

    expect(second).toBe(first)
    expect(second.lastActiveAt).toBe(Date.now())
    expect(manager.get('feishu', 'chat-1')).toBe(first)
  })

  it('resolves the pending card reply using answer.answer first', async () => {
    const manager = new SessionManager()
    const session = manager.getOrCreate('feishu', 'chat-1', 'account-1')

    const reply = new Promise<string>((resolve, reject) => {
      session.pendingReply = { resolve, reject }
    })

    manager.resolveCardAction('feishu', 'chat-1', { answer: 'approve', ignored: 'fallback' })

    await expect(reply).resolves.toBe('approve')
    expect(session.pendingReply).toBeNull()
  })

  it('reaps expired idle sessions without touching active ones', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-06T00:00:00.000Z'))

    const manager = new SessionManager()
    const expired = manager.getOrCreate('feishu', 'expired-chat', 'account-1')
    const active = manager.getOrCreate('feishu', 'active-chat', 'account-1')
    active.processing = true

    const stopReaper = manager.startReaper(1_000, 5_000)

    vi.advanceTimersByTime(6_000)

    expect(expired.abortController.signal.aborted).toBe(true)
    expect(manager.get('feishu', 'expired-chat')).toBeUndefined()
    expect(active.abortController.signal.aborted).toBe(false)
    expect(manager.get('feishu', 'active-chat')).toBe(active)

    stopReaper()
  })
})
