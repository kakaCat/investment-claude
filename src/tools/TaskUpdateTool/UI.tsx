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

type TaskUpdateResult = {
  success: boolean
  task?: Task
  changes?: Partial<Omit<Task, 'id'>>
  error?: string
  taskId?: number
}

export function TaskUpdateToolResultUI({ result }: { result: TaskUpdateResult | string }) {
  // Backward compatibility: handle string result
  if (typeof result === 'string') {
    if (result.startsWith('ERROR:')) {
      return (
        <Box flexDirection="column" paddingLeft={2}>
          <Box>
            <Text backgroundColor="gray" color="black"> IN </Text>
            <Text> task_update</Text>
          </Box>
          <Box marginTop={1}>
            <Text backgroundColor="gray" color="black"> OUT </Text>
            <Text color="red"> {result}</Text>
          </Box>
        </Box>
      )
    }
    try {
      const task = JSON.parse(result) as Task
      return (
        <Box flexDirection="column" paddingLeft={2}>
          <Box>
            <Text backgroundColor="gray" color="black"> IN </Text>
            <Text> task_update #{task.id}</Text>
          </Box>
          <Box marginTop={1}>
            <Text backgroundColor="gray" color="black"> OUT </Text>
            <Text color="green"> ✓ Updated</Text>
          </Box>
          <Box paddingLeft={5} gap={1}>
            <Text>{task.subject}</Text>
            <Text color="gray">[{task.status}]</Text>
            {task.owner && <Text color="gray">@{task.owner}</Text>}
          </Box>
        </Box>
      )
    } catch {
      return (
        <Box flexDirection="column" paddingLeft={2}>
          <Box>
            <Text backgroundColor="gray" color="black"> IN </Text>
            <Text> task_update</Text>
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
          <Text> task_update #{result.taskId}</Text>
        </Box>
        <Box marginTop={1}>
          <Text backgroundColor="gray" color="black"> OUT </Text>
          <Text color="red"> Error: {result.error}</Text>
        </Box>
      </Box>
    )
  }

  const task = result.task!
  const changes = result.changes || {}
  const changedFields = Object.keys(changes).filter(k => k !== 'updatedAt')

  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Box>
        <Text backgroundColor="gray" color="black"> IN </Text>
        <Text> task_update #{task.id}</Text>
      </Box>
      <Box marginTop={1}>
        <Text backgroundColor="gray" color="black"> OUT </Text>
        <Text color="green"> ✓ Updated</Text>
      </Box>
      <Box paddingLeft={5}>
        <Text>{task.subject}</Text>
      </Box>
      {changedFields.length > 0 && (
        <Box paddingLeft={5} gap={1}>
          <Text color="yellow">Changed:</Text>
          <Text color="gray">{changedFields.join(', ')}</Text>
        </Box>
      )}
      <Box paddingLeft={5} gap={1}>
        <Text color="gray">[{task.status}]</Text>
        {task.owner && <Text color="gray">@{task.owner}</Text>}
      </Box>
    </Box>
  )
}
