// src/tools/AgentTool/runSubAgent.ts

import type { Tool } from '../../Tool.js'
import type { AgentDefinition } from '../../agents/types.js'
import { assembleToolPool } from '../../agents/assembleToolPool.js'
import { resolveModel } from '../../agents/resolveModel.js'
import { query } from '../../query.js'

export type SubAgentContext = {
  allTools: Tool[]
  abortSignal: AbortSignal
  cwd: string
}

/**
 * Executes a sub-agent synchronously: assembles the tool pool, calls query(),
 * collects all streamed text, and returns the final result string.
 *
 * Extension points (add when needed):
 * - TODO(background): wrap in async task, return task ID immediately
 * - TODO(fork): accept parent messages to prepend (fork mode)
 * - TODO(worktree): create isolated git worktree, override cwd
 */
export async function runSubAgent(
  agentDef: AgentDefinition,
  prompt: string,
  parentContext: SubAgentContext,
): Promise<string> {
  const toolPool = assembleToolPool(parentContext.allTools, agentDef)
  const model = resolveModel(agentDef.model)

  const messages = [
    {
      type: 'user' as const,
      content: [{ type: 'text' as const, text: prompt }],
    },
  ]

  let result = ''

  const gen = query({
    messages,
    tools: toolPool,
    allTools: toolPool,
    systemPrompt: agentDef.getSystemPrompt(),
    model,
    maxTurns: agentDef.maxTurns ?? 10,
    abortSignal: parentContext.abortSignal,
    // Sub-agent has full permission within its assembled tool pool
    canUseTool: () => Promise.resolve('allow' as const),
  })

  for await (const event of gen) {
    if (event.type === 'text_delta') result += event.delta
    if (event.type === 'error') throw event.error
  }

  return result.trim() || '(no output)'
}
