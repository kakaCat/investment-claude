import React from 'react'
import { Box, Text } from 'ink'
import type { MemoryFileMeta } from '../../memdir/Memory.js'

type MemorySearchResult = {
  queryType: 'types' | 'type' | 'select' | 'search'
  content: string
  matches?: MemoryFileMeta[]
  totalMatches?: number
}

export function MemorySearchToolResultMessageUI({ output }: { output: MemorySearchResult }) {
  if (output.queryType === 'types') {
    return (
      <Box flexDirection="column">
        <Text color="cyan">📚 Memory Types</Text>
        <Box marginTop={1}>
          <Text>{output.content}</Text>
        </Box>
      </Box>
    )
  }

  if (output.queryType === 'type') {
    if (output.totalMatches === 0) {
      return <Text color="yellow">No memories found for this type</Text>
    }

    return (
      <Box flexDirection="column">
        <Text color="cyan">
          Found {output.totalMatches} memor{output.totalMatches !== 1 ? 'ies' : 'y'}
        </Text>
        <Box marginTop={1}>
          <Text>{output.content.slice(0, 1000)}{output.content.length > 1000 ? '...' : ''}</Text>
        </Box>
      </Box>
    )
  }

  if (output.queryType === 'select') {
    if (!output.matches || output.matches.length === 0) {
      return <Text color="yellow">Memory file not found</Text>
    }

    const meta = output.matches[0]
    return (
      <Box flexDirection="column">
        <Text color="green">✓ Memory: {meta.name}</Text>
        <Text color="gray">Type: {meta.type}</Text>
        <Box marginTop={1}>
          <Text>{output.content.slice(0, 1000)}{output.content.length > 1000 ? '...' : ''}</Text>
        </Box>
      </Box>
    )
  }

  // search
  if (output.totalMatches === 0) {
    return <Text color="yellow">No matching memories found</Text>
  }

  return (
    <Box flexDirection="column">
      <Text color="cyan">
        🔍 Found {output.totalMatches} matching memor{output.totalMatches !== 1 ? 'ies' : 'y'}
      </Text>
      {output.matches && (
        <Box flexDirection="column" marginTop={1}>
          {output.matches.map((meta, i) => (
            <Text key={i} color="gray">
              • {meta.name} [{meta.type}]
            </Text>
          ))}
        </Box>
      )}
      <Box marginTop={1}>
        <Text>{output.content.slice(0, 800)}{output.content.length > 800 ? '...' : ''}</Text>
      </Box>
    </Box>
  )
}
