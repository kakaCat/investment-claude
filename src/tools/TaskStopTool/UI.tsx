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

export function TaskStopToolResultUI({ result }: { result: string }) {
  const isError = result.startsWith('ERROR:')
  return (
    <Box paddingX={1}>
      <Text color={isError ? 'yellow' : 'green'}>{result}</Text>
    </Box>
  )
}
