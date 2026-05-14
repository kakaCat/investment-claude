import React from 'react'
import { Box, Text } from 'ink'
import type { Task } from '../../tasks/types.js'

export function TaskUpdateToolUseUI({ input }: { input: { id: number; status?: string } }) {
  return (
    <Box>
      <Text color="cyan" bold>task_update </Text>
      <Text color="gray">#{input.id}</Text>
      {input.status && <Text color="gray"> → {input.status}</Text>}
    </Box>
  )
}

type TaskUpdateResult = {
  success: boolean
  task?: Task
  changes?: Partial<Omit<Task, 'id'>>
  error?: string
  taskId?: number
}

export function TaskUpdateToolResultUI({ result }: { result: TaskUpdateResult | string }) {
  // Backward compatibility: handle string result
  if (typeof result === 'string') {
    if (result.startsWith('ERROR:')) {
      return <Box paddingX={1}><Text color="red">{result}</Text></Box>
    }
    try {
      const task = JSON.parse(result) as Task
      return (
        <Box paddingX={1} gap={1}>
          <Text color="gray">#{task.id}</Text>
          <Text>{task.subject}</Text>
          <Text color="gray">[{task.status}]</Text>
          {task.owner && <Text color="gray">@{task.owner}</Text>}
        </Box>
      )
    } catch {
      return <Box paddingX={1}><Text color="gray">{result}</Text></Box>
    }
  }

  // New structured result
  if (!result.success) {
    return (
      <Box paddingX={1}>
        <Text color="red">ERROR: {result.error}</Text>
      </Box>
    )
  }

  const task = result.task!
  const changes = result.changes || {}
  const changedFields = Object.keys(changes).filter(k => k !== 'updatedAt')

  return (
    <Box paddingX={1} flexDirection="column">
      <Box gap={1}>
        <Text color="green">✓ Updated task</Text>
        <Text color="gray">#{task.id}</Text>
      </Box>
      <Box paddingLeft={2}>
        <Text>{task.subject}</Text>
      </Box>
      {changedFields.length > 0 && (
        <Box paddingLeft={2} gap={1}>
          <Text color="yellow">Changed:</Text>
          <Text color="gray">{changedFields.join(', ')}</Text>
        </Box>
      )}
      <Box paddingLeft={2} gap={1}>
        <Text color="gray">[{task.status}]</Text>
        {task.owner && <Text color="gray">@{task.owner}</Text>}
      </Box>
    </Box>
  )
}
