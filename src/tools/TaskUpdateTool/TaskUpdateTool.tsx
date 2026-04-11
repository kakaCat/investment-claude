import React from 'react'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { TaskUpdateToolUseUI, TaskUpdateToolResultUI } from './UI.js'
import { updateTaskFile } from '../../tasks/taskFileStore.js'
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
    const now = new Date().toISOString()
    const updates: Partial<Omit<Task, 'id'>> = { updatedAt: now }
    if (status !== undefined) updates.status = status
    if (owner !== undefined) updates.owner = owner
    if (output !== undefined) updates.output = output
    if (description !== undefined) updates.description = description

    try {
      const updated = await updateTaskFile(id, updates, context)
      if (!updated) return { data: `ERROR: Task ${id} not found.` }
      return { data: JSON.stringify(updated) }
    } catch (err) {
      return { data: `ERROR: ${err instanceof Error ? err.message : String(err)}` }
    }
  },
  mapToolResultToToolResultBlockParam(data, toolUseId) {
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: data,
    }
  },
})
