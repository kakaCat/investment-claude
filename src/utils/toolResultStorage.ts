// Two-layer tool result budget system — 对标 CC src/utils/toolResultStorage.ts
//
// Layer 1 (per-result): 工具执行后，单个结果超过 threshold 时写磁盘返回预览
// Layer 2 (per-turn):   每轮 API 调用前，整条 user message 的 tool_result 总大小
//                       超过 LAYER2_BUDGET_CHARS 时替换最大的几个

import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import { getSessionId } from '../bootstrap/state.js'
import type { Message, UserMessage, ToolResultContent } from '../types/message.js'

// ── Constants ─────────────────────────────────────────────────────────────────

export const DEFAULT_MAX_RESULT_SIZE_CHARS = 50_000
const LAYER2_BUDGET_CHARS = 200_000
const PREVIEW_SIZE_CHARS = 2_000

export const PERSISTED_OUTPUT_TAG = '<persisted-output>'

// ── State ─────────────────────────────────────────────────────────────────────

export type ContentReplacementState = {
  /** 已决策的 tool_use_id — 冻结，不再重新决策（prompt cache 稳定性） */
  seenIds: Set<string>
  /** tool_use_id → 替换后的预览字符串 */
  replacements: Map<string, string>
}

export function createContentReplacementState(): ContentReplacementState {
  return { seenIds: new Set(), replacements: new Map() }
}

// ── Paths ─────────────────────────────────────────────────────────────────────

function getToolResultDir(): string {
  return join(homedir(), '.pi', 'sessions', getSessionId(), 'tool-results')
}

// ── Layer 1: per-result ───────────────────────────────────────────────────────

/**
 * 工具执行后调用。如果 result 超过 threshold，写磁盘并返回 <persisted-output> 预览。
 * threshold = Infinity 时直接返回原始结果（opt-out）。
 */
export async function processToolResult(
  toolUseId: string,
  _toolName: string,
  result: string,
  threshold: number,
): Promise<string> {
  if (!Number.isFinite(threshold) || result.length <= threshold) {
    return result
  }
  return persistAndBuildPreview(toolUseId, result)
}

// ── Layer 2: per-message ──────────────────────────────────────────────────────

/**
 * 每轮 API 调用前调用。检查最近一条含 tool_result 的 user message 总大小，
 * 超过 LAYER2_BUDGET_CHARS 时替换最大的 fresh 结果。
 */
export async function enforceToolResultBudget(
  messages: Message[],
  state: ContentReplacementState,
): Promise<Message[]> {
  const lastUserIdx = findLastIndex(messages, m => m.type === 'user')
  if (lastUserIdx === -1) return messages

  const lastUser = messages[lastUserIdx] as UserMessage
  const toolResults = lastUser.content.filter(
    (c): c is ToolResultContent => c.type === 'tool_result',
  )
  if (toolResults.length === 0) return messages

  // 重新应用已有替换（保证 prompt cache 前缀稳定）
  const replacementMap = new Map<string, string>()
  for (const tr of toolResults) {
    const cached = state.replacements.get(tr.tool_use_id)
    if (cached !== undefined) replacementMap.set(tr.tool_use_id, cached)
  }

  // 计算应用已有替换后的有效总大小
  const effectiveSize = (tr: ToolResultContent): number => {
    if (Array.isArray(tr.content)) return 0
    return replacementMap.get(tr.tool_use_id)?.length ?? tr.content.length
  }

  const totalSize = toolResults.reduce((sum, tr) => sum + effectiveSize(tr), 0)

  if (totalSize <= LAYER2_BUDGET_CHARS) {
    for (const tr of toolResults) state.seenIds.add(tr.tool_use_id)
    if (replacementMap.size === 0) return messages
    return applyReplacements(messages, lastUserIdx, replacementMap)
  }

  // 找出 fresh（未冻结、未替换）的结果，按大小降序（跳过 array content）
  const fresh = toolResults
    .filter(tr =>
      !Array.isArray(tr.content) &&
      !state.seenIds.has(tr.tool_use_id) &&
      !replacementMap.has(tr.tool_use_id)
    )
    .sort((a, b) => (b.content as string).length - (a.content as string).length)

  let overBudget = totalSize - LAYER2_BUDGET_CHARS
  for (const tr of fresh) {
    if (overBudget <= 0) break
    const content = tr.content as string
    // 跳过已经是 persisted-output 格式的（Layer 1 已处理）
    if (content.startsWith(PERSISTED_OUTPUT_TAG)) continue
    const preview = await persistAndBuildPreview(tr.tool_use_id, content)
    replacementMap.set(tr.tool_use_id, preview)
    state.replacements.set(tr.tool_use_id, preview)
    overBudget -= content.length - preview.length
  }

  for (const tr of toolResults) state.seenIds.add(tr.tool_use_id)

  if (replacementMap.size === 0) return messages
  return applyReplacements(messages, lastUserIdx, replacementMap)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function persistAndBuildPreview(toolUseId: string, content: string): Promise<string> {
  const dir = getToolResultDir()
  await mkdir(dir, { recursive: true })
  const filepath = join(dir, `${toolUseId}.txt`)

  try {
    await writeFile(filepath, content, { encoding: 'utf-8', flag: 'wx' })
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
      // 写失败则直接截断，不抛出
      const truncated = content.slice(0, DEFAULT_MAX_RESULT_SIZE_CHARS)
      return `${truncated}\n\n[Output truncated: ${content.length} chars total, showing first ${DEFAULT_MAX_RESULT_SIZE_CHARS}]`
    }
    // EEXIST: 已写过，继续生成预览
  }

  const preview = content.slice(0, PREVIEW_SIZE_CHARS)
  const hasMore = content.length > PREVIEW_SIZE_CHARS
  const sizeKB = (content.length / 1024).toFixed(1)

  return (
    `${PERSISTED_OUTPUT_TAG}\n` +
    `Output too large (${sizeKB} KB). Full output saved to: ${filepath}\n\n` +
    `Preview (first ${PREVIEW_SIZE_CHARS} chars):\n` +
    preview +
    (hasMore ? '\n...\n' : '\n') +
    `</persisted-output>`
  )
}

function applyReplacements(
  messages: Message[],
  userIdx: number,
  replacementMap: Map<string, string>,
): Message[] {
  const user = messages[userIdx] as UserMessage
  const newContent = user.content.map(c => {
    if (c.type !== 'tool_result') return c
    if (Array.isArray(c.content)) return c
    const replacement = replacementMap.get(c.tool_use_id)
    if (replacement === undefined) return c
    return { ...c, content: replacement }
  })
  const newMessages = [...messages]
  newMessages[userIdx] = { ...user, content: newContent }
  return newMessages
}

function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i]!)) return i
  }
  return -1
}
