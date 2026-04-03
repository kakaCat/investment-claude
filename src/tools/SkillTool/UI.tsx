import React from 'react'
import { Box, Text } from 'ink'

export function SkillToolUseUI({ input }: { input: { skill: string; args?: string } }) {
  return (
    <Box>
      <Text color="cyan" bold>skill </Text>
      <Text color="white">{input.skill}</Text>
      {input.args && <Text color="gray"> {input.args}</Text>}
    </Box>
  )
}

export function SkillToolResultUI({ result }: { result: string }) {
  const isError = result.startsWith('ERROR:')
  const preview = result.length > 200 ? result.slice(0, 200) + '…' : result
  return <Text color={isError ? 'red' : 'gray'} wrap="wrap">{preview}</Text>
}
