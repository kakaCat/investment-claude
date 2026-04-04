import React from 'react'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { TaskCreateToolUseUI, TaskCreateToolResultUI } from './UI.js'
import { createTaskFile } from '../../tasks/taskFileStore.js'

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
      return JSON.stringify(task)
    } catch (err) {
      return `ERROR: ${err instanceof Error ? err.message : String(err)}`
    }
  },
})
