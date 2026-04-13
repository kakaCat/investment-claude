import type { MutableRefObject } from 'react'
import type { Message } from '../types/message.js'
import type { UseAssistantHistoryResult } from '../hooks/useAssistantHistory.js'
import { findSkill, loadSkillContent } from '../skills/index.js'

// ── 类型 ──────────────────────────────────────────────────────────────────────

export type CommandContext = {
  history: UseAssistantHistoryResult
  conversationRef: MutableRefObject<Message[]>
  sessionIdRef: MutableRefObject<string>
  doExit: () => Promise<void>
  resetSession: () => void
  runCompact: (sessionId: string) => Promise<void>
  enterPartialCompact: (pivotIndex: number) => void
}

/** 返回 true 表示已处理（不走 query），false 表示未识别（继续走 query） */
export type CommandResult = boolean

export type Command = {
  name: string
  aliases?: string[]
  description: string
  call: (args: string, ctx: CommandContext) => Promise<CommandResult>
}

// ── Registry ──────────────────────────────────────────────────────────────────

const registry: Command[] = []

export function getRegistry(): readonly Command[] {
  return registry
}

export function registerCommand(cmd: Command): void {
  registry.push(cmd)
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

/**
 * 处理 slash command 输入。
 * 优先级：builtin registry → skill (展开内容后返回 false 让 query 处理)
 * 返回 true = 已本地处理；返回 false = 继续走 query（含 skill 展开后的 prompt）
 */
export async function dispatchSlashCommand(
  input: string,
  ctx: CommandContext,
): Promise<{ handled: boolean; expandedInput?: string }> {
  if (!input.startsWith('/')) return { handled: false }

  const spaceIdx = input.indexOf(' ')
  const name = spaceIdx === -1 ? input.slice(1) : input.slice(1, spaceIdx)
  const args = spaceIdx === -1 ? '' : input.slice(spaceIdx + 1)

  // 1. builtin registry
  const cmd = registry.find(c => c.name === name || c.aliases?.includes(name))
  if (cmd) {
    const handled = await cmd.call(args, ctx)
    return { handled }
  }

  // 2. skill — 读取 .md 内容展开为 prompt，交给 query 处理
  const skill = await findSkill(name, process.cwd())
  if (skill) {
    const content = await loadSkillContent(skill)
    // 将 skill 内容作为 system 前缀注入，args 作为用户追加内容
    const expanded = args ? `${content}\n\n${args}` : content
    return { handled: false, expandedInput: expanded }
  }

  // 3. 未识别 — 直接发给 API
  return { handled: false }
}
