// src/components/dashboard/CommandInput.tsx
import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'

type Props = {
  onSubmit: (command: string) => void
  onCancel: () => void
  isActive: boolean
}

export function CommandInput({ onSubmit, onCancel, isActive }: Props) {
  const [input, setInput] = useState('')

  useInput((char, key) => {
    // Only handle input when this component is active
    if (!isActive) return

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

  // Reset input when becoming inactive
  useEffect(() => {
    if (!isActive) {
      setInput('')
    }
  }, [isActive])

  return (
    <Box borderStyle="single" borderColor="cyan" paddingX={1}>
      <Text color="cyan">:</Text>
      <Text>{input}</Text>
      <Text color="gray"> (Enter提交 | Esc取消)</Text>
    </Box>
  )
}
