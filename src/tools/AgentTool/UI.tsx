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
  return <Text color={isError ? 'red' : 'gray'} wrap="wrap">{display}</Text>
}

type AgentResult = {
  success: boolean
  output: string
  agentType: string
  error?: string
}

export function AgentToolResultMessageUI({ output }: { output: AgentResult }) {
  if (!output.success) {
    return (
      <Box flexDirection="column">
        <Text color="red">✗ Agent failed: {output.agentType}</Text>
        <Text color="red">{output.error}</Text>
      </Box>
    )
  }

  const preview = output.output.length > 500 ? output.output.slice(0, 500) + '…' : output.output
  const lines = output.output.split('\n').length

  return (
    <Box flexDirection="column">
      <Text color="green">✓ Agent completed: {output.agentType}</Text>
      <Text color="gray">Output: {lines} line{lines !== 1 ? 's' : ''}, {output.output.length} chars</Text>
      <Box marginTop={1}>
        <Text wrap="wrap">{preview}</Text>
      </Box>
    </Box>
  )
}
