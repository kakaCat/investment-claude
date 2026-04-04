// Core compaction logic
// Port of Claude Code src/services/compact/compact.ts (simplified)

import Anthropic from '@anthropic-ai/sdk'
import {
  getCompactPrompt,
  getCompactUserSummaryMessage,
  getPartialCompactPrompt,
} from './prompt.js'
import type { CompactBoundaryMessage, Message, UserMessage } from '../types/message.js'
import { roughTokenCount } from '../sessionMemory/utils.js'

export type CompactResult = {
  newMessages: Message[]
  savedTokens: number
  summaryLength: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function createBoundaryMessage(
  trigger: 'auto' | 'manual' | 'partial',
  preCompactTokenCount: number,
): CompactBoundaryMessage {
  return { type: 'compact_boundary', trigger, preCompactTokenCount }
}

function createSummaryUserMessage(
  summary: string,
  suppressFollowUpQuestions: boolean,
): UserMessage {
  return {
    type: 'user',
    content: [
      {
        type: 'text',
        text: getCompactUserSummaryMessage(summary, suppressFollowUpQuestions),
      },
    ],
  }
}

// ── API call ──────────────────────────────────────────────────────────────────

async function callCompactApi(
  messages: Message[],
  promptText: string,
  abortSignal?: AbortSignal,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  const baseURL = process.env.PI_BASE_URL
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const client = new Anthropic({ apiKey, baseURL })

  const apiMessages: Anthropic.MessageParam[] = [
    ...messages.map((m) => ({
      role: m.type === 'compact_boundary' ? ('user' as const) : (m.type as 'user' | 'assistant'),
      content:
        m.type === 'compact_boundary'
          ? `[Compact boundary: ${m.trigger}]`
          : (m.content as Anthropic.MessageParam['content']),
    })),
    { role: 'user', content: promptText },
  ]

  const response = await client.messages.create(
    {
      model: process.env.PI_MODEL ?? 'claude-3-5-sonnet-20241022',
      max_tokens: 8192,
      system: 'You are a helpful assistant tasked with summarizing conversations.',
      messages: apiMessages,
      tools: [],
    },
    { signal: abortSignal },
  )

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text' || !textBlock.text) {
    throw new Error('Failed to generate summary — response contained no text')
  }
  return textBlock.text
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Full compaction: summarize all messages, replace with boundary + summary.
 */
export async function compactConversation(
  messages: Message[],
  options: {
    suppressFollowUpQuestions?: boolean
    customInstructions?: string
    isAutoCompact?: boolean
    abortSignal?: AbortSignal
  } = {},
): Promise<CompactResult> {
  const {
    suppressFollowUpQuestions = false,
    customInstructions,
    isAutoCompact = false,
    abortSignal,
  } = options

  if (messages.length === 0) throw new Error('Not enough messages to compact.')

  const preTokens = roughTokenCount(messages)
  const promptText = getCompactPrompt(customInstructions)
  const rawSummary = await callCompactApi(messages, promptText, abortSignal)

  const trigger = isAutoCompact ? 'auto' : 'manual'
  const newMessages: Message[] = [
    createBoundaryMessage(trigger, preTokens),
    createSummaryUserMessage(rawSummary, suppressFollowUpQuestions),
  ]

  const postTokens = roughTokenCount(newMessages)

  return {
    newMessages,
    savedTokens: Math.max(0, preTokens - postTokens),
    summaryLength: rawSummary.length,
  }
}

/**
 * Partial compaction: summarize only one half, keep the other verbatim.
 */
export async function partialCompactConversation(
  allMessages: Message[],
  pivotIndex: number,
  direction: 'from' | 'up_to',
): Promise<CompactResult> {
  const messagesToSummarize =
    direction === 'up_to'
      ? allMessages.slice(0, pivotIndex)
      : allMessages.slice(pivotIndex)

  const keptMessages =
    direction === 'up_to'
      ? allMessages.slice(pivotIndex)
      : allMessages.slice(0, pivotIndex)

  if (messagesToSummarize.length === 0) {
    throw new Error(
      direction === 'up_to'
        ? 'Nothing to summarize before the selected message.'
        : 'Nothing to summarize after the selected message.',
    )
  }

  const preTokens = roughTokenCount(allMessages)
  const promptText = getPartialCompactPrompt(undefined, direction)
  const rawSummary = await callCompactApi(messagesToSummarize, promptText)

  const boundary = createBoundaryMessage('partial', preTokens)
  const summaryMsg = createSummaryUserMessage(rawSummary, false)

  const newMessages: Message[] =
    direction === 'up_to'
      ? [boundary, summaryMsg, ...keptMessages]
      : [...keptMessages, boundary, summaryMsg]

  const postTokens = roughTokenCount(newMessages)

  return {
    newMessages,
    savedTokens: Math.max(0, preTokens - postTokens),
    summaryLength: rawSummary.length,
  }
}
