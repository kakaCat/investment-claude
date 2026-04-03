// src/tools/AgentTool/UI.tsx

import React from 'react'
import { Box, Text } from 'ink'

export function AgentToolUseUI({
  input,
}: {
  input: { description: string; subagent_type?: string }
}) {
  return (
    <Box>
      <Text color="magenta" bold>
        agent({input.subagent_type ?? 'general-purpose'}){' '}
      </Text>
      <Text color="gray">{input.description}</Text>
    </Box>
  )
}

export function AgentToolResultUI({ result }: { result: string }) {
  const isError = result.startsWith('ERROR:')
  const display = result.length > 500 ? result.slice(0, 500) + '…' : result
  return (
    <Box borderStyle="single" borderColor={isError ? 'red' : 'gray'} paddingX={1}>
      <Text color={isError ? 'red' : 'gray'}>{display}</Text>
    </Box>
  )
}
