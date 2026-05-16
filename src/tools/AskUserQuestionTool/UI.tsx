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

type AskUserQuestionResult = {
  question: string
  options: Array<{ label: string; description?: string }>
  answer: string
  isDefault: boolean
}

export function AskUserQuestionToolResultUI({ result }: { result: string | AskUserQuestionResult }) {
  // Backward compatibility: handle string result
  if (typeof result === 'string') {
    return <Box><Text color="magenta" bold>→ </Text><Text>{result}</Text></Box>
  }

  // New structured result
  const questionPreview = result.question.length > 100
    ? result.question.slice(0, 100) + '…'
    : result.question

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="magenta" bold>ask </Text>
        <Text>{questionPreview}</Text>
      </Box>
      <Box>
        <Text color="magenta" bold>→ </Text>
        <Text color={result.isDefault ? 'yellow' : 'green'}>
          {result.answer}
          {result.isDefault && <Text color="gray"> (default)</Text>}
        </Text>
      </Box>
    </Box>
  )
}
