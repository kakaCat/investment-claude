import React from 'react'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { ExitPlanModeToolUseUI, ExitPlanModeToolResultUI } from './UI.js'

export const ExitPlanModeTool = buildTool({
  name: 'exit_plan_mode',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {
      plan: {
        type: 'string',
        description: 'The complete implementation plan to present to the user for approval',
      },
    },
    required: ['plan'],
  },
  isReadOnly: () => true,
  renderToolUse: (input) => <ExitPlanModeToolUseUI input={input as { plan: string }} />,
  renderToolResult: (result) => <ExitPlanModeToolResultUI result={result} />,
  async call(input, context) {
    const { plan } = input as { plan: string }
    if (!context.exitPlanMode) {
      return {

        data: 'Exit plan mode not available in this context.'

      }
    }
    const result = await context.exitPlanMode(plan)
    if (result === 'approved') {
      return {

        data: 'Plan approved. You may now proceed with implementation using all tools.'

      }
    }
    if (result === 'rejected') {
      return {

        data: 'Plan rejected. Please revise your plan and call exit_plan_mode again with the updated plan.'

      }
    }
    return {

      data: `Plan rejected: ${result}. Please revise your plan accordingly and call exit_plan_mode again.`

    }
  },
  mapToolResultToToolResultBlockParam(data, toolUseId) {
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: data,
    }
  },
})
