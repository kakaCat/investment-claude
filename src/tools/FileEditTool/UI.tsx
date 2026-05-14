import React from 'react'
import { Box, Text } from 'ink'

export function FileEditToolUseUI({
  input,
}: {
  input: { path: string; old_string: string; new_string: string }
}) {
  const preview = input.old_string.slice(0, 40).replace(/\n/g, '↵')
  return (
    <Box>
      <Text color="yellow" bold>edit </Text>
      <Text color="gray">{input.path}</Text>
      <Text color="gray"> "{preview}{input.old_string.length > 40 ? '…' : ''}"</Text>
    </Box>
  )
}

export function FileEditToolResultUI({ result }: { result: string }) {
  const isError = result.startsWith('Error')
  return (
    <Box>
      <Text color={isError ? 'red' : 'green'}>{result}</Text>
    </Box>
  )
}

type FileEditResult = {
  success: boolean
  path: string
  oldLength: number
  newLength: number
  error?: string
}

export function FileEditToolResultMessageUI({ output }: { output: FileEditResult }) {
  if (!output.success) {
    return (
      <Box flexDirection="column">
        <Text color="red">✗ Edit failed</Text>
        <Text color="red">{output.error}</Text>
      </Box>
    )
  }

  const delta = output.newLength - output.oldLength
  const deltaText = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '±0'

  return (
    <Box flexDirection="column">
      <Text color="green">✓ Edited {output.path}</Text>
      <Text color="gray">
        Replaced {output.oldLength} chars with {output.newLength} chars ({deltaText})
      </Text>
    </Box>
  )
}
