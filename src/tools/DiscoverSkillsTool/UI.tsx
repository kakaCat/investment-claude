import React from 'react'
import { Box, Text } from 'ink'

export function DiscoverSkillsToolUseUI() {
  return (
    <Box>
      <Text color="cyan" bold>discover_skills</Text>
    </Box>
  )
}

export function DiscoverSkillsToolResultUI({ result }: { result: string }) {
  return <Text color="gray" wrap="wrap">{result}</Text>
}
