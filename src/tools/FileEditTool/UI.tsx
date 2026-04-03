import React from 'react'
import { Box, Text } from 'ink'

export function FileEditToolUseUI({
  input,
}: {
  input: { path: string; old_string: string; new_string: string }
}) {
  const preview = input.old_string.slice(0, 40).replace(/\n/g, '↵')
  return (
    <Box>
      <Text color="yellow" bold>edit </Text>
      <Text color="gray">{input.path}</Text>
      <Text color="gray"> "{preview}{input.old_string.length > 40 ? '…' : ''}"</Text>
    </Box>
  )
}

export function FileEditToolResultUI({ result }: { result: string }) {
  const isError = result.startsWith('Error')
  return (
    <Box>
      <Text color={isError ? 'red' : 'green'}>{result}</Text>
    </Box>
  )
}
