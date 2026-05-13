// SystemPromptTool — 让 Agent 查看自己当前的系统提示词
import { buildTool, type ToolDef } from '../../Tool.js'
import { getSystemPrompt, type SectionContext } from '../../constants/prompts.js'
import { getWorkDir, getSessionId, getWorkspaceDir } from '../../bootstrap/state.js'

export type SystemPromptInput = {
  /** 可选：只看某一段（如 "bootstrap", "portfolio_pnl"），不填则返回完整提示词 */
  section?: string
}

export type SystemPromptOutput = {
  content: string
  length: number
}

const systemPromptToolDef: ToolDef<SystemPromptInput, SystemPromptOutput> = {
  name: 'ViewSystemPrompt',
  description: 'View the current system prompt that is being sent to the model. Useful for debugging and self-inspection. Optionally filter by section name.',

  inputSchema: {
    type: 'object',
    properties: {
      section: {
        type: 'string',
        description: 'Optional: filter to show only a specific section (e.g., "bootstrap", "portfolio_pnl"). Leave empty to see the full prompt.',
      },
    },
  },

  isReadOnly: () => true,

  async call(_input, _context) {
    const ctx: SectionContext = {
      cwd: getWorkDir(),
      sessionId: getSessionId(),
      workspaceDir: getWorkspaceDir(),
      isPlanMode: false,
    }

    const fullPrompt = await getSystemPrompt(ctx)

    const section = _input.section?.trim()
    if (section) {
      // 按 --- 分隔符拆分段落，查找包含 section 关键词的段
      const segments = fullPrompt.split('\n\n---\n\n')
      const matched = segments.filter(s =>
        s.toLowerCase().includes(section.toLowerCase())
      )
      if (matched.length > 0) {
        const content = matched.join('\n\n---\n\n')
        return { data: { content, length: content.length } }
      }
      return { data: { content: `未找到包含 "${section}" 的段落`, length: 0 } }
    }

    return { data: { content: fullPrompt, length: fullPrompt.length } }
  },

  mapToolResultToToolResultBlockParam(output, toolUseId) {
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: `System Prompt (${output.length} chars):\n\n${output.content}`,
    }
  },
}

export const SystemPromptTool = buildTool(systemPromptToolDef)
