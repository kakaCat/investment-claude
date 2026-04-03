import React from 'react'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { TaskListToolUseUI, TaskListToolResultUI } from './UI.js'
import type { TaskStatus } from '../../tasks/types.js'

export const TaskListTool = buildTool({
  name: 'task_list',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {
      status: { type: 'string', description: 'Filter by task status', enum: ['pending', 'in_progress', 'completed', 'stopped'] },
      owner: { type: 'string', description: 'Filter by task owner' },
    },
  },
  isReadOnly: () => true,
  renderToolUse: (input) => <TaskListToolUseUI input={input as { status?: string; owner?: string }} />,
  renderToolResult: (result) => <TaskListToolResultUI result={result} />,
  async call(input, context) {
    const { status, owner } = input as { status?: TaskStatus; owner?: string }
    let tasks = Array.from(context.getAppState().tasks.values())
    if (status) tasks = tasks.filter((t) => t.status === status)
    if (owner) tasks = tasks.filter((t) => t.owner === owner)
    return JSON.stringify(tasks)
  },
})
