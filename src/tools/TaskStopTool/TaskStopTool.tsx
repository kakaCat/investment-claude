import React from 'react'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { TaskStopToolUseUI, TaskStopToolResultUI } from './UI.js'
import { updateTaskFile } from '../../tasks/taskFileStore.js'

type TaskStopResult = {
  success: boolean
  taskId: number
  message?: string
  error?: string
  currentStatus?: string
}

export const TaskStopTool = buildTool<unknown, TaskStopResult>({
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
    if (!task) {
      return {
        data: {
          success: false,
          error: `Task ${id} not found.`,
          taskId: id,
        }
      }
    }
    if (task.status === 'stopped' || task.status === 'completed') {
      return {
        data: {
          success: false,
          error: `Task ${id} is already ${task.status}.`,
          taskId: id,
          currentStatus: task.status,
        }
      }
    }

    try {
      await updateTaskFile(id, { status: 'stopped', updatedAt: new Date().toISOString() }, context)
      return {
        data: {
          success: true,
          taskId: id,
          message: 'Task stopped.',
        }
      }
    } catch (err) {
      return {
        data: {
          success: false,
          error: err instanceof Error ? err.message : String(err),
          taskId: id,
        }
      }
    }
  },
  mapToolResultToToolResultBlockParam(data, toolUseId) {
    if (!data.success) {
      let errorMsg = `<error>${data.error}</error>`

      if (data.currentStatus === 'stopped') {
        errorMsg += `\n\nTask #${data.taskId} is already stopped. No action needed.`
      } else if (data.currentStatus === 'completed') {
        errorMsg += `\n\nTask #${data.taskId} is already completed. Completed tasks cannot be stopped.`
      } else {
        errorMsg += `\n\nVerify the task ID and current status before attempting to stop.`
      }

      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: errorMsg,
        is_error: true,
      }
    }

    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: `Task #${data.taskId} stopped successfully.\n\nThe task execution has been terminated and its status updated to 'stopped'.`,
    }
  },
  renderToolResultMessage(data) {
    return <TaskStopToolResultUI result={data} />
  },
})
