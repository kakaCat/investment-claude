// Session Memory extraction engine
// Port of Claude Code src/services/SessionMemory/sessionMemory.ts
// Replaces CC's runForkedAgent with a direct Anthropic API call
// (only edit_file permission on the SM file)

import Anthropic from '@anthropic-ai/sdk'
import { mkdir, writeFile } from 'fs/promises'
import { getSessionMemoryDir, getSessionMemoryPath } from './path.js'
import {
  buildSessionMemoryUpdatePrompt,
  DEFAULT_SESSION_MEMORY_TEMPLATE,
  isSessionMemoryEmpty,
  truncateSessionMemoryForCompact,
} from './prompts.js'
import {
  getExtractionPromise,
  getSessionMemoryContent,
  recordExtractionTokenCount,
  roughTokenCount,
  setExtractionPromise,
  setLastSummarizedMessageId,
  shouldExtractMemory,
} from './utils.js'
import type { Message } from '../types/message.js'

// ── Setup ─────────────────────────────────────────────────────────────────────

async function ensureSessionMemoryFile(): Promise<{
  memoryPath: string
  currentMemory: string
}> {
  const dir = getSessionMemoryDir()
  const memoryPath = getSessionMemoryPath()

  await mkdir(dir, { recursive: true })

  // Create file with template if it doesn't exist
  try {
    await writeFile(memoryPath, DEFAULT_SESSION_MEMORY_TEMPLATE.trimStart(), {
      flag: 'wx',
      encoding: 'utf-8',
    })
  } catch (err: any) {
    if (err.code !== 'EEXIST') throw err
  }

  const content = await getSessionMemoryContent()
  return { memoryPath, currentMemory: content ?? '' }
}

// ── Core extraction ───────────────────────────────────────────────────────────

/**
 * Run a single API call to update the SM file.
 * Only the edit_file tool is offered, and canUseTool rejects calls to any file
 * other than the SM file.
 */
async function runSmExtraction(
  messages: Message[],
  memoryPath: string,
  currentMemory: string,
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  const baseURL = process.env.PI_BASE_URL
  if (!apiKey) return

  const client = new Anthropic({ apiKey, baseURL })

  const systemPrompt =
    'You are a session notes assistant. Your only job is to update the provided notes file using the edit_file tool.'

  const updatePrompt = buildSessionMemoryUpdatePrompt(currentMemory, memoryPath)

  const apiMessages: Anthropic.MessageParam[] = [
    // Include conversation context (last 100 messages to keep it manageable)
    ...messages.slice(-100)
      .filter((m): m is Exclude<Message, { type: 'compact_boundary' }> => m.type !== 'compact_boundary')
      .map((m) => ({
        role: m.type as 'user' | 'assistant',
        content: m.content as Anthropic.MessageParam['content'],
      })),
    {
      role: 'user',
      content: updatePrompt,
    },
  ]

  const editFileTool: Anthropic.Tool = {
    name: 'edit_file',
    description: 'Edit a file by replacing a string',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string' },
        old_string: { type: 'string' },
        new_string: { type: 'string' },
      },
      required: ['path', 'old_string', 'new_string'],
    },
  }

  const response = await client.messages.create({
    model: process.env.PI_MODEL ?? 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    system: systemPrompt,
    messages: apiMessages,
    tools: [editFileTool],
  })

  // Execute any edit_file tool calls (only on the SM file)
  for (const block of response.content) {
    if (block.type !== 'tool_use' || block.name !== 'edit_file') continue
    const input = block.input as { path: string; old_string: string; new_string: string }
    // Security: only allow edits to the SM file
    if (input.path !== memoryPath) continue
    try {
      const { readFile, writeFile: wf } = await import('fs/promises')
      const content = await readFile(memoryPath, 'utf-8')
      if (content.includes(input.old_string)) {
        await wf(memoryPath, content.replace(input.old_string, input.new_string), 'utf-8')
      }
    } catch {
      // silently skip failed edits
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function initSessionMemory(): void {
  // Intentionally empty for now — state lives in utils.ts module-level vars.
  // Called during REPL init to signal SM is active.
}

/**
 * Fire-and-forget extraction. Called after each `done` event in REPL.
 * Skips if extraction is already in progress.
 */
export async function extractSessionMemoryIfNeeded(
  messages: Message[],
): Promise<void> {
  if (getExtractionPromise()) return // already running
  if (!shouldExtractMemory(messages)) return

  const promise = (async () => {
    try {
      const { memoryPath, currentMemory } = await ensureSessionMemoryFile()
      await runSmExtraction(messages, memoryPath, currentMemory)
      recordExtractionTokenCount(roughTokenCount(messages))
      // Update lastSummarizedMessageId only if last turn has no tool calls
      const last = messages[messages.length - 1]
      const secondLast = messages[messages.length - 2]
      const lastAssistant = secondLast?.type === 'assistant' ? secondLast : null
      const hasTools = lastAssistant?.content.some((c) => c.type === 'tool_use') ?? false
      if (!hasTools && last) {
        setLastSummarizedMessageId((last as any).uuid)
      }
    } catch {
      // Silently fail — SM extraction is best-effort
    } finally {
      setExtractionPromise(undefined)
    }
  })()

  setExtractionPromise(promise)
  // Don't await — fire-and-forget
}

/**
 * Manually trigger extraction, bypassing thresholds.
 * Used by /summary command.
 */
export async function manuallyExtractSessionMemory(
  messages: Message[],
): Promise<{ success: boolean; memoryPath?: string; error?: string }> {
  if (messages.length === 0) {
    return { success: false, error: 'No messages to summarize' }
  }

  try {
    const { memoryPath, currentMemory } = await ensureSessionMemoryFile()
    await runSmExtraction(messages, memoryPath, currentMemory)
    recordExtractionTokenCount(roughTokenCount(messages))
    return { success: true, memoryPath }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export { isSessionMemoryEmpty, truncateSessionMemoryForCompact } from './prompts.js'
export { getSessionMemoryContent, waitForSessionMemoryExtraction } from './utils.js'
