import React from 'react'
import { Box, Text } from 'ink'

export function SendUserFileToolUseUI({ input }: { input: { path: string } }) {
  return (
    <Box>
      <Text color="green" bold>file </Text>
      <Text color="gray">{input.path}</Text>
    </Box>
  )
}

export function SendUserFileToolResultUI({ result }: { result: string }) {
  const isError = result.startsWith('Error')
  return (
    <Box>
      <Text color={isError ? 'red' : 'green'}>{result}</Text>
    </Box>
  )
}
