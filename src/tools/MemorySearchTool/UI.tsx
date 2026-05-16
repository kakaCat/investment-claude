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
    const preview = output.content.length > 800 ? output.content.slice(0, 800) + '…' : output.content
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Box>
          <Text backgroundColor="gray" color="black"> IN </Text>
          <Text> memory_search types</Text>
        </Box>
        <Box marginTop={1}>
          <Text backgroundColor="gray" color="black"> OUT </Text>
          <Text color="green"> ✓ Memory Types</Text>
        </Box>
        <Box paddingLeft={5} marginTop={1}>
          <Text>{preview}</Text>
        </Box>
      </Box>
    )
  }

  if (output.queryType === 'type') {
    if (output.totalMatches === 0) {
      return (
        <Box flexDirection="column" paddingLeft={2}>
          <Box>
            <Text backgroundColor="gray" color="black"> IN </Text>
            <Text> memory_search type</Text>
          </Box>
          <Box marginTop={1}>
            <Text backgroundColor="gray" color="black"> OUT </Text>
            <Text color="yellow"> No memories found</Text>
          </Box>
        </Box>
      )
    }

    const preview = output.content.length > 1000 ? output.content.slice(0, 1000) + '…' : output.content
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Box>
          <Text backgroundColor="gray" color="black"> IN </Text>
          <Text> memory_search type</Text>
        </Box>
        <Box marginTop={1}>
          <Text backgroundColor="gray" color="black"> OUT </Text>
          <Text color="green"> ✓ Found {output.totalMatches} memor{output.totalMatches !== 1 ? 'ies' : 'y'}</Text>
        </Box>
        <Box paddingLeft={5} marginTop={1}>
          <Text>{preview}</Text>
        </Box>
      </Box>
    )
  }

  if (output.queryType === 'select') {
    if (!output.matches || output.matches.length === 0) {
      return (
        <Box flexDirection="column" paddingLeft={2}>
          <Box>
            <Text backgroundColor="gray" color="black"> IN </Text>
            <Text> memory_search select</Text>
          </Box>
          <Box marginTop={1}>
            <Text backgroundColor="gray" color="black"> OUT </Text>
            <Text color="yellow"> Memory file not found</Text>
          </Box>
        </Box>
      )
    }

    const meta = output.matches[0]
    const preview = output.content.length > 1000 ? output.content.slice(0, 1000) + '…' : output.content
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Box>
          <Text backgroundColor="gray" color="black"> IN </Text>
          <Text> memory_search select:{meta.name}</Text>
        </Box>
        <Box marginTop={1}>
          <Text backgroundColor="gray" color="black"> OUT </Text>
          <Text color="green"> ✓ Memory: {meta.name}</Text>
        </Box>
        <Box paddingLeft={5}>
          <Text color="gray">Type: {meta.type}</Text>
        </Box>
        <Box paddingLeft={5} marginTop={1}>
          <Text>{preview}</Text>
        </Box>
      </Box>
    )
  }

  // search
  if (output.totalMatches === 0) {
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Box>
          <Text backgroundColor="gray" color="black"> IN </Text>
          <Text> memory_search</Text>
        </Box>
        <Box marginTop={1}>
          <Text backgroundColor="gray" color="black"> OUT </Text>
          <Text color="yellow"> No matching memories found</Text>
        </Box>
      </Box>
    )
  }

  const preview = output.content.length > 800 ? output.content.slice(0, 800) + '…' : output.content
  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Box>
        <Text backgroundColor="gray" color="black"> IN </Text>
        <Text> memory_search</Text>
      </Box>
      <Box marginTop={1}>
        <Text backgroundColor="gray" color="black"> OUT </Text>
        <Text color="green"> ✓ Found {output.totalMatches} memor{output.totalMatches !== 1 ? 'ies' : 'y'}</Text>
      </Box>
      {output.matches && (
        <Box flexDirection="column" paddingLeft={5} marginTop={1}>
          {output.matches.map((meta, i) => (
            <Text key={i} color="gray">
              • {meta.name} [{meta.type}]
            </Text>
          ))}
        </Box>
      )}
      <Box paddingLeft={5} marginTop={1}>
        <Text>{preview}</Text>
      </Box>
    </Box>
  )
}
