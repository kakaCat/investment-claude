import React from 'react'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { TaskCreateToolUseUI, TaskCreateToolResultUI } from './UI.js'
import { createTaskFile } from '../../tasks/taskFileStore.js'
import type { Task } from '../../tasks/types.js'

type TaskCreateResult = {
  success: boolean
  task?: Task
  error?: string
}

export const TaskCreateTool = buildTool<unknown, TaskCreateResult>({
  name: 'task_create',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {
      subject: { type: 'string', description: 'Short title for the task' },
      description: { type: 'string', description: 'Detailed description of the task' },
      activeForm: { type: 'string', description: 'Present continuous description ("Implementing feature X")' },
      blockedBy: {
        type: 'array',
        description: 'IDs of tasks that must complete before this one',
        items: { type: 'number' },
      },
    },
    required: ['subject'],
  },
  isReadOnly: () => false,
  renderToolUse: (input) => <TaskCreateToolUseUI input={input as { subject: string; description?: string }} />,
  renderToolResult: (result) => <TaskCreateToolResultUI result={result} />,
  async call(input, context) {
    const { subject, description, activeForm, blockedBy } = input as {
      subject: string
      description?: string
      activeForm?: string
      blockedBy?: number[]
    }
    const now = new Date().toISOString()
    try {
      const task = await createTaskFile(
        {
          subject,
          description,
          activeForm,
          status: 'pending',
          blockedBy: blockedBy ?? [],
          owner: undefined,
          createdAt: now,
          updatedAt: now,
        },
        context,
      )
      return {
        data: {
          success: true,
          task,
        }
      }
    } catch (err) {
      return {
        data: {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    }
  },
  mapToolResultToToolResultBlockParam(data, toolUseId) {
    if (!data.success) {
      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: `<error>Failed to create task: ${data.error}</error>`,
        is_error: true,
      }
    }

    const task = data.task!
    let message = `Task #${task.id} created successfully: "${task.subject}"`

    if (task.blockedBy && task.blockedBy.length > 0) {
      message += `\n\nNote: This task is blocked by task(s) ${task.blockedBy.join(', ')}. It cannot be started until those tasks are completed.`
    }

    if (task.description) {
      message += `\n\nDescription: ${task.description}`
    }

    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: message,
    }
  },
  renderToolResultMessage(data) {
    return <TaskCreateToolResultUI result={data} />
  },
})
