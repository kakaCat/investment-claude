// trySessionMemoryCompaction: fast-path compaction using SM file
// Called by autoCompactIfNeeded() before falling back to full API compact

import {
  getSessionMemoryContent,
  waitForSessionMemoryExtraction,
} from '../sessionMemory/index.js'
import {
  isSessionMemoryEmpty,
  truncateSessionMemoryForCompact,
} from '../sessionMemory/prompts.js'
import { roughTokenCount as roughTokenCountMsgs } from '../sessionMemory/utils.js'
import { getCompactUserSummaryMessage } from './prompt.js'
import type { CompactBoundaryMessage, Message, UserMessage } from '../types/message.js'
import type { CompactResult } from './index.js'

export type { CompactResult }

const MIN_MESSAGES_TO_KEEP = 5
const SM_TOKEN_BUDGET_FRACTION = 0.5 // use 50% of threshold for kept messages

/**
 * Returns true if a message has meaningful text content.
 */
function hasTextContent(msg: Message): boolean {
  if (msg.type === 'compact_boundary') return false
  return msg.content.some((c) => c.type === 'text')
}

/**
 * Keep the most recent messages that fit within the token budget.
 * Ensures at least MIN_MESSAGES_TO_KEEP messages with text are kept.
 */
function selectMessagesToKeep(messages: Message[], tokenBudget: number): Message[] {
  const reversed = [...messages].reverse()
  const kept: Message[] = []
  let tokens = 0
  let textMsgCount = 0

  for (const msg of reversed) {
    const msgTokens = Math.floor(JSON.stringify(msg).length / 4)
    if (tokens + msgTokens > tokenBudget && textMsgCount >= MIN_MESSAGES_TO_KEEP) break
    kept.unshift(msg)
    tokens += msgTokens
    if (hasTextContent(msg)) textMsgCount++
  }

  return kept
}

/**
 * Attempt session-memory-based compaction.
 * Returns null if SM file is empty or conditions aren't met.
 */
export async function trySessionMemoryCompaction(
  messages: Message[],
  threshold: number,
): Promise<CompactResult | null> {
  // Wait for any in-progress extraction to finish
  await waitForSessionMemoryExtraction()

  const content = await getSessionMemoryContent()
  if (!content || isSessionMemoryEmpty(content)) return null

  const truncated = truncateSessionMemoryForCompact(content)
  const preTokens = roughTokenCountMsgs(messages)

  const tokenBudget = Math.floor(threshold * SM_TOKEN_BUDGET_FRACTION)
  const keptMessages = selectMessagesToKeep(messages, tokenBudget)

  if (keptMessages.length < MIN_MESSAGES_TO_KEEP) return null

  const boundary: CompactBoundaryMessage = {
    type: 'compact_boundary',
    trigger: 'auto',
    preCompactTokenCount: preTokens,
  }

  const summaryMsg: UserMessage = {
    type: 'user',
    content: [
      {
        type: 'text',
        text: getCompactUserSummaryMessage(truncated, true),
      },
    ],
  }

  const newMessages: Message[] = [boundary, summaryMsg, ...keptMessages]
  const postTokens = Math.floor(JSON.stringify(newMessages).length / 4)

  return {
    newMessages,
    savedTokens: Math.max(0, preTokens - postTokens),
    summaryLength: truncated.length,
  }
}
