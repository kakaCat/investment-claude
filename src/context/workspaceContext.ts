import { mkdirSync } from 'fs'
import type { SectionContext } from '../constants/systemPromptSections.js'

export async function loadWorkspaceSection(ctx: SectionContext): Promise<string> {
  // 确保 workspace 目录存在
  try {
    mkdirSync(ctx.workspaceDir, { recursive: true })
  } catch {
    // 忽略已存在的错误
  }

  return [
    '# Workspace',
    `Session workspace: ${ctx.workspaceDir}`,
    'All agent-generated files (plans, notes, scratchpad, temp outputs) should be written to this directory unless the user specifies otherwise.',
  ].join('\n')
}
