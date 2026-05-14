import React from 'react'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { TaskUpdateToolUseUI, TaskUpdateToolResultUI } from './UI.js'
import { updateTaskFile } from '../../tasks/taskFileStore.js'
import type { Task, TaskStatus } from '../../tasks/types.js'

type TaskUpdateResult = {
  success: boolean
  task?: Task
  changes?: Partial<Omit<Task, 'id'>>
  error?: string
  taskId?: number
}

export const TaskUpdateTool = buildTool<unknown, TaskUpdateResult>({
  name: 'task_update',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'number', description: 'The task ID to update' },
      status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'stopped'], description: 'New status' },
      owner: { type: 'string', description: 'Assign task to this owner' },
      output: { type: 'string', description: 'Store output/result for the task' },
      description: { type: 'string', description: 'Update the task description' },
    },
    required: ['id'],
  },
  isReadOnly: () => false,
  renderToolUse: (input) => <TaskUpdateToolUseUI input={input as { id: number; status?: string }} />,
  renderToolResult: (result) => <TaskUpdateToolResultUI result={result} />,
  async call(input, context) {
    const { id, status, owner, output, description } = input as {
      id: number
      status?: TaskStatus
      owner?: string
      output?: string
      description?: string
    }
    const now = new Date().toISOString()
    const updates: Partial<Omit<Task, 'id'>> = { updatedAt: now }
    if (status !== undefined) updates.status = status
    if (owner !== undefined) updates.owner = owner
    if (output !== undefined) updates.output = output
    if (description !== undefined) updates.description = description

    try {
      const updated = await updateTaskFile(id, updates, context)
      if (!updated) {
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
          task: updated,
          changes: updates,
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
      return {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: `<error>Failed to update task: ${data.error}</error>\n\nVerify the task ID exists and the update parameters are valid.`,
        is_error: true,
      }
    }

    const task = data.task!
    const changes = data.changes!
    const changeList = Object.entries(changes)
      .map(([key, value]) => `  - ${key}: ${JSON.stringify(value)}`)
      .join('\n')

    let message = `Task #${task.id} updated successfully:\n${changeList}`

    if (changes.status === 'completed') {
      message += `\n\n✓ Task marked as completed. Consider checking for any tasks that were blocked by this one.`
    } else if (changes.status === 'in_progress') {
      message += `\n\n→ Task is now in progress.`
    }

    if (changes.owner) {
      message += `\n\nTask ownership changed to: ${changes.owner}`
    }

    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: message,
    }
  },
  renderToolResultMessage(data) {
    return <TaskUpdateToolResultUI result={data} />
  },
})
