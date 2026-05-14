import React from 'react'
import { Box, Text } from 'ink'
import type { TodoItem } from '../../tasks/types.js'

export function TodoWriteToolUseUI({ input }: { input: { todos: TodoItem[] } }) {
  return (
    <Box>
      <Text color="cyan" bold>todo_write </Text>
      <Text color="gray">{input.todos?.length ?? 0} items</Text>
    </Box>
  )
}

function statusMarker(status: TodoItem['status']): { symbol: string; color: string } {
  switch (status) {
    case 'completed':
      return { symbol: '✓', color: 'green' }
    case 'in_progress':
      return { symbol: '→', color: 'yellow' }
    case 'pending':
    default:
      return { symbol: '○', color: 'gray' }
  }
}

export function TodoListUI({ todos }: { todos: TodoItem[] }) {
  return (
    <Box flexDirection="column" paddingX={1}>
      {todos.map((item, i) => {
        const { symbol, color } = statusMarker(item.status)
        return (
          <Box key={i} gap={1}>
            <Text color={color as Parameters<typeof Text>[0]['color']}>{symbol}</Text>
            <Text>{item.status === 'in_progress' ? item.activeForm : item.content}</Text>
          </Box>
        )
      })}
    </Box>
  )
}

export function TodoWriteToolResultUI({
  todos,
  added,
  completed,
  updated,
  total,
}: {
  todos: TodoItem[]
  added?: TodoItem[]
  completed?: TodoItem[]
  updated?: TodoItem[]
  total?: number
}) {
  // 如果传入了结构化数据，显示变更摘要
  if (added !== undefined || completed !== undefined || updated !== undefined) {
    if (todos.length === 0) {
      return (
        <Box paddingX={1}>
          <Text color="gray">Todo list cleared.</Text>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" paddingX={1}>
        {added && added.length > 0 && (
          <Text color="green">➕ Added {added.length} task{added.length > 1 ? 's' : ''}</Text>
        )}
        {completed && completed.length > 0 && (
          <Text color="green">✅ Completed {completed.length} task{completed.length > 1 ? 's' : ''}</Text>
        )}
        {updated && updated.length > 0 && (
          <Text color="yellow">📝 Updated {updated.length} task{updated.length > 1 ? 's' : ''}</Text>
        )}
        <Text color="cyan" dimColor>
          Total: {total} task{total !== 1 ? 's' : ''}
        </Text>
        <Box marginTop={1}>
          <TodoListUI todos={todos} />
        </Box>
      </Box>
    )
  }

  // Fallback: 使用旧的渲染
  if (todos.length === 0) {
    return (
      <Box paddingX={1}>
        <Text color="gray">Todo list cleared.</Text>
      </Box>
    )
  }
  return <TodoListUI todos={todos} />
}
