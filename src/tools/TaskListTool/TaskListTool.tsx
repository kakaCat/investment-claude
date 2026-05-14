import React from 'react'
import { buildTool } from '../../Tool.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { TaskListToolUseUI, TaskListToolResultUI, TaskListToolResultMessageUI } from './UI.js'
import type { TaskStatus, Task } from '../../tasks/types.js'

type TaskListResult = {
  tasks: Task[]
  totalTasks: number
  filters: {
    status?: TaskStatus
    owner?: string
  }
}

export const TaskListTool = buildTool<
  { status?: TaskStatus; owner?: string },
  TaskListResult
>({
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
  renderToolResultMessage: (output) => <TaskListToolResultMessageUI output={output} />,
  async call(input, context) {
    const { status, owner } = input as { status?: TaskStatus; owner?: string }
    let tasks = Array.from(context.getAppState().tasks.values())
    if (status) tasks = tasks.filter((t) => t.status === status)
    if (owner) tasks = tasks.filter((t) => t.owner === owner)
    return {
      data: {
        tasks,
        totalTasks: tasks.length,
        filters: { status, owner },
      },
    }
  },
  mapToolResultToToolResultBlockParam(data, toolUseId) {
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: JSON.stringify(data.tasks),
    }
  },
})
