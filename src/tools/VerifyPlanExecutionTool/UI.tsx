import React from 'react'
import { Box, Text } from 'ink'

export function VerifyPlanExecutionToolUseUI({ input }: { input: { summary: string } }) {
  return (
    <Box flexDirection="column">
      <Text color="blue" bold>verify execution </Text>
      <Text color="gray">{input.summary.slice(0, 100)}{input.summary.length > 100 ? '…' : ''}</Text>
    </Box>
  )
}

export function VerifyPlanExecutionToolResultUI({ result }: { result: string }) {
  const verified = result.startsWith('Execution verified')
  return (
    <Box>
      <Text color={verified ? 'green' : 'red'}>{result}</Text>
    </Box>
  )
}
