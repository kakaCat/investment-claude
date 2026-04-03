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

export function TaskCreateToolResultUI({ result }: { result: string }) {
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
