import React from 'react'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { BashToolUseUI, BashToolResultUI } from './UI.js'

export const BashTool = buildTool({
  name: 'bash',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The bash command to run' },
    },
    required: ['command'],
  },
  isReadOnly: () => false,
  renderToolUse: (input) => (
    <BashToolUseUI input={input as { command: string }} />
  ),
  renderToolResult: (result) => <BashToolResultUI result={result} />,
  async call(input, _context) {
    const { command } = input as { command: string }
    return `[BashTool stub] would run: ${command}`
  },
})
