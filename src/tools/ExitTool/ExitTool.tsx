import React from 'react'
import { Text } from 'ink'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'

export const ExitTool = buildTool({
  name: 'exit',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {
      reason: {
        type: 'string',
        description: 'Optional message to display before exiting',
      },
    },
    required: [],
  },
  isReadOnly: () => true,
  renderToolUse: (input) => {
    const { reason } = input as { reason?: string }
    return <Text color="yellow">Exiting{reason ? `: ${reason}` : '…'}</Text>
  },
  renderToolResult: (result) => <Text color="gray">{result}</Text>,
  async call(input, context) {
    const { reason } = input as { reason?: string }
    if (reason) {
      process.stdout.write(reason + '\n')
    }
    if (context.onExit) {
      await context.onExit()
    } else {
      process.exit(0)
    }
    return { data: 'Exiting session.' }
  },
  mapToolResultToToolResultBlockParam(data, toolUseId) {
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: `${data}\n\nThe session will terminate after this message. Any unsaved work should be committed before exiting.`,
    }
  },
})
