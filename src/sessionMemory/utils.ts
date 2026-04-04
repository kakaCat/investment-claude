// Port of Claude Code src/services/SessionMemory/sessionMemoryUtils.ts
import { readFile } from 'fs/promises'
import { getSessionMemoryPath } from './path.js'
import type { Message } from '../types/message.js'

// ── Config ────────────────────────────────────────────────────────────────────

export type SessionMemoryConfig = {
  minimumMessageTokensToInit: number
  minimumTokensBetweenUpdate: number
  toolCallsBetweenUpdates: number
}

export const DEFAULT_SESSION_MEMORY_CONFIG: SessionMemoryConfig = {
  minimumMessageTokensToInit: 10_000,
  minimumTokensBetweenUpdate: 5_000,
  toolCallsBetweenUpdates: 3,
}

// ── Module-level state ────────────────────────────────────────────────────────

let sessionMemoryConfig: SessionMemoryConfig = { ...DEFAULT_SESSION_MEMORY_CONFIG }
let lastSummarizedMessageId: string | undefined
// Promise ref instead of CC's timestamp-based extractionStartedAt
let extractionPromise: Promise<void> | undefined
let tokensAtLastExtraction = 0
let sessionMemoryInitialized = false

// ── State accessors ───────────────────────────────────────────────────────────

export function getLastSummarizedMessageId(): string | undefined {
  return lastSummarizedMessageId
}

export function setLastSummarizedMessageId(id: string | undefined): void {
  lastSummarizedMessageId = id
}

export function setExtractionPromise(p: Promise<void> | undefined): void {
  extractionPromise = p
}

export function getExtractionPromise(): Promise<void> | undefined {
  return extractionPromise
}

export function recordExtractionTokenCount(count: number): void {
  tokensAtLastExtraction = count
}

export function isSessionMemoryInitialized(): boolean {
  return sessionMemoryInitialized
}

export function markSessionMemoryInitialized(): void {
  sessionMemoryInitialized = true
}

export function setSessionMemoryConfig(config: Partial<SessionMemoryConfig>): void {
  sessionMemoryConfig = { ...sessionMemoryConfig, ...config }
}

export function getSessionMemoryConfig(): SessionMemoryConfig {
  return { ...sessionMemoryConfig }
}

// ── Threshold helpers ─────────────────────────────────────────────────────────

export function hasMetInitializationThreshold(currentTokenCount: number): boolean {
  return currentTokenCount >= sessionMemoryConfig.minimumMessageTokensToInit
}

export function hasMetUpdateThreshold(currentTokenCount: number): boolean {
  return (
    currentTokenCount - tokensAtLastExtraction >=
    sessionMemoryConfig.minimumTokensBetweenUpdate
  )
}

export function getToolCallsBetweenUpdates(): number {
  return sessionMemoryConfig.toolCallsBetweenUpdates
}

// ── Token estimation ──────────────────────────────────────────────────────────

/** Rough token estimate: ~4 chars per token */
export function roughTokenCount(messages: Message[]): number {
  return Math.floor(JSON.stringify(messages).length / 4)
}

// ── Extraction wait ───────────────────────────────────────────────────────────

const EXTRACTION_WAIT_TIMEOUT_MS = 15_000

/**
 * Wait for any in-progress extraction to complete (max 15s).
 * Uses a Promise ref instead of CC's timestamp polling.
 */
export async function waitForSessionMemoryExtraction(): Promise<void> {
  if (!extractionPromise) return
  const timeout = new Promise<void>((resolve) =>
    setTimeout(resolve, EXTRACTION_WAIT_TIMEOUT_MS),
  )
  await Promise.race([extractionPromise, timeout])
}

// ── SM content reader ─────────────────────────────────────────────────────────

export async function getSessionMemoryContent(): Promise<string | null> {
  try {
    return await readFile(getSessionMemoryPath(), 'utf-8')
  } catch {
    return null
  }
}

// ── shouldExtractMemory ───────────────────────────────────────────────────────

function countToolCallsSince(messages: Message[], sinceId: string | undefined): number {
  let count = 0
  let found = sinceId === undefined
  for (const msg of messages) {
    if (!found) {
      if ('uuid' in msg && (msg as any).uuid === sinceId) found = true
      continue
    }
    if (msg.type === 'assistant') {
      count += msg.content.filter((c) => c.type === 'tool_use').length
    }
  }
  return count
}

function hasToolCallsInLastAssistantTurn(messages: Message[]): boolean {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.type === 'assistant') {
      return msg.content.some((c) => c.type === 'tool_use')
    }
  }
  return false
}

export function shouldExtractMemory(messages: Message[]): boolean {
  const tokenCount = roughTokenCount(messages)

  if (!isSessionMemoryInitialized()) {
    if (!hasMetInitializationThreshold(tokenCount)) return false
    markSessionMemoryInitialized()
  }

  const hasMetToken = hasMetUpdateThreshold(tokenCount)
  const toolCallsSince = countToolCallsSince(messages, lastSummarizedMessageId)
  const hasMetToolCalls = toolCallsSince >= getToolCallsBetweenUpdates()
  const hasToolCallsInLast = hasToolCallsInLastAssistantTurn(messages)

  return (hasMetToken && hasMetToolCalls) || (hasMetToken && !hasToolCallsInLast)
}

// ── Reset (for tests) ─────────────────────────────────────────────────────────

export function resetSessionMemoryState(): void {
  sessionMemoryConfig = { ...DEFAULT_SESSION_MEMORY_CONFIG }
  lastSummarizedMessageId = undefined
  extractionPromise = undefined
  tokensAtLastExtraction = 0
  sessionMemoryInitialized = false
}
