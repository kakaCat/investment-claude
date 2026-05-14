import React from 'react'
import { Box, Text } from 'ink'

export function EnterPlanModeToolUseUI(_: { input: Record<string, never> }) {
  return (
    <Box>
      <Text color="blue" bold>entering plan mode</Text>
    </Box>
  )
}

type EnterPlanModeResult = {
  success: boolean
  message: string
}

export function EnterPlanModeToolResultUI({ result }: { result: string | EnterPlanModeResult }) {
  // Backward compatibility: handle string result
  if (typeof result === 'string') {
    return (
      <Box>
        <Text color="blue">{result}</Text>
      </Box>
    )
  }

  // New structured result
  return (
    <Box flexDirection="column">
      <Box>
        <Text color={result.success ? 'green' : 'red'} bold>
          {result.success ? '✓' : '✗'}
        </Text>
        <Text color={result.success ? 'blue' : 'red'}> {result.message}</Text>
      </Box>
    </Box>
  )
}
