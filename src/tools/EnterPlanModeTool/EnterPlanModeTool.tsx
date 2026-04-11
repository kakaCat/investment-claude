import React from 'react'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { EnterPlanModeToolUseUI, EnterPlanModeToolResultUI } from './UI.js'

export const EnterPlanModeTool = buildTool({
  name: 'enter_plan_mode',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  isReadOnly: () => true,
  renderToolUse: (input) => <EnterPlanModeToolUseUI input={input as Record<string, never>} />,
  renderToolResult: (result) => <EnterPlanModeToolResultUI result={result} />,
  async call(_input, context) {
    if (!context.enterPlanMode) {
      return {

        data: 'Plan mode not available in this context.'

      }
    }
    await context.enterPlanMode()
    return {

      data: 'Plan mode activated. Write tools are now disabled. Explore the codebase with read-only tools, then call exit_plan_mode with your complete plan.'

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
