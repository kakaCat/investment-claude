import React from 'react'
import { Text, Box } from 'ink'

export function WebFetchToolUseUI({
  input,
}: {
  input: { url: string; prompt: string }
}) {
  return (
    <Box flexDirection="column">
      <Text bold>🌐 Fetching: <Text color="cyan">{input.url}</Text></Text>
      <Text dimColor>  "{input.prompt}"</Text>
    </Box>
  )
}

export function WebFetchToolResultUI({ result }: { result: string }) {
  const isError = result.startsWith('Error:')
  return (
    <Box flexDirection="column">
      <Text color={isError ? 'red' : 'green'}>
        {isError ? '✗' : '✓'} web_fetch result
      </Text>
      <Text>{result}</Text>
    </Box>
  )
}
