// Auto-compact: checks token usage every query loop iteration
// Port of Claude Code src/services/compact/autoCompact.ts (simplified)

import { compactConversation, type CompactResult } from './index.js'
import { trySessionMemoryCompaction } from './sessionMemory.js'
import type { Message } from '../types/message.js'
import { roughTokenCount } from '../sessionMemory/utils.js'
export { roughTokenCount } from '../sessionMemory/utils.js'

// ── Constants ─────────────────────────────────────────────────────────────────

const CONTEXT_WINDOW = 200_000
const MAX_OUTPUT_TOKENS_RESERVE = 20_000
const AUTOCOMPACT_BUFFER = 13_000
// Effective threshold: 200k - 20k - 13k = 167k tokens
const DEFAULT_THRESHOLD = CONTEXT_WINDOW - MAX_OUTPUT_TOKENS_RESERVE - AUTOCOMPACT_BUFFER

const MAX_CONSECUTIVE_FAILURES = 3

// ── Types ─────────────────────────────────────────────────────────────────────

/** Per-query tracking state — passed in and returned, never module-level global */
export type AutoCompactTracking = {
  consecutiveFailures: number
}

export function createAutoCompactTracking(): AutoCompactTracking {
  return { consecutiveFailures: 0 }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getAutoCompactThreshold(): number {
  const override = process.env.CLAUDE_AUTOCOMPACT_THRESHOLD
  if (override) {
    const parsed = parseInt(override, 10)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  return DEFAULT_THRESHOLD
}

export function shouldAutoCompact(messages: Message[], snipTokensFreed = 0): boolean {
  if (process.env.DISABLE_AUTO_COMPACT === '1') return false
  const tokens = roughTokenCount(messages) - snipTokensFreed
  return tokens >= getAutoCompactThreshold()
}

// ── Main function ─────────────────────────────────────────────────────────────

export async function autoCompactIfNeeded(
  messages: Message[],
  tracking: AutoCompactTracking,
  options: { snipTokensFreed?: number } = {},
): Promise<{ wasCompacted: boolean; result?: CompactResult; tracking: AutoCompactTracking }> {
  if (!shouldAutoCompact(messages, options.snipTokensFreed ?? 0)) {
    return { wasCompacted: false, tracking }
  }

  // Circuit breaker: stop retrying after N consecutive failures
  if (tracking.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    return { wasCompacted: false, tracking }
  }

  const threshold = getAutoCompactThreshold()

  // Try session memory compaction first (no API call needed)
  try {
    const smResult = await trySessionMemoryCompaction(messages, threshold)
    if (smResult) {
      return { wasCompacted: true, result: smResult, tracking: { consecutiveFailures: 0 } }
    }
  } catch {
    // SM failure is non-fatal — fall through to full compact
  }

  // Full compaction (API call)
  try {
    const result = await compactConversation(messages, { isAutoCompact: true })
    return { wasCompacted: true, result, tracking: { consecutiveFailures: 0 } }
  } catch {
    return {
      wasCompacted: false,
      tracking: { consecutiveFailures: tracking.consecutiveFailures + 1 },
    }
  }
}
