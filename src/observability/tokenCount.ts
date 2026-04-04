import { roughTokenCount } from '../sessionMemory/utils.js'
import type { Message } from '../types/message.js'

export type TurnTokens = {
  inputTokens: number
  outputTokens: number
}

/**
 * Compute estimated input/output token counts for each turn.
 * A "turn" starts at each user message in the messages array.
 * compact_boundary messages are excluded from counting.
 */
export function computeTurnTokens(messages: Message[]): TurnTokens[] {
  const filtered = messages.filter((m): m is Exclude<Message, { type: 'compact_boundary' }> =>
    m.type !== 'compact_boundary',
  )

  const userIndices: number[] = []
  for (let i = 0; i < filtered.length; i++) {
    if (filtered[i].type === 'user') userIndices.push(i)
  }

  return userIndices.map((userIdx, turnIdx) => {
    // Input = everything up to and including this turn's user message
    const inputMsgs = filtered.slice(0, userIdx + 1)
    const inputTokens = roughTokenCount(inputMsgs as Message[])

    // Output = assistant message(s) before the next user message
    const nextUserIdx = userIndices[turnIdx + 1] ?? filtered.length
    const outputMsgs = filtered.slice(userIdx + 1, nextUserIdx).filter((m) => m.type === 'assistant')
    const outputTokens = roughTokenCount(outputMsgs as Message[])

    return { inputTokens, outputTokens }
  })
}

/**
 * Compute total session tokens.
 * = last turn's inputTokens (peak context sent to API) + all output tokens
 */
export function computeTotalTokens(turns: TurnTokens[]): number {
  if (turns.length === 0) return 0
  const lastInputTokens = turns[turns.length - 1].inputTokens
  const totalOutputTokens = turns.reduce((sum, t) => sum + t.outputTokens, 0)
  return lastInputTokens + totalOutputTokens
}
