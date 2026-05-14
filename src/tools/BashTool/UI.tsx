import React from 'react'
import { Box, Text } from 'ink'

export function BashToolUseUI({ input }: { input: { command: string } }) {
  return (
    <Box>
      <Text color="cyan" bold>
        ${' '}
      </Text>
      <Text>{input.command}</Text>
    </Box>
  )
}

export function BashToolResultUI({
  result,
  stdout,
  stderr,
  exitCode,
}: {
  result?: string
  stdout?: string
  stderr?: string
  exitCode?: number
}) {
  // 如果传入了结构化数据，使用增强渲染
  if (stdout !== undefined || stderr !== undefined) {
    return (
      <Box flexDirection="column">
        {exitCode !== undefined && exitCode !== 0 && (
          <Text color="red" bold>
            Exit code: {exitCode}
          </Text>
        )}
        {stdout && (
          <Text wrap="wrap" color="green">
            {stdout.length > 500 ? stdout.slice(0, 500) + '…' : stdout}
          </Text>
        )}
        {stderr && (
          <Text wrap="wrap" color="red">
            {stderr.length > 500 ? stderr.slice(0, 500) + '…' : stderr}
          </Text>
        )}
        {!stdout && !stderr && (
          <Text dimColor>(no output)</Text>
        )}
      </Box>
    )
  }

  // Fallback: 使用旧的字符串渲染
  const display = result && result.length > 500 ? result.slice(0, 500) + '…' : result
  return <Text wrap="wrap">{display}</Text>
}
