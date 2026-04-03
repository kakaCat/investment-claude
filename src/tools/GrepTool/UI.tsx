import React from 'react'
import { Box, Text } from 'ink'

export function GrepToolUseUI({
  input,
}: {
  input: { pattern: string; path?: string; glob?: string }
}) {
  return (
    <Box>
      <Text color="cyan" bold>grep </Text>
      <Text color="gray">/{input.pattern}/</Text>
      {input.path && <Text color="gray"> in {input.path}</Text>}
      {input.glob && <Text color="gray"> [{input.glob}]</Text>}
    </Box>
  )
}

export function GrepToolResultUI({ result }: { result: string }) {
  const preview = result.length > 500 ? result.slice(0, 500) + '…' : result
  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Text color="gray">{preview}</Text>
    </Box>
  )
}
