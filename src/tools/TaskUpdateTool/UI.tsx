import React from 'react'
import { Box, Text } from 'ink'
import type { Task } from '../../tasks/types.js'

export function TaskUpdateToolUseUI({ input }: { input: { id: number; status?: string } }) {
  return (
    <Box>
      <Text color="cyan" bold>task_update </Text>
      <Text color="gray">#{input.id}</Text>
      {input.status && <Text color="gray"> → {input.status}</Text>}
    </Box>
  )
}

export function TaskUpdateToolResultUI({ result }: { result: string }) {
  if (result.startsWith('ERROR:')) {
    return <Box paddingX={1}><Text color="red">{result}</Text></Box>
  }
  try {
    const task = JSON.parse(result) as Task
    return (
      <Box paddingX={1} gap={1}>
        <Text color="gray">#{task.id}</Text>
        <Text>{task.subject}</Text>
        <Text color="gray">[{task.status}]</Text>
        {task.owner && <Text color="gray">@{task.owner}</Text>}
      </Box>
    )
  } catch {
    return <Box paddingX={1}><Text color="gray">{result}</Text></Box>
  }
}
