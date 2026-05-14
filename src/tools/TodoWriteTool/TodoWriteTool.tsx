import React from 'react'
import { buildTool } from '../../Tool.js'
import { getAppState } from '../../state/AppState.js'
import { DESCRIPTION, SEARCH_HINT } from './prompt.js'
import { TodoWriteToolUseUI, TodoWriteToolResultUI } from './UI.js'
import type { TodoItem, TodoStatus } from '../../tasks/types.js'

type TodoWriteResult = {
  todos: TodoItem[]
  added: TodoItem[]
  completed: TodoItem[]
  updated: TodoItem[]
  total: number
}

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
  renderToolResultMessage: (output: TodoWriteResult) => (
    <TodoWriteToolResultUI
      todos={output.todos}
      added={output.added}
      completed={output.completed}
      updated={output.updated}
      total={output.total}
    />
  ),
  async call(input, context) {
    const { todos } = input as { todos: TodoItem[] }
    const validStatuses: TodoStatus[] = ['pending', 'in_progress', 'completed']
    for (const item of todos) {
      if (!item.content || !item.activeForm || !validStatuses.includes(item.status)) {
        return {
          data: {
            todos: [],
            added: [],
            completed: [],
            updated: [],
            total: 0,
          },
        }
      }
    }
    const inProgressCount = todos.filter((t) => t.status === 'in_progress').length
    if (inProgressCount > 1) {
      console.warn(`[TodoWriteTool] Warning: ${inProgressCount} items are in_progress (recommended: at most 1)`)
    }

    // 计算变更
    const oldTodos = context.getAppState().todos
    const oldMap = new Map(oldTodos.map((t) => [t.content, t]))
    const newMap = new Map(todos.map((t) => [t.content, t]))

    const added: TodoItem[] = []
    const completed: TodoItem[] = []
    const updated: TodoItem[] = []

    for (const todo of todos) {
      const old = oldMap.get(todo.content)
      if (!old) {
        added.push(todo)
      } else if (old.status !== todo.status) {
        if (todo.status === 'completed' && old.status !== 'completed') {
          completed.push(todo)
        } else {
          updated.push(todo)
        }
      }
    }

    context.setAppState((prev) => ({ ...prev, todos }))

    return {
      data: {
        todos,
        added,
        completed,
        updated,
        total: todos.length,
      },
    }
  },
  mapToolResultToToolResultBlockParam(data: TodoWriteResult, toolUseId) {
    return {
      type: 'tool_result',
      tool_use_id: toolUseId,
      content: `Todo list updated. ${data.total} items.`,
    }
  },
})
