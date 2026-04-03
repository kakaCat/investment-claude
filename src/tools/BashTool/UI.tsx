import React from 'react'
import { Box, Text } from 'ink'

export function BashToolUseUI({ input }: { input: { command: string } }) {
  return (
    <Box>
      <Text color="cyan" bold>
        ${' '}
      </Text>
      <Text>{input.command}</Text>
    </Box>
  )
}

export function BashToolResultUI({ result }: { result: string }) {
  const display = result.length > 500 ? result.slice(0, 500) + '…' : result
  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Text>{display}</Text>
    </Box>
  )
}
