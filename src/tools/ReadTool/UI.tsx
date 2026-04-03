import React from 'react'
import { Box, Text } from 'ink'

export function ReadToolUseUI({ input }: { input: { path: string } }) {
  return (
    <Box>
      <Text color="cyan" bold>
        read{' '}
      </Text>
      <Text color="gray">{input.path}</Text>
    </Box>
  )
}

export function ReadToolResultUI({ result }: { result: string }) {
  const display = result.length > 500 ? result.slice(0, 500) + '…' : result
  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Text color="gray">{display}</Text>
    </Box>
  )
}
