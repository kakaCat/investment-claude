import React from 'react'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { TaskCreateToolUseUI, TaskCreateToolResultUI } from './UI.js'
import type { Task } from '../../tasks/types.js'

export const TaskCreateTool = buildTool({
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
    let createdTask: Task | undefined
    context.setAppState((prev) => {
      const now = new Date().toISOString()
      const task: Task = {
        id: prev.nextTaskId,
        subject,
        description,
        activeForm,
        status: 'pending',
        blockedBy: blockedBy ?? [],
        owner: undefined,
        createdAt: now,
        updatedAt: now,
      }
      createdTask = task
      return {
        ...prev,
        nextTaskId: prev.nextTaskId + 1,
        tasks: new Map(prev.tasks).set(task.id, task),
      }
    })
    if (!createdTask) return 'ERROR: Failed to create task.'
    return JSON.stringify(createdTask)
  },
})
