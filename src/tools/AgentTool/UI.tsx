// src/tools/AgentTool/UI.tsx

import React from 'react'
import { Box, Text } from 'ink'

export function AgentToolUseUI({
  input,
}: {
  input: { description: string; subagent_type?: string; prompt?: string }
}) {
  return (
    <Box flexDirection="column" gap={0}>
      {/* 描述行 */}
      <Box>
        <Text color="gray">{input.description}</Text>
      </Box>

      {/* IN 标签 + prompt */}
      {input.prompt && (
        <Box gap={1} marginTop={1}>
          <Text backgroundColor="gray" color="black"> IN  </Text>
          <Text color="gray">
            {input.prompt.length > 200 ? input.prompt.slice(0, 200) + '…' : input.prompt}
          </Text>
        </Box>
      )}
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
      <Box flexDirection="column" paddingLeft={2} gap={0}>
        <Box gap={1}>
          <Text backgroundColor="gray" color="black"> OUT </Text>
          <Text color="red">✗ Agent failed: {output.agentType}</Text>
        </Box>
        {output.error && (
          <Box paddingLeft={6}>
            <Text color="red">{output.error}</Text>
          </Box>
        )}
      </Box>
    )
  }

  const preview = output.output.length > 500 ? output.output.slice(0, 500) + '…' : output.output
  const lines = output.output.split('\n').length

  return (
    <Box flexDirection="column" paddingLeft={2} gap={0}>
      <Box gap={1}>
        <Text backgroundColor="gray" color="black"> OUT </Text>
        <Text color="green">✓ Agent completed: {output.agentType}</Text>
      </Box>
      <Box paddingLeft={6} flexDirection="column">
        <Text color="gray">Output: {lines} line{lines !== 1 ? 's' : ''}, {output.output.length} chars</Text>
        <Text wrap="wrap">{preview}</Text>
      </Box>
    </Box>
  )
}
