import React from 'react'
import { Box, Text } from 'ink'

export function FileEditToolUseUI({
  input,
}: {
  input: { path: string; old_string: string; new_string: string }
}) {
  const oldLines = input.old_string.split('\n')
  const newLines = input.new_string.split('\n')

  // 限制显示行数
  const maxLines = 10
  const showOldLines = oldLines.slice(0, maxLines)
  const showNewLines = newLines.slice(0, maxLines)
  const hasMoreOld = oldLines.length > maxLines
  const hasMoreNew = newLines.length > maxLines

  return (
    <Box flexDirection="column" gap={0}>
      <Box gap={1}>
        <Text backgroundColor="gray" color="black"> IN  </Text>
        <Text color="gray">{input.path}</Text>
      </Box>

      {/* 修改前 */}
      <Box paddingLeft={6} marginTop={1}>
        <Text color="red" dimColor>━ Before:</Text>
      </Box>
      {showOldLines.map((line, i) => (
        <Box key={`old-${i}`} paddingLeft={6}>
          <Text color="red" dimColor>- </Text>
          <Text color="red" dimColor>{line || ' '}</Text>
        </Box>
      ))}
      {hasMoreOld && (
        <Box paddingLeft={6}>
          <Text color="red" dimColor>  ... ({oldLines.length - maxLines} more lines)</Text>
        </Box>
      )}

      {/* 修改后 */}
      <Box paddingLeft={6} marginTop={1}>
        <Text color="green" dimColor>━ After:</Text>
      </Box>
      {showNewLines.map((line, i) => (
        <Box key={`new-${i}`} paddingLeft={6}>
          <Text color="green" dimColor>+ </Text>
          <Text color="green" dimColor>{line || ' '}</Text>
        </Box>
      ))}
      {hasMoreNew && (
        <Box paddingLeft={6}>
          <Text color="green" dimColor>  ... ({newLines.length - maxLines} more lines)</Text>
        </Box>
      )}
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
      <Box flexDirection="column" paddingLeft={2} gap={0}>
        <Box gap={1}>
          <Text backgroundColor="gray" color="black"> OUT </Text>
          <Text color="red">✗ Edit failed</Text>
        </Box>
        <Box paddingLeft={6}>
          <Text color="red">{output.error}</Text>
        </Box>
      </Box>
    )
  }

  const delta = output.newLength - output.oldLength
  const deltaText = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '±0'

  return (
    <Box flexDirection="column" paddingLeft={2} gap={0}>
      <Box gap={1}>
        <Text backgroundColor="gray" color="black"> OUT </Text>
        <Text color="green">✓ Edited {output.path}</Text>
      </Box>
      <Box paddingLeft={6}>
        <Text color="gray">
          Replaced {output.oldLength} chars with {output.newLength} chars ({deltaText})
        </Text>
      </Box>
    </Box>
  )
}
