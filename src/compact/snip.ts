// Snip compaction — 不调 API，直接截断最早的消息
// 对标 CC src/services/compact/snipCompact.ts
//
// 触发条件：roughTokenCount(messages) >= threshold（由调用方传入）
// 策略：保留最后一个 compact_boundary 之后的消息，或最近 SNIP_KEEP_RECENT 条
// 用途：autocompact 失败时的兜底，也可在 autocompact 之前提前释放空间

import type { Message, UserMessage } from '../types/message.js'
import { roughTokenCount } from '../sessionMemory/utils.js'

// ── Constants ─────────────────────────────────────────────────────────────────

const SNIP_KEEP_RECENT = 40
export const SNIP_CLEARED_MARKER =
  '[Earlier conversation history removed to free context]'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SnipResult = {
  messages: Message[]
  tokensFreed: number
  didSnip: boolean
  messagesRemoved: number
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * 如果 roughTokenCount(messages) >= threshold，截断最早的消息。
 * threshold = Infinity 时永不触发（opt-out）。
 */
export function snipIfNeeded(messages: Message[], threshold: number): SnipResult {
  const noOp: SnipResult = { messages, tokensFreed: 0, didSnip: false, messagesRemoved: 0 }

  if (!Number.isFinite(threshold)) return noOp
  if (roughTokenCount(messages) < threshold) return noOp

  // 找最后一个 compact_boundary，从它之后开始保留
  const boundaryIdx = findLastIndex(messages, m => m.type === 'compact_boundary')

  let keepFrom: number
  if (boundaryIdx !== -1) {
    // compact_boundary 之后的消息数
    const afterBoundary = messages.length - (boundaryIdx + 1)
    if (afterBoundary <= SNIP_KEEP_RECENT) {
      // boundary 之后的消息已经很少，无法再 snip
      return noOp
    }
    // 保留 boundary + 最近 SNIP_KEEP_RECENT 条
    // 确保 compact_boundary 本身不被截断
    keepFrom = Math.max(messages.length - SNIP_KEEP_RECENT, boundaryIdx)
  } else {
    if (messages.length <= SNIP_KEEP_RECENT) return noOp
    keepFrom = messages.length - SNIP_KEEP_RECENT
  }

  const removed = messages.slice(0, keepFrom)
  const kept = messages.slice(keepFrom)

  const tokensFreed = roughTokenCount(removed)

  // 在保留部分最前面插入 snip marker（user message）
  const markerMessage: UserMessage = {
    type: 'user',
    content: [{ type: 'text', text: SNIP_CLEARED_MARKER }],
  }

  const newMessages: Message[] = [markerMessage, ...kept]

  return {
    messages: newMessages,
    tokensFreed,
    didSnip: true,
    messagesRemoved: removed.length,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i]!)) return i
  }
  return -1
}
