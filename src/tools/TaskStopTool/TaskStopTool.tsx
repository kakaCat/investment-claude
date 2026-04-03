import React from 'react'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { TaskStopToolUseUI, TaskStopToolResultUI } from './UI.js'
import type { Task } from '../../tasks/types.js'

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

    context.setAppState((prev) => {
      const t = prev.tasks.get(id)
      if (!t) return prev

      const stoppedTask: Task = {
        ...t,
        status: 'stopped',
        updatedAt: new Date().toISOString(),
      }

      return {
        ...prev,
        tasks: new Map(prev.tasks).set(id, stoppedTask),
      }
    })

    return 'Task stopped.'
  },
})
