// Microcompact — time-based 清空旧 tool_result 内容
// 对标 CC src/services/compact/microCompact.ts (time-based 路径)
//
// 触发条件：距上次 assistant 消息超过 MICROCOMPACT_GAP_MINUTES 分钟
// 策略：清空旧 tool_result 内容，保留最近 MICROCOMPACT_KEEP_RECENT 个
// 不依赖 cache editing API，直接替换内容为占位符

import type { Message, AssistantMessage } from '../types/message.js'

// ── Constants ─────────────────────────────────────────────────────────────────

const MICROCOMPACT_GAP_MINUTES = 60
const MICROCOMPACT_KEEP_RECENT = 5
export const MICROCOMPACT_CLEARED_MESSAGE = '[Old tool result content cleared]'

// 对标 CC COMPACTABLE_TOOLS — 这些工具的结果可以安全清空
const COMPACTABLE_TOOLS = new Set([
  'bash',
  'read_file',
  'grep',
  'glob',
  'web_fetch',
  'file_edit',
  'file_write',
])

// ── Types ─────────────────────────────────────────────────────────────────────

export type MicrocompactResult = {
  messages: Message[]
  toolsCleared: number
  tokensSaved: number
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * 如果距上次 assistant 消息超过阈值，清空旧 tool_result 内容。
 * AssistantMessage 需要有 timestamp 字段（由 query.ts 注入）。
 */
export function microcompactIfNeeded(messages: Message[]): MicrocompactResult {
  const noOp: MicrocompactResult = { messages, toolsCleared: 0, tokensSaved: 0 }

  // 找最后一条 assistant 消息，读取 timestamp
  let lastAssistant: AssistantMessage | undefined
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.type === 'assistant') { lastAssistant = messages[i] as AssistantMessage; break }
  }
  if (!lastAssistant?.timestamp) return noOp

  const gapMinutes =
    (Date.now() - new Date(lastAssistant.timestamp).getTime()) / 60_000
  if (!Number.isFinite(gapMinutes) || gapMinutes < MICROCOMPACT_GAP_MINUTES) {
    return noOp
  }

  // 收集所有可压缩工具的 tool_use_id（按出现顺序）
  const compactableIds = collectCompactableToolIds(messages)
  if (compactableIds.length === 0) return noOp

  // 保留最近 N 个，清空其余
  const keepRecent = Math.max(1, MICROCOMPACT_KEEP_RECENT)
  const keepSet = new Set(compactableIds.slice(-keepRecent))
  const clearSet = new Set(compactableIds.filter(id => !keepSet.has(id)))
  if (clearSet.size === 0) return noOp

  // 遍历 user messages，替换 clearSet 中的 tool_result 内容
  let tokensSaved = 0
  let toolsCleared = 0
  const result: Message[] = messages.map(message => {
    if (message.type !== 'user' || !Array.isArray(message.content)) {
      return message
    }
    let touched = false
    const newContent = message.content.map(block => {
      if (
        block.type === 'tool_result' &&
        clearSet.has(block.tool_use_id) &&
        block.content !== MICROCOMPACT_CLEARED_MESSAGE
      ) {
        const oldLen = typeof block.content === 'string' ? block.content.length : 0
        tokensSaved += Math.ceil(oldLen / 4)
        toolsCleared++
        touched = true
        return { ...block, content: MICROCOMPACT_CLEARED_MESSAGE }
      }
      return block
    })
    if (!touched) return message
    return { ...message, content: newContent }
  })

  if (toolsCleared === 0) return noOp

  return { messages: result, toolsCleared, tokensSaved }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function collectCompactableToolIds(messages: Message[]): string[] {
  const ids: string[] = []
  for (const message of messages) {
    if (message.type !== 'assistant' || !Array.isArray(message.content)) continue
    for (const block of message.content) {
      if (block.type === 'tool_use' && COMPACTABLE_TOOLS.has(block.name)) {
        ids.push(block.id)
      }
    }
  }
  return ids
}
