import React from 'react'
import { Box, Text } from 'ink'

export function ExitPlanModeToolUseUI({ input }: { input: { plan: string } }) {
  return (
    <Box flexDirection="column">
      <Text color="blue" bold>exit plan mode </Text>
      <Text color="gray">{input.plan.slice(0, 100)}{input.plan.length > 100 ? '…' : ''}</Text>
    </Box>
  )
}

export function ExitPlanModeToolResultUI({ result }: { result: string }) {
  const approved = result.startsWith('Plan approved')
  return (
    <Box>
      <Text color={approved ? 'green' : 'red'}>{result}</Text>
    </Box>
  )
}
