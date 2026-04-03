import React from 'react'
import { buildTool } from '../../Tool.js'
import { getAppState } from '../../state/AppState.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { TodoWriteToolUseUI, TodoWriteToolResultUI } from './UI.js'
import type { TodoItem, TodoStatus } from '../../tasks/types.js'

export const TodoWriteTool = buildTool({
  name: 'todo_write',
  description: DESCRIPTION,
  searchHint: SEARCH_HINT,
  inputSchema: {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        description: 'The complete todo list to set',
        items: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'Imperative form of the task ("Run tests")' },
            status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
            activeForm: { type: 'string', description: 'Present continuous form ("Running tests")' },
          },
          required: ['content', 'status', 'activeForm'],
        },
      },
    },
    required: ['todos'],
  },
  isReadOnly: () => false,
  renderToolUse: (input) => <TodoWriteToolUseUI input={input as { todos: TodoItem[] }} />,
  renderToolResult: (_result) => {
    const todos = [...getAppState().todos]
    return <TodoWriteToolResultUI todos={todos} />
  },
  async call(input, context) {
    const { todos } = input as { todos: TodoItem[] }
    const validStatuses: TodoStatus[] = ['pending', 'in_progress', 'completed']
    for (const item of todos) {
      if (!item.content || !item.activeForm || !validStatuses.includes(item.status)) {
        return `ERROR: Invalid todo item: ${JSON.stringify(item)}. Each item must have content, activeForm, and status (pending|in_progress|completed).`
      }
    }
    const inProgressCount = todos.filter((t) => t.status === 'in_progress').length
    if (inProgressCount > 1) {
      console.warn(`[TodoWriteTool] Warning: ${inProgressCount} items are in_progress (recommended: at most 1)`)
    }
    context.setAppState((prev) => ({ ...prev, todos }))
    return `Todo list updated. ${todos.length} items.`
  },
})
