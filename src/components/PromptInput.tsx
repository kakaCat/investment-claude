import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import type { Skill } from '../skills/index.js'
import { useTypeahead } from '../hooks/useTypeahead.js'
import { PromptInputSuggestions } from './PromptInputSuggestions.js'

type Props = {
  onSubmit: (input: string) => void
  isLoading: boolean
  onExit?: () => Promise<void>
  skills?: Skill[]
}

export function PromptInput({ onSubmit, isLoading, onExit, skills = [] }: Props) {
  const [value, setValue] = useState('')

  const { suggestions, isOpen, handleKeyDown } = useTypeahead({
    value,
    onInputChange: setValue,
    onSubmit: nextValue => {
      onSubmit(nextValue)
      setValue('')
    },
    skills,
  })

  useInput((input, key) => {
    if (isLoading) return
    if (handleKeyDown(input, key)) return

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
      if (onExit) {
        void onExit()
      } else {
        process.exit(0)
      }
      return
    }

    if (!key.ctrl && !key.meta && input) {
      setValue(v => v + input)
    }
  })

  return (
    <Box flexDirection="column">
      {isOpen && (
        <PromptInputSuggestions
          items={suggestions.items}
          selectedIndex={suggestions.selectedIndex}
          argumentHint={suggestions.argumentHint}
        />
      )}
      <Box>
        <Text color="green" bold>
          {'> '}
        </Text>
        <Text>{value}</Text>
        {!isLoading && <Text color="gray">█</Text>}
      </Box>
    </Box>
  )
}
