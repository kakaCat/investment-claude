import React from 'react'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { TaskStopToolUseUI, TaskStopToolResultUI } from './UI.js'
import { updateTaskFile } from '../../tasks/taskFileStore.js'

export const TaskStopTool = buildTool({
  name: 'task_stop',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'number', description: 'The task ID to stop' },
    },
    required: ['id'],
  },
  isReadOnly: () => false,
  renderToolUse: (input) => <TaskStopToolUseUI input={input as { id: number }} />,
  renderToolResult: (result) => <TaskStopToolResultUI result={result} />,
  async call(input, context) {
    const { id } = input as { id: number }
    const task = context.getAppState().tasks.get(id)
    if (!task) return `ERROR: Task ${id} not found.`
    if (task.status === 'stopped' || task.status === 'completed') {
      return `ERROR: Task ${id} is already ${task.status}.`
    }

    try {
      await updateTaskFile(id, { status: 'stopped', updatedAt: new Date().toISOString() }, context)
      return 'Task stopped.'
    } catch (err) {
      return `ERROR: ${err instanceof Error ? err.message : String(err)}`
    }
  },
})
