import React from 'react'
import { Box, Text } from 'ink'

export function ExitPlanModeToolUseUI({ input: _input }: { input: { plan: string } }) {
  return (
    <Box>
      <Text color="gray">presenting plan for review…</Text>
    </Box>
  )
}

type ExitPlanModeResult = {
  success: boolean
  status: 'approved' | 'rejected' | 'unavailable'
  message: string
  feedback?: string
  planLength: number
}

export function ExitPlanModeToolResultUI({ result }: { result: string | ExitPlanModeResult }) {
  // Backward compatibility: handle string result
  if (typeof result === 'string') {
    const approved = result.startsWith('Plan approved')
    return (
      <Box>
        <Text color={approved ? 'green' : 'red'}>{result}</Text>
      </Box>
    )
  }

  // New structured result
  const statusColor = result.status === 'approved' ? 'green' : result.status === 'rejected' ? 'red' : 'yellow'
  const statusIcon = result.status === 'approved' ? '✓' : result.status === 'rejected' ? '✗' : '⚠'

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={statusColor} bold>{statusIcon}</Text>
        <Text color={statusColor}> {result.message}</Text>
      </Box>
      {result.feedback && (
        <Box paddingLeft={2}>
          <Text color="yellow">Feedback: {result.feedback}</Text>
        </Box>
      )}
      <Box paddingLeft={2}>
        <Text color="gray">Plan length: {result.planLength} chars</Text>
      </Box>
    </Box>
  )
}
