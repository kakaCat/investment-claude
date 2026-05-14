import React from 'react'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { TaskOutputToolUseUI, TaskOutputToolResultUI } from './UI.js'

type TaskOutputResult = {
  success: boolean
  taskId: number
  output?: string
  taskSubject?: string
  error?: string
}

export const TaskOutputTool = buildTool<unknown, TaskOutputResult>({
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
    if (!task) {
      return {
        data: {
          success: false,
          error: `Task ${id} not found.`,
          taskId: id,
        }
      }
    }
    if (!task.output) {
      return {
        data: {
          success: false,
          error: `Task ${id} has no stored output.`,
          taskId: id,
        }
      }
    }
    return {
      data: {
        success: true,
        taskId: id,
        output: task.output,
        taskSubject: task.subject,
      }
    }
  },
  mapToolResultToToolResultBlockParam(data, toolUseId) {
    if (!data.success) {
      let errorMsg = `<error>${data.error}</error>`

      if (data.error?.includes('not found')) {
        errorMsg += `\n\nTask #${data.taskId} does not exist. Use TaskListTool to see available tasks.`
      } else if (data.error?.includes('no stored output')) {
        errorMsg += `\n\nTask #${data.taskId} has not produced any output yet. This could mean:\n- The task is still running\n- The task hasn't started\n- The task completed without generating output\n\nCheck the task status with TaskGetTool.`
      }

      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: errorMsg,
        is_error: true,
      }
    }

    let message = `Output from Task #${data.taskId}`
    if (data.taskSubject) {
      message += ` (${data.taskSubject})`
    }
    message += `:\n\n${data.output}`

    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: message,
    }
  },
  renderToolResultMessage(data) {
    return <TaskOutputToolResultUI result={data} />
  },
})
