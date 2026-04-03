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

export function TodoWriteToolResultUI({ todos }: { todos: TodoItem[] }) {
  if (todos.length === 0) {
    return (
      <Box paddingX={1}>
        <Text color="gray">Todo list cleared.</Text>
      </Box>
    )
  }
  return <TodoListUI todos={todos} />
}
