import React from 'react'
import { Box, Text } from 'ink'

export function EnterPlanModeToolUseUI(_: { input: Record<string, never> }) {
  return (
    <Box>
      <Text color="blue" bold>entering plan mode</Text>
    </Box>
  )
}

export function EnterPlanModeToolResultUI({ result }: { result: string }) {
  return (
    <Box>
      <Text color="blue">{result}</Text>
    </Box>
  )
}
