// src/tools/AgentTool/AgentTool.tsx

import React from 'react'
import { buildTool } from '../../Tool.js'
import { loadAgents } from '../../agents/loadAgents.js'
import { runSubAgent } from './runSubAgent.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { AgentToolUseUI, AgentToolResultUI } from './UI.js'

export const AgentTool = buildTool({
  name: 'agent',
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
  async call(input, context) {
    const { prompt, subagent_type } =
      input as { prompt: string; description: string; subagent_type?: string }

    const agents = await loadAgents(context.cwd)
    const type = subagent_type ?? 'general-purpose'
    const agentDef = agents.find(a => a.agentType === type)

    if (!agentDef) {
      const available = agents.map(a => a.agentType).join(', ')
      return { data: `ERROR: Unknown agent type '${type}'. Available: ${available}` }
    }

    // TODO(background): if run_in_background === true, wrap in async task
    // TODO(fork): if !subagent_type && forkGateEnabled, use buildForkedMessages
    // TODO(worktree): if isolation === 'worktree', createAgentWorktree first

    return {
      data: await runSubAgent(agentDef, prompt, {
        allTools: context.tools,
        abortSignal: context.abortSignal,
        cwd: context.cwd,
      }),
    }
  },
  mapToolResultToToolResultBlockParam(output, toolUseId) {
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: output,
    }
  },
})
