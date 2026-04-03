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
      return 'Verify execution not available in this context.'
    }
    const result = await context.verifyExecution(summary)
    if (result === 'verified') {
      return 'Execution verified. Implementation matches the plan.'
    }
    if (result === 'rejected') {
      return 'Execution rejected. Please review and fix the implementation to match the plan.'
    }
    return `Execution rejected: ${result}. Please review and fix the implementation accordingly.`
  },
})
