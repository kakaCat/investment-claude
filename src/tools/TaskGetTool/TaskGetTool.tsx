import React from 'react'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { TaskGetToolUseUI, TaskGetToolResultUI } from './UI.js'

export const TaskGetTool = buildTool({
  name: 'task_get',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'number', description: 'The task ID to retrieve' },
    },
    required: ['id'],
  },
  isReadOnly: () => true,
  renderToolUse: (input) => <TaskGetToolUseUI input={input as { id: number }} />,
  renderToolResult: (result) => <TaskGetToolResultUI result={result} />,
  async call(input, context) {
    const { id } = input as { id: number }
    const task = context.getAppState().tasks.get(id)
    if (!task) return { data: `ERROR: Task ${id} not found.` }
    return { data: JSON.stringify(task) }
  },
  mapToolResultToToolResultBlockParam(data, toolUseId) {
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: data,
    }
  },
})
