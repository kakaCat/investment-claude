// src/tools/AgentTool/AgentTool.tsx

import React from 'react'
import { buildTool } from '../../Tool.js'
import { loadAgents } from '../../agents/loadAgents.js'
import { runSubAgent } from './runSubAgent.js'
import { getPrompt, SEARCH_HINT } from './prompt.js'
import { AgentToolUseUI, AgentToolResultUI, AgentToolResultMessageUI } from './UI.js'

type AgentResult = {
  success: boolean
  output: string
  agentType: string
  error?: string
}

// Generate static description with empty agent list
// TODO: Upgrade Tool framework to support dynamic description generation
const DESCRIPTION = getPrompt([])

export const AgentTool = buildTool<
  { description: string; prompt: string; subagent_type?: string },
  AgentResult
>({
  name: 'Agent',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description: 'A short (3-5 word) description of the task',
      },
      prompt: {
        type: 'string',
        description:
          'The task for the agent to perform. Be complete — the agent has no prior conversation history.',
      },
      subagent_type: {
        type: 'string',
        description:
          'The type of specialized agent to use. Omit to use general-purpose.',
      },
      // Schema only — not yet implemented. Reserved for future background execution.
      run_in_background: {
        type: 'boolean',
        description:
          'Set to true to run this agent in the background (not yet supported — reserved for future use).',
      },
    },
    required: ['description', 'prompt'],
  },
  renderToolUse: (input) => (
    <AgentToolUseUI input={input as { description: string; subagent_type?: string }} />
  ),
  renderToolResult: (result) => <AgentToolResultUI result={result} />,
  renderToolResultMessage: (output) => <AgentToolResultMessageUI output={output} />,
  async call(input, context) {
    const { prompt, subagent_type } =
      input as { prompt: string; description: string; subagent_type?: string }

    const agents = await loadAgents(context.cwd)
    const type = subagent_type ?? 'general-purpose'
    const agentDef = agents.find(a => a.agentType === type)

    if (!agentDef) {
      const available = agents.map(a => a.agentType).join(', ')
      return {
        data: {
          success: false,
          output: '',
          agentType: type,
          error: `Unknown agent type '${type}'. Available: ${available}`,
        },
      }
    }

    // TODO(background): if run_in_background === true, wrap in async task
    // TODO(fork): if !subagent_type && forkGateEnabled, use buildForkedMessages
    // TODO(worktree): if isolation === 'worktree', createAgentWorktree first

    const output = await runSubAgent(agentDef, prompt, {
      allTools: context.tools,
      abortSignal: context.abortSignal,
      cwd: context.cwd,
    })

    return {
      data: {
        success: true,
        output,
        agentType: type,
      },
    }
  },
  mapToolResultToToolResultBlockParam(output, toolUseId) {
    if (!output.success) {
      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: `ERROR: ${output.error}`,
      }
    }
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: output.output,
    }
  },
})
