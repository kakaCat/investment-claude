import React from 'react'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { ReadToolUseUI, ReadToolResultUI } from './UI.js'

export const ReadTool = buildTool({
  name: 'read_file',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'The file path to read' },
    },
    required: ['path'],
  },
  isReadOnly: () => true,
  renderToolUse: (input) => (
    <ReadToolUseUI input={input as { path: string }} />
  ),
  renderToolResult: (result) => <ReadToolResultUI result={result} />,
  async call(input, _context) {
    const { path } = input as { path: string }
    return `[ReadTool stub] would read: ${path}`
  },
})
