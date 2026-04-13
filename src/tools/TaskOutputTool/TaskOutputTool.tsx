import React from 'react'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { TaskOutputToolUseUI, TaskOutputToolResultUI } from './UI.js'

export const TaskOutputTool = buildTool({
  name: 'task_output',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'number', description: 'The task ID to retrieve output for' },
    },
    required: ['id'],
  },
  isReadOnly: () => true,
  renderToolUse: (input) => <TaskOutputToolUseUI input={input as { id: number }} />,
  renderToolResult: (result) => <TaskOutputToolResultUI result={result} />,
  async call(input, context) {
    const { id } = input as { id: number }
    const task = context.getAppState().tasks.get(id)
    if (!task) return { data: `ERROR: Task ${id} not found.` }
    if (!task.output) return { data: `ERROR: Task ${id} has no stored output.` }
    return { data: task.output }
  },
  mapToolResultToToolResultBlockParam(data, toolUseId) {
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: data,
    }
  },
})
