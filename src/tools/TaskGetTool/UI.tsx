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

import type { Task } from '../../tasks/types.js'

type TaskGetResult = {
  success: boolean
  task?: Task
  error?: string
  taskId?: number
}

export function TaskGetToolResultUI({ result }: { result: TaskGetResult | string }) {
  // Backward compatibility: handle string result
  if (typeof result === 'string') {
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

  // New structured result
  if (!result.success) {
    return (
      <Box paddingX={1}>
        <Text color="yellow">ERROR: {result.error}</Text>
      </Box>
    )
  }

  const task = result.task!
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box gap={1}>
        <Text color="gray">#{task.id}</Text>
        <Text bold>{task.subject}</Text>
        <Text color="gray">[{task.status}]</Text>
      </Box>
      {task.description && (
        <Box paddingLeft={2}>
          <Text color="gray">{task.description}</Text>
        </Box>
      )}
      {task.owner && (
        <Box paddingLeft={2}>
          <Text color="cyan">Owner: {task.owner}</Text>
        </Box>
      )}
      {task.blockedBy && task.blockedBy.length > 0 && (
        <Box paddingLeft={2}>
          <Text color="yellow">Blocked by: {task.blockedBy.join(', ')}</Text>
        </Box>
      )}
      {task.output && (
        <Box paddingLeft={2}>
          <Text color="gray" dimColor>Output: {task.output.slice(0, 100)}{task.output.length > 100 ? '...' : ''}</Text>
        </Box>
      )}
    </Box>
  )
}
