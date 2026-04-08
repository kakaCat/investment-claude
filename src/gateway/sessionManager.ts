import type { Message } from '../types/message.js'

export type QuerySession = {
  chatId: string
  channelId: string
  accountId: string
  messages: Message[]
  lastActiveAt: number
  abortController: AbortController
  pendingReply: {
    resolve: (value: string) => void
    reject: (err: Error) => void
  } | null
  messageQueue: Array<() => Promise<void>>
  processing: boolean
}

export class SessionManager {
  private sessions = new Map<string, QuerySession>()
  private reaperTimer: ReturnType<typeof setInterval> | null = null

  private key(channelId: string, chatId: string): string {
    return `${channelId}:${chatId}`
  }

  getOrCreate(channelId: string, chatId: string, accountId: string): QuerySession {
    const k = this.key(channelId, chatId)
    if (!this.sessions.has(k)) {
      this.sessions.set(k, {
        chatId,
        channelId,
        accountId,
        messages: [],
        lastActiveAt: Date.now(),
        abortController: new AbortController(),
        pendingReply: null,
        messageQueue: [],
        processing: false,
      })
    }
    const session = this.sessions.get(k)!
    session.lastActiveAt = Date.now()
    return session
  }

  get(channelId: string, chatId: string): QuerySession | undefined {
    return this.sessions.get(this.key(channelId, chatId))
  }

  resolveCardAction(channelId: string, chatId: string, answer: Record<string, string>): void {
    const session = this.get(channelId, chatId)
    if (session?.pendingReply) {
      const value = answer.answer ?? Object.values(answer)[0] ?? ''
      session.pendingReply.resolve(value)
      session.pendingReply = null
    }
  }

  startReaper(intervalMs = 5 * 60 * 1000, ttlMs = 30 * 60 * 1000): () => void {
    this.reaperTimer = setInterval(() => {
      const now = Date.now()
      for (const [key, session] of this.sessions) {
        if (now - session.lastActiveAt > ttlMs && !session.processing) {
          session.abortController.abort()
          this.sessions.delete(key)
        }
      }
    }, intervalMs)
    return () => {
      if (this.reaperTimer) clearInterval(this.reaperTimer)
    }
  }
}
