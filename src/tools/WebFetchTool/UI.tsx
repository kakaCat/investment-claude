import React from 'react'
import { Text, Box } from 'ink'

export function WebFetchToolUseUI({
  input,
}: {
  input: { url: string; prompt: string }
}) {
  return (
    <Box flexDirection="column">
      <Text bold>🌐 Fetching: <Text color="cyan">{input.url}</Text></Text>
      <Text dimColor>  "{input.prompt}"</Text>
    </Box>
  )
}

export function WebFetchToolResultUI({ result }: { result: string }) {
  const isError = result.startsWith('Error:')
  return (
    <Box flexDirection="column">
      <Text color={isError ? 'red' : 'green'}>
        {isError ? '✗' : '✓'} web_fetch result
      </Text>
      <Text>{result}</Text>
    </Box>
  )
}

type WebFetchResult = {
  success: boolean
  url: string
  content: string
  contentLength: number
  truncated: boolean
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
      <Box flexDirection="column">
        <Text color="red">✗ Fetch failed</Text>
        <Text color="red">{output.error}</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Text color="green">✓ Fetched {output.url}</Text>
      <Text color="gray">
        Content: {formatSize(output.contentLength)}
        {output.truncated && <Text color="yellow"> (truncated)</Text>}
      </Text>
      <Box marginTop={1}>
        <Text>{output.content.slice(0, 500)}{output.content.length > 500 ? '...' : ''}</Text>
      </Box>
    </Box>
  )
}
