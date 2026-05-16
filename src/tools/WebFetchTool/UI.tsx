import React from 'react'
import { Text, Box } from 'ink'

export function WebFetchToolUseUI({
  input,
}: {
  input: { url: string; prompt: string }
}) {
  return (
    <Box flexDirection="column" gap={0}>
      <Box gap={1}>
        <Text backgroundColor="gray" color="black"> IN  </Text>
        <Text color="cyan">{input.url}</Text>
      </Box>
      <Box paddingLeft={6}>
        <Text color="gray" dimColor>"{input.prompt}"</Text>
      </Box>
    </Box>
  )
}

export function WebFetchToolResultUI({ result }: { result: string }) {
  const isError = result.startsWith('Error:')
  const MAX_DISPLAY_LENGTH = 500
  const truncated = result.length > MAX_DISPLAY_LENGTH
  const displayText = truncated ? result.slice(0, MAX_DISPLAY_LENGTH) + '...' : result

  return (
    <Box flexDirection="column">
      <Text color={isError ? 'red' : 'green'}>
        {isError ? '✗' : '✓'} web_fetch result
        {truncated && <Text color="gray"> ({result.length} chars, truncated)</Text>}
      </Text>
      <Text>{displayText}</Text>
    </Box>
  )
}

type WebFetchResult = {
  success: boolean
  url: string
  content: string
  contentLength: number
  truncated: boolean
  savedPath?: string
  error?: string
}

function formatSize(chars: number): string {
  if (chars < 1024) return `${chars} chars`
  if (chars < 1024 * 1024) return `${(chars / 1024).toFixed(1)}K chars`
  return `${(chars / (1024 * 1024)).toFixed(1)}M chars`
}

export function WebFetchToolResultMessageUI({ output }: { output: WebFetchResult }) {
  if (!output.success) {
    return (
      <Box flexDirection="column" paddingLeft={2} gap={0}>
        <Box gap={1}>
          <Text backgroundColor="gray" color="black"> OUT </Text>
          <Text color="red">✗ Fetch failed</Text>
        </Box>
        <Box paddingLeft={6}>
          <Text color="red">{output.error}</Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" paddingLeft={2} gap={0}>
      <Box gap={1}>
        <Text backgroundColor="gray" color="black"> OUT </Text>
        <Text color="green">✓ Fetched {output.url}</Text>
      </Box>
      <Box paddingLeft={6} flexDirection="column">
        <Text color="gray">
          Content: {formatSize(output.contentLength)}
          {output.truncated && <Text color="yellow"> (truncated)</Text>}
        </Text>
        {output.savedPath && (
          <Text color="cyan">Saved to: {output.savedPath}</Text>
        )}
        <Text color="gray">Preview (first 500 chars):</Text>
        <Text>{output.content.slice(0, 500)}{output.content.length > 500 ? '...' : ''}</Text>
        {output.savedPath && (
          <Text color="gray" dimColor>Use Read tool to view full content</Text>
        )}
      </Box>
    </Box>
  )
}
