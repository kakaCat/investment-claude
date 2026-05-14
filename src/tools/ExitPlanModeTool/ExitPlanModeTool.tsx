import React from 'react'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { ExitPlanModeToolUseUI, ExitPlanModeToolResultUI } from './UI.js'

type ExitPlanModeResult = {
  success: boolean
  status: 'approved' | 'rejected' | 'unavailable'
  message: string
  planLength: number
  feedback?: string
}

export const ExitPlanModeTool = buildTool<unknown, ExitPlanModeResult>({
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
        data: {
          success: false,
          status: 'unavailable',
          message: 'Exit plan mode not available in this context.',
          planLength: plan.length,
        }
      }
    }
    const result = await context.exitPlanMode(plan)
    if (result === 'approved') {
      return {
        data: {
          success: true,
          status: 'approved',
          message: 'Plan approved. You may now proceed with implementation using all tools.',
          planLength: plan.length,
        }
      }
    }
    if (result === 'rejected') {
      return {
        data: {
          success: false,
          status: 'rejected',
          message: 'Plan rejected. Please revise your plan and call exit_plan_mode again with the updated plan.',
          planLength: plan.length,
        }
      }
    }
    return {
      data: {
        success: false,
        status: 'rejected',
        message: `Plan rejected: ${result}. Please revise your plan accordingly and call exit_plan_mode again.`,
        feedback: result,
        planLength: plan.length,
      }
    }
  },
  mapToolResultToToolResultBlockParam(data, toolUseId) {
    if (data.status === 'approved') {
      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: `✓ Plan approved! You can now proceed with implementation.\n\nYour plan (${data.planLength} characters) has been reviewed and approved. Begin executing the planned steps.`,
      }
    }

    if (data.status === 'rejected') {
      let message = `✗ Plan rejected.\n\n`

      if (data.feedback) {
        message += `Feedback: ${data.feedback}\n\n`
      }

      message += `Please revise your plan based on the feedback and call exit_plan_mode again with the updated plan. Consider:\n- Addressing the specific concerns raised\n- Breaking down complex steps into smaller ones\n- Clarifying ambiguous parts\n- Adding more detail where needed`

      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: message,
      }
    }

    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: data.message,
    }
  },
  renderToolResultMessage(data) {
    return <ExitPlanModeToolResultUI result={data} />
  },
})
