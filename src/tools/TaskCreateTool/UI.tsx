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
        <Box flexDirection="column" paddingLeft={2}>
          <Box>
            <Text backgroundColor="gray" color="black"> IN </Text>
            <Text> task_create</Text>
          </Box>
          <Box marginTop={1}>
            <Text backgroundColor="gray" color="black"> OUT </Text>
            <Text color="red"> Error: {result}</Text>
          </Box>
        </Box>
      )
    }
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Box>
          <Text backgroundColor="gray" color="black"> IN </Text>
          <Text> task_create</Text>
        </Box>
        <Box marginTop={1}>
          <Text backgroundColor="gray" color="black"> OUT </Text>
          <Text color="green"> ✓ Created #{task.id}</Text>
        </Box>
        <Box paddingLeft={5}>
          <Text>{task.subject}</Text>
        </Box>
      </Box>
    )
  }

  // New structured result
  if (!result.success) {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Box>
          <Text backgroundColor="gray" color="black"> IN </Text>
          <Text> task_create</Text>
        </Box>
        <Box marginTop={1}>
          <Text backgroundColor="gray" color="black"> OUT </Text>
          <Text color="red"> Error: {result.error}</Text>
        </Box>
      </Box>
    )
  }

  const task = result.task!
  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Box>
        <Text backgroundColor="gray" color="black"> IN </Text>
        <Text> task_create: {task.subject}</Text>
      </Box>
      <Box marginTop={1}>
        <Text backgroundColor="gray" color="black"> OUT </Text>
        <Text color="green"> ✓ Created task #{task.id}</Text>
      </Box>
      {task.description && (
        <Box paddingLeft={5}>
          <Text color="gray" dimColor>{task.description}</Text>
        </Box>
      )}
      {task.blockedBy && task.blockedBy.length > 0 && (
        <Box paddingLeft={5}>
          <Text color="yellow">Blocked by: {task.blockedBy.join(', ')}</Text>
        </Box>
      )}
    </Box>
  )
}
