import React from 'react'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { TaskGetToolUseUI, TaskGetToolResultUI } from './UI.js'
import type { Task } from '../../tasks/types.js'

type TaskGetResult = {
  success: boolean
  task?: Task
  error?: string
  taskId?: number
}

export const TaskGetTool = buildTool<unknown, TaskGetResult>({
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
    if (!task) {
      return {
        data: {
          success: false,
          error: `Task ${id} not found.`,
          taskId: id,
        }
      }
    }
    return {
      data: {
        success: true,
        task,
      }
    }
  },
  mapToolResultToToolResultBlockParam(data, toolUseId) {
    if (!data.success) {
      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: `<error>${data.error}</error>\n\nUse TaskListTool to see all available tasks.`,
        is_error: true,
      }
    }

    const task = data.task!
    let message = `Task #${task.id}: ${task.subject}\nStatus: ${task.status}`

    if (task.owner) {
      message += `\nOwner: ${task.owner}`
    }

    if (task.description) {
      message += `\nDescription: ${task.description}`
    }

    if (task.blockedBy && task.blockedBy.length > 0) {
      message += `\n\nBlocked by: ${task.blockedBy.join(', ')}`
    }

    if (task.createdAt) {
      message += `\nCreated: ${new Date(task.createdAt).toLocaleString()}`
    }

    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: message,
    }
  },
  renderToolResultMessage(data) {
    return <TaskGetToolResultUI result={data} />
  },
})
