import React from 'react'
import { Box, Text } from 'ink'
import type { Task } from '../../tasks/types.js'

export function TaskListToolUseUI({ input }: { input: { status?: string; owner?: string } }) {
  const filters: string[] = []
  if (input.status) filters.push(`status=${input.status}`)
  if (input.owner) filters.push(`owner=${input.owner}`)
  return (
    <Box>
      <Text color="cyan" bold>task_list </Text>
      <Text color="gray">{filters.length ? filters.join(', ') : 'all'}</Text>
    </Box>
  )
}

function statusColor(status: Task['status']): string {
  switch (status) {
    case 'completed': return 'green'
    case 'in_progress': return 'yellow'
    case 'stopped': return 'red'
    case 'pending':
    default: return 'gray'
  }
}

export function TaskListToolResultUI({ result }: { result: string }) {
  let tasks: Task[] = []
  try {
    tasks = JSON.parse(result) as Task[]
  } catch {
    return <Box paddingX={1}><Text color="gray">{result}</Text></Box>
  }
  if (tasks.length === 0) {
    return <Box paddingX={1}><Text color="gray">No tasks found.</Text></Box>
  }
  return (
    <Box flexDirection="column" paddingX={1}>
      {tasks.map((task) => (
        <Box key={task.id} gap={1}>
          <Text color="gray">#{task.id}</Text>
          <Text>{task.subject}</Text>
          <Text color={statusColor(task.status) as Parameters<typeof Text>[0]['color']}>[{task.status}]</Text>
          {task.owner && <Text color="gray">@{task.owner}</Text>}
        </Box>
      ))}
    </Box>
  )
}
