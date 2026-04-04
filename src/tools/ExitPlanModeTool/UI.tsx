import React from 'react'
import { Box, Text } from 'ink'

export function ExitPlanModeToolUseUI({ input: _input }: { input: { plan: string } }) {
  return (
    <Box>
      <Text color="gray">presenting plan for review…</Text>
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
