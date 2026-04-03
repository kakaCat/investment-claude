import React from 'react'
import { Box, Text } from 'ink'

export function TaskGetToolUseUI({ input }: { input: { id: number } }) {
  return (
    <Box>
      <Text color="cyan" bold>task_get </Text>
      <Text color="gray">#{input.id}</Text>
    </Box>
  )
}

export function TaskGetToolResultUI({ result }: { result: string }) {
  if (result.startsWith('ERROR:')) {
    return (
      <Box paddingX={1}>
        <Text color="yellow">{result}</Text>
      </Box>
    )
  }
  try {
    const task = JSON.parse(result)
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box gap={1}>
          <Text color="gray">#{task.id}</Text>
          <Text bold>{task.subject}</Text>
          <Text color="gray">[{task.status}]</Text>
        </Box>
        {task.description && <Text color="gray">{task.description}</Text>}
        {task.owner && <Text color="gray">Owner: {task.owner}</Text>}
      </Box>
    )
  } catch {
    return <Box paddingX={1}><Text color="gray">{result}</Text></Box>
  }
}
