import React from 'react'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { TaskUpdateToolUseUI, TaskUpdateToolResultUI } from './UI.js'
import type { Task, TaskStatus } from '../../tasks/types.js'

export const TaskUpdateTool = buildTool({
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
    const updates: Partial<Omit<Task, 'id' | 'createdAt'>> = {}
    if (status !== undefined) updates.status = status
    if (owner !== undefined) updates.owner = owner
    if (output !== undefined) updates.output = output
    if (description !== undefined) updates.description = description

    let task: Task | undefined
    context.setAppState((prev) => {
      const existingTask = prev.tasks.get(id)
      if (!existingTask) return prev
      task = {
        ...existingTask,
        ...updates,
        updatedAt: new Date().toISOString(),
      }
      return {
        ...prev,
        tasks: new Map(prev.tasks).set(id, task),
      }
    })
    if (!task) return `ERROR: Task ${id} not found.`
    return JSON.stringify(task)
  },
})
