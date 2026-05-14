import React from 'react'
import { Box, Text } from 'ink'
import type { Task } from '../../tasks/types.js'

export function TaskCreateToolUseUI({ input }: { input: { subject: string; description?: string } }) {
  return (
    <Box>
      <Text color="cyan" bold>task_create </Text>
      <Text color="gray">{input.subject}</Text>
    </Box>
  )
}

type TaskCreateResult = {
  success: boolean
  task?: Task
  error?: string
}

export function TaskCreateToolResultUI({ result }: { result: TaskCreateResult | string }) {
  // Backward compatibility: handle string result
  if (typeof result === 'string') {
    let task: Task | null = null
    try {
      task = JSON.parse(result) as Task
    } catch {
      return (
        <Box paddingX={1}>
          <Text color="red">{result}</Text>
        </Box>
      )
    }
    return (
      <Box paddingX={1} gap={1}>
        <Text color="gray">#{task.id}</Text>
        <Text>{task.subject}</Text>
        <Text color="gray">[{task.status}]</Text>
      </Box>
    )
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
  return (
    <Box paddingX={1} flexDirection="column">
      <Box gap={1}>
        <Text color="green">✓ Created task</Text>
        <Text color="gray">#{task.id}</Text>
      </Box>
      <Box paddingLeft={2}>
        <Text>{task.subject}</Text>
      </Box>
      {task.description && (
        <Box paddingLeft={2}>
          <Text color="gray" dimColor>{task.description}</Text>
        </Box>
      )}
      {task.blockedBy && task.blockedBy.length > 0 && (
        <Box paddingLeft={2}>
          <Text color="yellow">Blocked by: {task.blockedBy.join(', ')}</Text>
        </Box>
      )}
    </Box>
  )
}
