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

export function TaskOutputToolResultUI({ result }: { result: string }) {
  const isError = result.startsWith('ERROR:')
  return (
    <Box paddingX={1}>
      <Text color={isError ? 'yellow' : 'gray'}>{result}</Text>
    </Box>
  )
}
