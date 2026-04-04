// Auto-compact: checks token usage every query loop iteration
// Port of Claude Code src/services/compact/autoCompact.ts (simplified)

import { compactConversation, type CompactResult } from './index.js'
import { trySessionMemoryCompaction } from './sessionMemory.js'
import type { Message } from '../types/message.js'

// ── Constants ─────────────────────────────────────────────────────────────────

const CONTEXT_WINDOW = 200_000
const MAX_OUTPUT_TOKENS_RESERVE = 20_000
const AUTOCOMPACT_BUFFER = 13_000
// Effective threshold: 200k - 20k - 13k = 167k tokens
const DEFAULT_THRESHOLD = CONTEXT_WINDOW - MAX_OUTPUT_TOKENS_RESERVE - AUTOCOMPACT_BUFFER

const MAX_CONSECUTIVE_FAILURES = 3

// ── Module state ──────────────────────────────────────────────────────────────

let consecutiveFailures = 0

// ── Helpers ───────────────────────────────────────────────────────────────────

export function roughTokenCount(messages: Message[]): number {
  return Math.floor(JSON.stringify(messages).length / 4)
}

export function getAutoCompactThreshold(): number {
  // Allow env override for easier testing
  const override = process.env.CLAUDE_AUTOCOMPACT_THRESHOLD
  if (override) {
    const parsed = parseInt(override, 10)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  return DEFAULT_THRESHOLD
}

export function shouldAutoCompact(messages: Message[]): boolean {
  if (process.env.DISABLE_AUTO_COMPACT === '1') return false
  const tokens = roughTokenCount(messages)
  return tokens >= getAutoCompactThreshold()
}

// ── Main function ─────────────────────────────────────────────────────────────

export async function autoCompactIfNeeded(
  messages: Message[],
): Promise<{ wasCompacted: boolean; result?: CompactResult }> {
  if (!shouldAutoCompact(messages)) {
    return { wasCompacted: false }
  }

  // Circuit breaker: stop retrying after N consecutive failures
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    return { wasCompacted: false }
  }

  const threshold = getAutoCompactThreshold()

  // Try session memory compaction first (no API call needed)
  try {
    const smResult = await trySessionMemoryCompaction(messages, threshold)
    if (smResult) {
      consecutiveFailures = 0
      return { wasCompacted: true, result: smResult }
    }
  } catch {
    // SM failure is non-fatal — fall through to full compact
  }

  // Full compaction (API call)
  try {
    const result = await compactConversation(messages, { isAutoCompact: true })
    consecutiveFailures = 0
    return { wasCompacted: true, result }
  } catch {
    consecutiveFailures++
    return { wasCompacted: false }
  }
}

export function resetAutoCompactState(): void {
  consecutiveFailures = 0
}
