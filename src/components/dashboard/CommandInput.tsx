// src/components/dashboard/CommandInput.tsx
import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'

type Props = {
  onSubmit: (command: string) => void
  onCancel: () => void
}

export function CommandInput({ onSubmit, onCancel }: Props) {
  const [input, setInput] = useState('')

  useInput((char, key) => {
    if (key.return) {
      if (input.trim()) {
        onSubmit(input.trim())
      }
      setInput('')
    } else if (key.escape) {
      onCancel()
      setInput('')
    } else if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1))
    } else if (!key.ctrl && !key.meta && char) {
      setInput((prev) => prev + char)
    }
  })

  return (
    <Box borderStyle="single" borderColor="cyan" paddingX={1}>
      <Text color="cyan">:</Text>
      <Text>{input}</Text>
      <Text color="gray"> (Enter提交 | Esc取消)</Text>
    </Box>
  )
}
