import React from 'react'
import { Box, Text } from 'ink'

export function ToolSearchUseUI({
  input,
}: {
  input: { query: string; max_results?: number }
}) {
  return (
    <Box>
      <Text color="cyan" bold>
        tool_search{' '}
      </Text>
      <Text color="gray">"{input.query}"</Text>
    </Box>
  )
}

export function ToolSearchResultUI({ result }: { result: string }) {
  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Text color="gray">{result}</Text>
    </Box>
  )
}
