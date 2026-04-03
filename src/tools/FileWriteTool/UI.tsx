import React from 'react'
import { Box, Text } from 'ink'

export function FileWriteToolUseUI({ input }: { input: { path: string; content: string } }) {
  const lines = input.content.split('\n').length
  return (
    <Box>
      <Text color="yellow" bold>write </Text>
      <Text color="gray">{input.path}</Text>
      <Text color="gray"> ({lines} lines)</Text>
    </Box>
  )
}

export function FileWriteToolResultUI({ result }: { result: string }) {
  const isError = result.startsWith('Error')
  return (
    <Box>
      <Text color={isError ? 'red' : 'green'}>{result}</Text>
    </Box>
  )
}
