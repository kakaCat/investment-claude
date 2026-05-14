// src/components/dashboard/ResultModal.tsx
import React from 'react'
import { Box, Text } from 'ink'

type Props = {
  content: string
  onClose: () => void
}

export function ResultModal({ content }: Props) {
  return (
    <Box
      position="absolute"
      borderStyle="double"
      borderColor="cyan"
      padding={1}
      flexDirection="column"
    >
      <Text bold color="cyan">分析结果</Text>
      <Box marginTop={1} flexDirection="column">
        <Text>{content}</Text>
      </Box>
      <Box marginTop={1}>
        <Text color="gray">[按任意键关闭]</Text>
      </Box>
    </Box>
  )
}
