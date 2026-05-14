import React from 'react'
import { Box, Text } from 'ink'

export function TaskStopToolUseUI({ input }: { input: { id: number } }) {
  return (
    <Box>
      <Text color="cyan" bold>task_stop </Text>
      <Text color="gray">#{input.id}</Text>
    </Box>
  )
}

type TaskStopResult = {
  success: boolean
  taskId: number
  message?: string
  error?: string
  currentStatus?: string
}

export function TaskStopToolResultUI({ result }: { result: TaskStopResult | string }) {
  // Backward compatibility: handle string result
  if (typeof result === 'string') {
    const isError = result.startsWith('ERROR:')
    return (
      <Box paddingX={1}>
        <Text color={isError ? 'yellow' : 'green'}>{result}</Text>
      </Box>
    )
  }

  // New structured result
  if (!result.success) {
    return (
      <Box paddingX={1}>
        <Text color="yellow">ERROR: {result.error}</Text>
      </Box>
    )
  }

  return (
    <Box paddingX={1} gap={1}>
      <Text color="green">✓</Text>
      <Text>Task #{result.taskId} stopped</Text>
    </Box>
  )
}
