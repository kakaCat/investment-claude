import React from 'react'
import { Box, Text } from 'ink'

export function ReadToolUseUI({ input }: { input: { path: string } }) {
  return (
    <Box gap={1}>
      <Text backgroundColor="gray" color="black"> IN  </Text>
      <Text color="gray">{input.path}</Text>
    </Box>
  )
}

export function ReadToolResultUI({
  result,
  content,
  path,
  size,
  lines,
  truncated,
  error,
}: {
  result?: string
  content?: string
  path?: string
  size?: number
  lines?: number
  truncated?: boolean
  error?: string
}) {
  // 如果传入了结构化数据，使用增强渲染
  if (content !== undefined || error !== undefined) {
    if (error) {
      return (
        <Box flexDirection="column" paddingLeft={2} gap={0}>
          <Box gap={1}>
            <Text backgroundColor="gray" color="black"> OUT </Text>
            <Text color="red">✗ Error reading file</Text>
          </Box>
          <Box paddingLeft={6}>
            <Text color="red">{error}</Text>
          </Box>
        </Box>
      )
    }

    const preview = content && content.length > 500 ? content.slice(0, 500) + '…' : content

    return (
      <Box flexDirection="column" paddingLeft={2} gap={0}>
        <Box gap={1}>
          <Text backgroundColor="gray" color="black"> OUT </Text>
          <Text color="green">✓ {path}</Text>
          <Text color="gray" dimColor>
            ({size} bytes, {lines} lines)
          </Text>
        </Box>
        {truncated && (
          <Box paddingLeft={6}>
            <Text color="yellow" dimColor>
              [Preview truncated - file is too large]
            </Text>
          </Box>
        )}
        <Box paddingLeft={6}>
          <Text color="gray" wrap="wrap">
            {preview}
          </Text>
        </Box>
      </Box>
    )
  }

  // Fallback: 使用旧的字符串渲染
  const display = result && result.length > 500 ? result.slice(0, 500) + '…' : result
  return (
    <Text color="gray" wrap="wrap">
      {display}
    </Text>
  )
}
