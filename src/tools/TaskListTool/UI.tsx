import React from 'react'
import { Box, Text } from 'ink'
import type { Task, TaskStatus } from '../../tasks/types.js'

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

type TaskListResult = {
  tasks: Task[]
  totalTasks: number
  filters: {
    status?: TaskStatus
    owner?: string
  }
}

function statusIcon(status: Task['status']): string {
  switch (status) {
    case 'completed': return '✓'
    case 'in_progress': return '▶'
    case 'stopped': return '✗'
    case 'pending': return '○'
    default: return '?'
  }
}

export function TaskListToolResultMessageUI({ output }: { output: TaskListResult }) {
  const filters: string[] = []
  if (output.filters.status) filters.push(`status=${output.filters.status}`)
  if (output.filters.owner) filters.push(`owner=${output.filters.owner}`)
  const filterStr = filters.length ? filters.join(', ') : 'all'

  if (output.totalTasks === 0) {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Box>
          <Text backgroundColor="gray" color="black"> IN </Text>
          <Text> task_list {filterStr}</Text>
        </Box>
        <Box marginTop={1}>
          <Text backgroundColor="gray" color="black"> OUT </Text>
          <Text color="yellow"> No tasks found</Text>
        </Box>
      </Box>
    )
  }

  const byStatus = output.tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1
    return acc
  }, {} as Record<TaskStatus, number>)

  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Box>
        <Text backgroundColor="gray" color="black"> IN </Text>
        <Text> task_list {filterStr}</Text>
      </Box>
      <Box marginTop={1}>
        <Text backgroundColor="gray" color="black"> OUT </Text>
        <Text color="green"> ✓ Found {output.totalTasks} task{output.totalTasks !== 1 ? 's' : ''}</Text>
      </Box>

      {Object.keys(byStatus).length > 1 && (
        <Box paddingLeft={5}>
          <Text color="gray">
            {Object.entries(byStatus).map(([status, count]) => `${status}: ${count}`).join(', ')}
          </Text>
        </Box>
      )}

      <Box flexDirection="column" paddingLeft={5} marginTop={1}>
        {output.tasks.slice(0, 10).map((task) => (
          <Box key={task.id} gap={1}>
            <Text color={statusColor(task.status) as Parameters<typeof Text>[0]['color']}>
              {statusIcon(task.status)}
            </Text>
            <Text color="gray">#{task.id}</Text>
            <Text>{task.subject}</Text>
            {task.owner && <Text color="gray">@{task.owner}</Text>}
          </Box>
        ))}
        {output.totalTasks > 10 && (
          <Text color="gray">... and {output.totalTasks - 10} more</Text>
        )}
      </Box>
    </Box>
  )
}
