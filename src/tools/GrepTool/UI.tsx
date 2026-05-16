import React from 'react'
import { Box, Text } from 'ink'

export function GrepToolUseUI({
  input,
}: {
  input: { pattern: string; path?: string; glob?: string }
}) {
  return (
    <Box gap={1}>
      <Text backgroundColor="gray" color="black"> IN  </Text>
      <Text color="gray">/{input.pattern}/</Text>
      {input.path && <Text color="gray">in {input.path}</Text>}
      {input.glob && <Text color="gray" dimColor>[{input.glob}]</Text>}
    </Box>
  )
}

type GrepMatch = {
  file: string
  line: number
  content: string
}

export function GrepToolResultUI({
  result,
  matches,
  totalMatches,
  totalFiles,
  pattern,
  truncated,
}: {
  result?: string
  matches?: GrepMatch[]
  totalMatches?: number
  totalFiles?: number
  pattern?: string
  truncated?: boolean
}) {
  // 如果传入了结构化数据，使用增强渲染
  if (matches !== undefined) {
    if (matches.length === 0) {
      return (
        <Box flexDirection="column" paddingLeft={2} gap={0}>
          <Box gap={1}>
            <Text backgroundColor="gray" color="black"> OUT </Text>
            <Text color="yellow">No matches for /{pattern}/</Text>
          </Box>
        </Box>
      )
    }

    const preview = matches.slice(0, 10) // 只显示前 10 条
    const hasMore = matches.length > 10

    return (
      <Box flexDirection="column" paddingLeft={2} gap={0}>
        <Box gap={1}>
          <Text backgroundColor="gray" color="black"> OUT </Text>
          <Text color="green">
            Found {totalMatches} matches in {totalFiles} files
          </Text>
        </Box>
        <Box flexDirection="column" paddingLeft={6}>
          {preview.map((m, i) => (
            <Box key={i}>
              <Text color="cyan">{m.file}:{m.line}</Text>
              <Text>: {m.content}</Text>
            </Box>
          ))}
          {hasMore && (
            <Text color="gray" dimColor>
              ... and {matches.length - 10} more matches
            </Text>
          )}
          {truncated && (
            <Text color="yellow">
              [Results limited to first 100 matches]
            </Text>
          )}
        </Box>
      </Box>
    )
  }

  // Fallback: 使用旧的字符串渲染
  const preview = result && result.length > 500 ? result.slice(0, 500) + '…' : result
  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Text color="gray">{preview}</Text>
    </Box>
  )
}
