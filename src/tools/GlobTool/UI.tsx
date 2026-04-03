import React from 'react'
import { Box, Text } from 'ink'

export function GlobToolUseUI({ input }: { input: { pattern: string; cwd?: string } }) {
  return (
    <Box>
      <Text color="cyan" bold>glob </Text>
      <Text color="gray">{input.pattern}</Text>
      {input.cwd && <Text color="gray"> in {input.cwd}</Text>}
    </Box>
  )
}

export function GlobToolResultUI({ result }: { result: string }) {
  const lines = result.split('\n').length
  const preview = result.length > 300 ? result.slice(0, 300) + '\n…' : result
  return (
    <Box flexDirection="column">
      <Text color="gray" dimColor>{lines} match(es)</Text>
      <Text color="gray">{preview}</Text>
    </Box>
  )
}
