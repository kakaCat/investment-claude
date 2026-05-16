import React from 'react'
import { Box, Text } from 'ink'

export function GlobToolUseUI({ input }: { input: { pattern: string; cwd?: string } }) {
  return (
    <Box gap={1}>
      <Text backgroundColor="gray" color="black"> IN  </Text>
      <Text color="gray">{input.pattern}</Text>
      {input.cwd && <Text color="gray" dimColor>in {input.cwd}</Text>}
    </Box>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

export function GlobToolResultUI({
  result,
  files,
  totalFiles,
  totalSize,
  pattern,
  error,
}: {
  result?: string
  files?: string[]
  totalFiles?: number
  totalSize?: number
  pattern?: string
  error?: string
}) {
  // 如果传入了结构化数据，使用增强渲染
  if (files !== undefined || error !== undefined) {
    if (error) {
      return (
        <Box flexDirection="column" paddingLeft={2} gap={0}>
          <Box gap={1}>
            <Text backgroundColor="gray" color="black"> OUT </Text>
            <Text color="red">✗ Error</Text>
          </Box>
          <Box paddingLeft={6}>
            <Text color="red">{error}</Text>
          </Box>
        </Box>
      )
    }

    if (!files || totalFiles === 0) {
      return (
        <Box flexDirection="column" paddingLeft={2} gap={0}>
          <Box gap={1}>
            <Text backgroundColor="gray" color="black"> OUT </Text>
            <Text color="yellow">No files matched "{pattern}"</Text>
          </Box>
        </Box>
      )
    }

    const preview = files.slice(0, 20) // 只显示前 20 个文件
    const hasMore = files.length > 20

    return (
      <Box flexDirection="column" paddingLeft={2} gap={0}>
        <Box gap={1}>
          <Text backgroundColor="gray" color="black"> OUT </Text>
          <Text color="green">
            Found {totalFiles ?? 0} file{(totalFiles ?? 0) > 1 ? 's' : ''} ({formatBytes(totalSize ?? 0)})
          </Text>
        </Box>
        <Box flexDirection="column" paddingLeft={6}>
          {preview.map((file, i) => (
            <Text key={i} color="gray">
              {file}
            </Text>
          ))}
          {hasMore && (
            <Text color="gray" dimColor>
              ... and {files.length - 20} more files
            </Text>
          )}
        </Box>
      </Box>
    )
  }

  // Fallback: 使用旧的字符串渲染
  const safe = result ?? ''
  const lines = safe.split('\n').length
  const preview = safe.length > 300 ? safe.slice(0, 300) + '\n…' : safe
  return (
    <Box flexDirection="column">
      <Text color="gray" dimColor>
        {lines} match(es)
      </Text>
      <Text color="gray">{preview}</Text>
    </Box>
  )
}
