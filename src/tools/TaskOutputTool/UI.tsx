import React from 'react'
import { Box, Text } from 'ink'

export function TaskOutputToolUseUI({ input }: { input: { id: number } }) {
  return (
    <Box>
      <Text color="cyan" bold>task_output </Text>
      <Text color="gray">#{input.id}</Text>
    </Box>
  )
}

type TaskOutputResult = {
  success: boolean
  taskId: number
  output?: string
  taskSubject?: string
  error?: string
}

export function TaskOutputToolResultUI({ result }: { result: TaskOutputResult | string }) {
  // Backward compatibility: handle string result
  if (typeof result === 'string') {
    const isError = result.startsWith('ERROR:')
    return (
      <Box paddingX={1}>
        <Text color={isError ? 'yellow' : 'gray'}>{result}</Text>
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
    <Box paddingX={1} flexDirection="column">
      <Box gap={1}>
        <Text color="gray">Task #{result.taskId}</Text>
        {result.taskSubject && <Text color="gray">({result.taskSubject})</Text>}
      </Box>
      <Box paddingLeft={2}>
        <Text>{result.output}</Text>
      </Box>
    </Box>
  )
}
