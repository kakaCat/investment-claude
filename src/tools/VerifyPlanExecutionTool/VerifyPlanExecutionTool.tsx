import React from 'react'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { VerifyPlanExecutionToolUseUI, VerifyPlanExecutionToolResultUI } from './UI.js'

export const VerifyPlanExecutionTool = buildTool({
  name: 'verify_plan_execution',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description: 'Summary of what was implemented, to be verified against the plan',
      },
    },
    required: ['summary'],
  },
  isReadOnly: () => true,
  renderToolUse: (input) => <VerifyPlanExecutionToolUseUI input={input as { summary: string }} />,
  renderToolResult: (result) => <VerifyPlanExecutionToolResultUI result={result} />,
  async call(input, context) {
    const { summary } = input as { summary: string }
    if (!context.verifyExecution) {
      return {

        data: 'Verify execution not available in this context.'

      }
    }
    const result = await context.verifyExecution(summary)
    if (result === 'verified') {
      return {

        data: 'Execution verified. Implementation matches the plan.'

      }
    }
    if (result === 'rejected') {
      return {

        data: 'Execution rejected. Please review and fix the implementation to match the plan.'

      }
    }
    return {

      data: `Execution rejected: ${result}. Please review and fix the implementation accordingly.`

    }
  },
  mapToolResultToToolResultBlockParam(data, toolUseId) {
    if (data.includes('not available in this context')) {
      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: `${data}\n\nThis tool is only available when executing an approved plan. Use it after implementing plan steps to verify correctness.`,
      }
    }

    if (data.includes('verified')) {
      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: `✓ ${data}\n\nYour implementation has been verified against the approved plan. You can proceed with confidence.`,
      }
    }

    if (data.includes('rejected')) {
      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: `✗ ${data}\n\nReview the plan and your implementation to identify discrepancies. Common issues:\n- Missing planned features\n- Different approach than planned\n- Incomplete implementation\n- Additional unplanned changes`,
      }
    }

    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: data,
    }
  },
})
