// 用户输入框 — 对标 Claude Code src/components/PromptInput/PromptInput.tsx
// 简化版：只处理文本输入和 slash commands

import React from 'react'
import { Box, Text, useInput } from 'ink'
import { useState } from 'react'

type Props = {
  onSubmit: (input: string) => void
  isLoading: boolean
}

export function PromptInput({ onSubmit, isLoading }: Props) {
  const [value, setValue] = useState('')

  useInput((input, key) => {
    if (isLoading) return

    if (key.return) {
      if (value.trim()) {
        onSubmit(value.trim())
        setValue('')
      }
      return
    }

    if (key.backspace || key.delete) {
      setValue((v) => v.slice(0, -1))
      return
    }

    if (key.ctrl && input === 'c') {
      process.exit(0)
    }

    // 普通字符输入
    if (!key.ctrl && !key.meta && input) {
      setValue((v) => v + input)
    }
  })

  return (
    <Box>
      <Text color="green" bold>
        {'> '}
      </Text>
      <Text>{value}</Text>
      {!isLoading && <Text color="gray">█</Text>}
    </Box>
  )
}
