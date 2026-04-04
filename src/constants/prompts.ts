// src/constants/prompts.ts
// 系统提示词主入口 — 对标 Claude Code src/constants/prompts.ts

import {
  registerSection,
  registerVolatileSection,
  resolveSystemPrompt,
  clearSectionCache,
  type SectionContext,
} from './systemPromptSections.js'
import { IDENTITY, DOING_TASKS, TONE, PLAN_MODE_SECTION } from './promptSections.js'
import { loadEnvInfo } from '../context/envContext.js'
import { loadWorkspaceSection } from '../context/workspaceContext.js'
import { loadGitStatus } from '../context/gitContext.js'
import { loadClaudeMd } from '../context/claudeMdContext.js'
import { loadMemory } from '../context/memoryContext.js'

let initialized = false

export function initSystemPrompt(): void {
  if (initialized) return
  initialized = true

  // 静态段（缓存后永不失效）
  registerSection('identity', async () => IDENTITY)
  registerSection('doing_tasks', async () => DOING_TASKS)
  registerSection('tone', async () => TONE)

  // 动态段（首次加载后缓存，/clear 时重置）
  registerSection('env_info', (ctx) => loadEnvInfo(ctx))
  registerSection('workspace', (ctx) => loadWorkspaceSection(ctx))
  registerSection('git_status', (ctx) => loadGitStatus(ctx.cwd))
  registerSection('claude_md', (ctx) => loadClaudeMd(ctx.cwd))
  registerSection('memory', (ctx) => loadMemory(ctx.cwd))

  // volatile 段（每轮重新执行）
  registerVolatileSection('plan_mode', async (ctx) =>
    ctx.isPlanMode ? PLAN_MODE_SECTION : null,
  )
}

export async function getSystemPrompt(ctx: SectionContext): Promise<string> {
  return resolveSystemPrompt(ctx)
}

export { clearSectionCache }
export type { SectionContext }
