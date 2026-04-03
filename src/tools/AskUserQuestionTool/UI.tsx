import React from 'react'
import { Box, Text } from 'ink'
export function AskUserQuestionToolUseUI({ input }: { input: { question: string; options: Array<{ label: string; description?: string }> } }) {
  return (
    <Box flexDirection="column">
      <Box><Text color="magenta" bold>ask </Text><Text>{input.question}</Text></Box>
      {input.options.map((opt, i) => (
        <Box key={i} paddingLeft={2}><Text color="gray">{i + 1}. {opt.label}</Text></Box>
      ))}
    </Box>
  )
}

export function AskUserQuestionToolResultUI({ result }: { result: string }) {
  return <Box><Text color="magenta" bold>→ </Text><Text>{result}</Text></Box>
}
