import React from 'react'
import { Box, Text } from 'ink'

export function FileWriteToolUseUI({ input }: { input: { path: string; content: string } }) {
  const lines = (input.content ?? '').split('\n').length
  return (
    <Box>
      <Text color="yellow" bold>write </Text>
      <Text color="gray">{input.path}</Text>
      <Text color="gray"> ({lines} lines)</Text>
    </Box>
  )
}

export function FileWriteToolResultUI({ result }: { result: string }) {
  const isError = result.startsWith('Error')
  return (
    <Box>
      <Text color={isError ? 'red' : 'green'}>{result}</Text>
    </Box>
  )
}

type FileWriteResult = {
  success: boolean
  path: string
  size: number
  error?: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileWriteToolResultMessageUI({ output }: { output: FileWriteResult }) {
  if (!output.success) {
    return (
      <Box flexDirection="column">
        <Text color="red">✗ Write failed</Text>
        <Text color="red">{output.error}</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Text color="green">✓ Written to {output.path}</Text>
      <Text color="gray">Size: {formatSize(output.size)}</Text>
    </Box>
  )
}
