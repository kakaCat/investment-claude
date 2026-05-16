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
        <Box flexDirection="column" paddingLeft={2}>
          <Box>
            <Text backgroundColor="gray" color="black"> IN </Text>
            <Text> task_get</Text>
          </Box>
          <Box marginTop={1}>
            <Text backgroundColor="gray" color="black"> OUT </Text>
            <Text color="yellow"> {result}</Text>
          </Box>
        </Box>
      )
    }
    try {
      const task = JSON.parse(result)
      return (
        <Box flexDirection="column" paddingLeft={2}>
          <Box>
            <Text backgroundColor="gray" color="black"> IN </Text>
            <Text> task_get #{task.id}</Text>
          </Box>
          <Box marginTop={1}>
            <Text backgroundColor="gray" color="black"> OUT </Text>
            <Text color="green"> ✓ {task.subject}</Text>
          </Box>
          <Box paddingLeft={5} gap={1}>
            <Text color="gray">[{task.status}]</Text>
            {task.owner && <Text color="gray">@{task.owner}</Text>}
          </Box>
          {task.description && (
            <Box paddingLeft={5}>
              <Text color="gray">{task.description}</Text>
            </Box>
          )}
        </Box>
      )
    } catch {
      return (
        <Box flexDirection="column" paddingLeft={2}>
          <Box>
            <Text backgroundColor="gray" color="black"> IN </Text>
            <Text> task_get</Text>
          </Box>
          <Box marginTop={1}>
            <Text backgroundColor="gray" color="black"> OUT </Text>
            <Text color="gray"> {result}</Text>
          </Box>
        </Box>
      )
    }
  }

  // New structured result
  if (!result.success) {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Box>
          <Text backgroundColor="gray" color="black"> IN </Text>
          <Text> task_get #{result.taskId}</Text>
        </Box>
        <Box marginTop={1}>
          <Text backgroundColor="gray" color="black"> OUT </Text>
          <Text color="yellow"> Error: {result.error}</Text>
        </Box>
      </Box>
    )
  }

  const task = result.task!
  const outputPreview = task.output && task.output.length > 100
    ? task.output.slice(0, 100) + '…'
    : task.output

  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Box>
        <Text backgroundColor="gray" color="black"> IN </Text>
        <Text> task_get #{task.id}</Text>
      </Box>
      <Box marginTop={1}>
        <Text backgroundColor="gray" color="black"> OUT </Text>
        <Text color="green"> ✓ {task.subject}</Text>
      </Box>
      <Box paddingLeft={5} gap={1}>
        <Text color="gray">[{task.status}]</Text>
        {task.owner && <Text color="gray">@{task.owner}</Text>}
      </Box>
      {task.description && (
        <Box paddingLeft={5}>
          <Text color="gray">{task.description}</Text>
        </Box>
      )}
      {task.blockedBy && task.blockedBy.length > 0 && (
        <Box paddingLeft={5}>
          <Text color="yellow">Blocked by: {task.blockedBy.join(', ')}</Text>
        </Box>
      )}
      {outputPreview && (
        <Box paddingLeft={5}>
          <Text color="gray" dimColor>Output: {outputPreview}</Text>
        </Box>
      )}
    </Box>
  )
}
