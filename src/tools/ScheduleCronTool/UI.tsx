import React from 'react'
import { Box, Text } from 'ink'

export function CronCreateToolUseUI({ input }: { input: { cron: string; prompt: string; recurring?: boolean } }) {
  return (
    <Box>
      <Text color="cyan" bold>cron_create </Text>
      <Text color="gray">{input.cron}</Text>
      {input.recurring === false && <Text color="gray"> (one-shot)</Text>}
    </Box>
  )
}

export function CronCreateToolResultUI({ result }: { result: string }) {
  const isError = result.startsWith('ERROR:')
  return (
    <Box paddingX={1}>
      <Text color={isError ? 'red' : 'green'}>{result}</Text>
    </Box>
  )
}

export function CronDeleteToolUseUI({ input }: { input: { id: string } }) {
  return (
    <Box>
      <Text color="cyan" bold>cron_delete </Text>
      <Text color="gray">{input.id}</Text>
    </Box>
  )
}

export function CronDeleteToolResultUI({ result }: { result: string }) {
  const isError = result.startsWith('ERROR:')
  return (
    <Box paddingX={1}>
      <Text color={isError ? 'red' : 'green'}>{result}</Text>
    </Box>
  )
}

export function CronListToolUseUI() {
  return (
    <Box>
      <Text color="cyan" bold>cron_list</Text>
    </Box>
  )
}

export function CronListToolResultUI({ result }: { result: string }) {
  return (
    <Box paddingX={1}>
      <Text color="gray">{result}</Text>
    </Box>
  )
}
